const slugify = require('slugify');
const asyncHandler = require('../middleware/asyncHandler.js');
const ErrorResponse = require('../utils/errorresponse.js');
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require("../models/index");
const { Product, Category, Review } = db;

// ------------------------ PUBLIC ----------------------------

// @route    GET /api/products?q=term&page=1
// @desc     Get all products (with pagination and search)
// @access   Public
const getAllProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;

  const { company_id, q, barcode, categories, min_price, max_price, sort } = req.query;

  const productWhere = {
    status: "active",
    company_id: company_id || 1
  };

  const categoryWhere = {};

  // Barcode search
  if (barcode) {
    productWhere.barcode = barcode.trim();
  }

  // Search by name/description
  if (q && q.trim()) {
    productWhere[Op.or] = [
      { name: { [Op.like]: `%${q.trim()}%` } },
      { description: { [Op.like]: `%${q.trim()}%` } },
    ];
  }

  // Category filter
  if (categories) {
    const categoryList = categories.split(',').map(c => c.trim());
    categoryWhere.name = {
      [Op.in]: categoryList
    };
  }

  //search by price range
  if (min_price || max_price) {
    productWhere.price = {};
    if (min_price) productWhere.price[Op.gte] = Number(min_price);
    if (max_price) productWhere.price[Op.lte] = Number(max_price);
  }

  //sorting
  const sortMap = {
    name_asc: ["name", "ASC"],
    name_desc: ["name", "DESC"],
    price_low: ["price", "ASC"],
    price_high: ["price", "DESC"],
    newest: ["createdAt", "DESC"],
  };

  let order = [["createdAt", "DESC"]];

  if (req.query.sort) {
    const sorts = sort.split(",");
    order = sorts.map((s) => sortMap[s]).filter(Boolean);
  }

  const queryOptions = {
    where: productWhere,
    include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name"],
        where: Object.keys(categoryWhere).length ? categoryWhere : undefined,
        required: !!categories, // inner join only if category filter exists
      },
      {
        model: Review,
        as: "reviews",
      },
    ],
    attributes: { exclude: ["category_id", "updatedAt"] },
    order,
    limit: perPage,
    offset: (page - 1) * perPage,
    distinct: true,
  };

  const { count, rows: products } = await Product.findAndCountAll(queryOptions);

  res.status(200).json({
    success: true,
    count: products.length,
    total: count,
    data: products,
    page,
    pages: Math.ceil(count / perPage),
  });
});

// @route    GET /api/products/:id
// @desc     Get single product
// @access   Public
const getProduct = asyncHandler(async function (req, res, next) {
  const product = await Product.findByPk(req.params.id, {
    include: [
      {
        model: Category,
        as: 'category',
        attributes: ['id', 'name'],
        where: { isActive: true }
      },
      {
        model: Review,
        as: 'reviews'
      },
    ],
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }
  res.status(200).json({
    success: true,
    data: product,
  });
});

// @route    PATCH /api/products/:id/review
// @desc     add review to product
// @access   Protected 
const addReviewToProduct = asyncHandler(async function (req, res, next) {
  const user_id = req.user.id;
  const { comment, rating } = req.body;

  if (!rating || !comment) {
    return next(new ErrorResponse('Please add review and rating', 400))
  }
  //check if product exist
  const product = await Product.findOne({
    where: { id: req.params.id },
    include: [
      {
        model: Review,
        as: 'reviews'
      }
    ]
  });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  //check if already reviewed by a user
  if (product.reviews.find(u => u.user_id === req.user.id)) {
    return next(new ErrorResponse('You can review a product once', 400))
  }


  const newReview = await Review.create({
    comment, rating, user_id, product_id: product.id
  })

  res.status(200).json({
    success: true,
    msg: 'Product review added successfully!',
    data: { review: newReview, product },
  });
});

// ------------------------ ADMIN ----------------------------

// @route    POST /api/products
// @desc     Create product
// @access   Protected (Admin)
const createProduct = asyncHandler(async function (req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      msg: 'No image file uploaded!',
    });
  }

  const { name, category_id, gallery, tags, status, barcode } = req.body;
  const slug = slugify(name, '-');

  // Optional category validation
  if (category_id) {
    const existingCategory = await Category.findByPk(category_id);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        msg: 'Category not found!',
      });
    }
  }
  // product barcode validation
  if (barcode) {
    const existingProduct = await Product.findOne({ where: { barcode } });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        msg: 'Product Already Exist!',
      });
    }
  }


  const product = await Product.create({
    ...req.body,
    slug,
    image: req.file
      ? `images/products/${req.file.filename}`
      : null,
    gallery: gallery ? JSON.parse(gallery) : [],
    tags: tags ? JSON.parse(tags) : [],
    status: status ? 'active' : 'inactive'
  });

  res.status(200).json({
    success: true,
    msg: 'Product created successfully!',
    data: product,
  });
});

// @route    PATCH /api/products/:id
// @desc     Update product
// @access   Protected (Admin)
const editProduct = asyncHandler(async function (req, res, next) {

  const product = await Product.findByPk(req.params.id);
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  const body = req.body;

  // Handle image replacement
  if (req.file) {
    // delete old image from disk


    if (product.image) {
      const oldPath = path.join(
        process.cwd(),        // project root
        product.image         // /images/products/xyz.jpg
      );

      fs.unlink(oldPath, (err) => {
        if (err) console.error('Error deleting old image:', err.message);
      });
    }

    // store public path in DB
    body.image = `images/products/${req.file.filename}`;
  }

  // If name changed, regenerate slug
  if (body.name) {
    body.slug = slugify(body.name, '-');
  }

  await product.update(body);

  res.status(200).json({
    success: true,
    msg: 'Product updated successfully!',
    data: product,
  });
});

// @route    DELETE /api/products/:id
// @desc     Soft delete product
// @access   Protected (Admin)
const deleteProduct = asyncHandler(async function (req, res, next) {
  const product = await Product.findByPk(req.params.id);
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }

  await product.update({
    status: 'inactive',
  });

  res.status(200).json({
    success: true,
    msg: 'Product deleted successfully!',
  });
});

// @route    GET /api/products/pos/:barcode
// @desc     Get single product
// @access   Public
const getProductByBarCode = asyncHandler(async function (req, res, next) {
  const product = await Product.findOne({ where: { barcode: req.params.barcode } });
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }
  res.status(200).json({
    success: true,
    data: product,
  });
});

module.exports = {
  getAllProducts,
  createProduct,
  editProduct,
  deleteProduct,
  getProduct,
  addReviewToProduct,
  getProductByBarCode
};