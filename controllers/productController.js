const slugify = require('slugify');
const asyncHandler = require('../middleware/asyncHandler.js');
const ErrorResponse = require('../utils/errorresponse.js');
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require("../models/index");
const { Product, Category, Review, StockAdjustment } = db;
const { companyScopeWhere, resolveCompanyId } = require("../utils/companyScope.js");
const sendMail = require('../utils/sendEmail');

// ------------------------ PUBLIC ----------------------------

// @route    GET /api/products?company_id=X&q=term&page=1
// @desc     Get all products.
//           Public: requires company_id query param, shows only active products.
//           Authenticated admin: falls back to JWT company_id, shows all statuses.
// @access   Public / Protected (optionalAuth)
const getAllProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.limit) || 10;

  const { q, barcode, categories, min_price, max_price, sort, stock_status, status: statusFilter } = req.query;

  // Resolve company_id: query param → JWT user fallback
  const company_id = req.query.company_id || (req.user && req.user.company_id);

  if (!company_id) {
    return res.status(400).json({ success: false, msg: 'company_id query parameter is required.' });
  }

  // Authenticated admins see all statuses; public sees only active
  const isAdmin = !!req.user;
  const productWhere = { company_id };
  if (!isAdmin) {
    productWhere.status = "active";
  } else if (statusFilter) {
    productWhere.status = statusFilter;
  }
  const categoryWhere = {};

  if (barcode) productWhere.barcode = barcode.trim();

  if (q && q.trim()) {
    productWhere[Op.or] = [
      { name: { [Op.like]: `%${q.trim()}%` } },
      { description: { [Op.like]: `%${q.trim()}%` } },
    ];
  }

  if (categories) {
    const categoryList = categories.split(',').map(c => c.trim());
    categoryWhere.name = { [Op.in]: categoryList };
  }

  if (min_price || max_price) {
    productWhere.price = {};
    if (min_price) productWhere.price[Op.gte] = Number(min_price);
    if (max_price) productWhere.price[Op.lte] = Number(max_price);
  }

  if (stock_status === 'out_of_stock') {
    productWhere.stock_quantity = { [Op.lte]: 0 };
  } else if (stock_status === 'low_stock') {
    productWhere.stock_quantity = { [Op.gt]: 0, [Op.lte]: Sequelize.col('min_stock_threshold') };
  } else if (stock_status === 'in_stock') {
    productWhere.stock_quantity = { [Op.gt]: Sequelize.col('min_stock_threshold') };
  }

  const sortMap = {
    name_asc: ["name", "ASC"],
    name_desc: ["name", "DESC"],
    price_low: ["price", "ASC"],
    price_high: ["price", "DESC"],
    stock_low: ["stock_quantity", "ASC"],
    stock_high: ["stock_quantity", "DESC"],
    newest: ["createdAt", "DESC"],
  };

  let order = [["createdAt", "DESC"]];
  if (sort) {
    const sorts = sort.split(",");
    order = sorts.map((s) => sortMap[s]).filter(Boolean);
  }

  const { count, rows: products } = await Product.findAndCountAll({
    where: productWhere,
    include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name"],
        where: Object.keys(categoryWhere).length ? categoryWhere : undefined,
        required: !!categories,
      },
      { model: Review, as: "reviews" },
    ],
    attributes: { exclude: ["category_id", "updatedAt"] },
    order,
    limit: perPage,
    offset: (page - 1) * perPage,
    distinct: true,
  });

  let stock_summary;
  if (isAdmin) {
    const baseWhere = { company_id };
    const [total, out_of_stock, low_stock, valueRow] = await Promise.all([
      Product.count({ where: baseWhere }),
      Product.count({ where: { ...baseWhere, stock_quantity: { [Op.lte]: 0 } } }),
      Product.count({ where: { ...baseWhere, stock_quantity: { [Op.gt]: 0, [Op.lte]: Sequelize.col('min_stock_threshold') } } }),
      Product.findOne({
        where: baseWhere,
        attributes: [[Sequelize.fn('SUM', Sequelize.literal('stock_quantity * price')), 'total_value']],
        raw: true,
      }),
    ]);
    stock_summary = {
      total,
      out_of_stock,
      low_stock,
      in_stock: total - out_of_stock - low_stock,
      total_stock_value: Number(valueRow?.total_value) || 0,
    };
  }

  res.status(200).json({
    success: true,
    count: products.length,
    total: count,
    data: products,
    page,
    pages: Math.ceil(count / perPage),
    ...(stock_summary ? { stock_summary } : {}),
  });
});

// @route    GET /api/products/:id
// @desc     Get single product
// @access   Public
const getProduct = asyncHandler(async function (req, res, next) {
  const product = await Product.findByPk(req.params.id, {
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name'], where: { isActive: true } },
      { model: Review, as: 'reviews' },
    ],
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }
  res.status(200).json({ success: true, data: product });
});

