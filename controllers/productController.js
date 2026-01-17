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


const getAllProducts = asyncHandler(async function (req, res) {
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const searchTerm = req.query.q ? req.query.q.trim() : '';
  const barcode = req.query.barcode ? req.query.barcode.trim() : '';

  const where = {};

  // Barcode search (exact match)
  if (barcode) {
    where.id = barcode;
    // where.barcode = barcode;
  }

  // Search functionality
  if (searchTerm) {
    where[Op.or] = [
      { name: { [Op.like]: '%' + searchTerm + '%' } },
      { description: { [Op.like]: '%' + searchTerm + '%' } },
    ];
  }

  // Total count
  const total = await Product.count({ where: where });

  const products = await Product.findAll({
    include: [
      {
        model: Category,
        as: 'category',
        attributes: ['id', 'name'],
      },
      {
        model: Review,
        as: 'reviews'
      },
    ],
    where: where,
    offset: (page - 1) * perPage,
    limit: perPage,
    order: [['createdAt', 'DESC']],
    attributes: { exclude: ['category_id', 'updatedAt'] }
  });

  res.status(200).json({
    success: true,
    count: total,
    data: products,
    page: page,
    pages: Math.ceil(total / perPage),
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
    image: req.file.path.replace(/\\/g, '/'),
    gallery: gallery ? JSON.parse(gallery) : [],
    tags: tags ? JSON.parse(tags) : [],
    status: status ? 'active' : 'inactive'
  });

  res.status(201).json({
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
    if (product.image) {
      const oldPath = path.join(__dirname, '..', product.image);
      fs.unlink(oldPath, function (err) {
        if (err) console.error('Error deleting old image:', err);
      });
    }
    body.image = req.file.path.replace(/\\/g, '/');
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