// @route    PATCH /api/products/:id/review
// @desc     Add review to product
// @access   Protected
const addReviewToProduct = asyncHandler(async function (req, res, next) {
  const user_id = req.user.id;
  const { comment, rating } = req.body;

  if (!rating || !comment) {
    return next(new ErrorResponse('Please add review and rating', 400));
  }

  const product = await Product.findOne({
    where: { id: req.params.id },
    include: [{ model: Review, as: 'reviews' }],
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  if (product.reviews.find(u => u.user_id === req.user.id)) {
    return next(new ErrorResponse('You can review a product once', 400));
  }

  const newReview = await Review.create({ comment, rating, user_id, product_id: product.id });

  res.status(200).json({
    success: true,
    msg: 'Product review added successfully!',
    data: { review: newReview, product },
  });
});

// ------------------------ ADMIN ----------------------------

// @route    POST /api/products
// @desc     Create product (scoped to the admin's company)
// @access   Protected (Admin)
const createProduct = asyncHandler(async function (req, res, next) {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ success: false, msg: 'At least one image is required!' });
  }

  const { name, category_id, tags, metadata, status, barcode } = req.body;
  const company_id = resolveCompanyId(req);
  if (!company_id) {
    return res.status(400).json({ success: false, msg: 'company_id is required.' });
  }
  const slug = slugify(name, '-');

  if (category_id) {
    const existingCategory = await Category.findOne({ where: { id: category_id, company_id } });
    if (!existingCategory) {
      return res.status(404).json({ success: false, msg: 'Category not found!' });
    }
  }

  if (barcode) {
    const existingProduct = await Product.findOne({ where: { barcode, company_id } });
    if (existingProduct) {
      return res.status(400).json({ success: false, msg: 'Product with this barcode already exists!' });
    }
  }

  const gallery = req.files.map((f) => `images/products/${f.filename}`);

  const product = await Product.create({
    ...req.body,
    company_id,
    slug,
    image: gallery[0],
    gallery,
    tags: tags ? JSON.parse(tags) : [],
    metadata: metadata ? JSON.parse(metadata) : {},
    status: status ? 'active' : 'inactive',
  });

  res.status(200).json({ success: true, msg: 'Product created successfully!', data: product });
});

// @route    PATCH /api/products/:id
// @desc     Update product (own company only)
// @access   Protected (Admin)
const editProduct = asyncHandler(async function (req, res, next) {
  const product = await Product.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  const body = req.body;
  let gallery = Array.isArray(product.gallery) ? [...product.gallery] : [];

  if (body.remove_images) {
    const toRemove = JSON.parse(body.remove_images);
    gallery = gallery.filter((img) => !toRemove.includes(img));
    toRemove.forEach((img) => {
      fs.unlink(path.join(process.cwd(), img), (err) => {
        if (err) console.error('Error deleting removed image:', err.message);
      });
    });
  }

  if (req.files && req.files.length) {
    if (gallery.length + req.files.length > 5) {
      return res.status(400).json({ success: false, msg: 'A product can have at most 5 images.' });
    }
    gallery = [...gallery, ...req.files.map((f) => `images/products/${f.filename}`)];
  }

  if (body.remove_images || (req.files && req.files.length)) {
    body.gallery = gallery;
    body.image = gallery[0] || null;
  }

  if (body.name) body.slug = slugify(body.name, '-');
  if (typeof body.metadata === 'string') body.metadata = JSON.parse(body.metadata);
  if (typeof body.tags === 'string') body.tags = JSON.parse(body.tags);

  await product.update(body);

  res.status(200).json({ success: true, msg: 'Product updated successfully!', data: product });
});

// @route    DELETE /api/products/:id
// @desc     Soft delete product (own company only)
// @access   Protected (Admin)
const deleteProduct = asyncHandler(async function (req, res, next) {
  const product = await Product.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  await product.update({ status: 'inactive' });

  res.status(200).json({ success: true, msg: 'Product deleted successfully!' });
});

// @route    GET /api/products/pos/:barcode
// @desc     Get product by barcode (own company only)
// @access   Protected
const getProductByBarCode = asyncHandler(async function (req, res, next) {
  const product = await Product.findOne({
    where: companyScopeWhere(req, { barcode: req.params.barcode }),
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }
  res.status(200).json({ success: true, data: product });
});

// @route    PATCH /api/products/:id/stock
// @desc     Manually adjust stock quantity (own company only), with audit trail
// @access   Protected (Admin)
const adjustStock = asyncHandler(async function (req, res, next) {
  const { change, reason } = req.body;
  const delta = parseInt(change, 10);

  if (!delta) {
    return next(new ErrorResponse('A non-zero integer "change" is required.', 400));
  }

  const transaction = await Product.sequelize.transaction();

  try {
    const product = await Product.findOne({
      where: companyScopeWhere(req, { id: req.params.id }),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!product) {
      await transaction.rollback();
      return next(new ErrorResponse('Product not found', 404));
    }

    const previous_quantity = product.stock_quantity;
    const new_quantity = previous_quantity + delta;

    if (new_quantity < 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, msg: `Insufficient stock. Current: ${previous_quantity}.` });
    }

    product.stock_quantity = new_quantity;
    await product.save({ transaction });

    await StockAdjustment.create({
      product_id: product.id,
      company_id: product.company_id,
      user_id: req.user.id,
      change: delta,
      reason: reason || null,
      previous_quantity,
      new_quantity,
    }, { transaction });

    await transaction.commit();

    if (new_quantity <= product.min_stock_threshold) {
      sendMail({
        email: 'jh409780@gmail.com',
        subject: 'Low Stock Alert',
        message: `${product.name} remains only ${new_quantity} [min: ${product.min_stock_threshold}], Please Restock!`,
      }).catch((err) => console.error('Low stock email failed:', err.message));
    }

    res.status(200).json({
      success: true,
      msg: 'Stock adjusted successfully!',
      data: { id: product.id, stock_quantity: new_quantity },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

// @route    GET /api/products/:id/stock-history
// @desc     List recent manual stock adjustments for a product (own company only)
// @access   Protected (Admin)
const getStockHistory = asyncHandler(async function (req, res, next) {
  const product = await Product.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  const { User } = db;
  const history = await StockAdjustment.findAll({
    where: { product_id: product.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  res.status(200).json({ success: true, data: history });
});

module.exports = {
  getAllProducts,
  createProduct,
  editProduct,
  deleteProduct,
  getProduct,
  addReviewToProduct,
  getProductByBarCode,
  adjustStock,
  getStockHistory,
};
