import slugify from 'slugify';
import asyncHandler from '../middleware/asyncHandler.js';
import Product from '../models/productModel.js';
import path from 'path';
import fs from 'fs';
import Category from '../models/categoryModel.js';
import Brand from '../models/brandModel.js';
import ErrorResponse from '../utils/errorresponse.js';
import { per_page } from '../utils/misc.js';

//@route    /api/products?q='df'
//@desc     get all products
//@access   public
export const getAllProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default page, explicitly parse to integer
  const perPage = 10; // Items per page (renamed for clarity)
  const searchTerm = req.query.q ? req.query.q.trim() : '';

  const query = { isSoftDeleted: false };

  // Authorization: Only admin can see inactive products
  if (!req.user || req.user.role !== 'admin') {
    query.isActive = true;
  }

  // Search query (improved for efficiency and correctness)
  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { brand: { $regex: searchTerm, $options: 'i' } },
      { 'category.name': { $regex: searchTerm, $options: 'i' } }, // Assuming category is populated
    ];
  }

  try {
    // Optimization: Get total count only if needed for pagination
    const totalProducts = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate('category', 'name')
      .limit(perPage)
      .skip((page - 1) * perPage) // Corrected skip calculation
      .sort({ sales: -1, views: -1 })
      .lean(); // Add lean() for plain JavaScript objects, potentially improving performance

    res.status(200).json({
      success: true,
      count: totalProducts,
      data: products,
      page,
      pages: Math.ceil(totalProducts / perPage),
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching products.', // More descriptive message
    });
  }
});


//@route    /api/products/:id
//@desc     get product
//@access   public
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name');
  res.status(200).json({
    success: true,
    data: product,
  })
});

//@route    /api/products/:id/view
//@desc     PUT incremeentProductView
//@access   public
export const incremeentProductView = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  product.views = product.views + 1;
  await product.save();
  res.status(200).json({ success: true, msg: 'View count incremented' });
});

//@route    /api/products/:id/review
//@desc     post    review product
//@access   protected
export const addReview = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  //check if already reviewed
  if (product.reviews.find(u => u.user.toString() === req.user._id.toString())) {
      return next(new ErrorResponse('You can review a product once', 400))
  }

  //review
  if (!req.body.rating || !req.body.comment) {
      return next(new ErrorResponse('Please add review and rating', 400))
  }


  const review = {
      rating:req.body.rating,
      comment:req.body.comment,
      name: req.user.name,
      user: req.user._id,
  }

  product.reviews.push(review)

  //total reviews
  product.numReviews = product.reviews.length;
  //avg rating
  product.rating = product.reviews.reduce((acc, prod) => prod.rating + acc, 0) / product.reviews.length
  await product.save();
  return res.status(201).json({
      success: true,
      msg: 'Review Added !'
  });
});

//------------------- A D M I N------------------------
//@route    /api/products
//@desc     POST: create a new product
//@access   protected by admin
export const createProduct = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      msg: 'No image file uploaded!',
    });
  }

  const { name, description, brand, category, price, countInStock, status, currency } = req.body;

  // Check if the category exists and is not soft-deleted
  const existingCategory = await Category.findOne({ _id: category, isSoftDeleted: false });
  if (!existingCategory) {
    return res.status(404).json({
      success: false,
      msg: 'Category not found or it has been soft-deleted!'
    });
  }

  // Check if the brand exists and is not soft-deleted
  // const existingBrand = await Brand.findOne({ _id: brand, isSoftDeleted: false });
  // if (!existingBrand) {
  //   return res.status(404).json({
  //     success: false,
  //     msg: 'Brand not found or it has been soft-deleted!'
  //   });
  // }

  const slug = slugify(name, '-');

  //check if brand or category exists or not softdeleted
  const product = new Product({
    name,
    slug,
    image: req.file.path.replace(/\\/g, "/"), //convert \ to /
    description,
    brand,
    category,
    price,
    countInStock,
    isActive: status,
    currency: currency ?? 'BDT'
  });
  const newProduct = await product.save();
  return res.status(200).json({
    success: true,
    msg: "Product created successfully!",
    data: newProduct
  });
})


//@route    /api/products/:id
//@desc     PATCH: update a new product
//@access   protected by admin
export const editProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new ErrorResponse('No Product Found to Update!', 404));
  }
  const { name, description, brand, category, price, countInStock, status } = req.body;

  // Check if the category exists and is not soft-deleted
  // const existingCategory = await Category.findOne({ _id: category, isSoftDeleted: false });
  // if (!existingCategory) {
  //   return res.status(404).json({
  //     success: false,
  //     msg: 'Category not found or it has been soft-deleted!'
  //   });
  // }

  // // Check if the brand exists and is not soft-deleted
  // const existingBrand = await Brand.findOne({ _id: brand, isSoftDeleted: false });
  // if (!existingBrand) {
  //   return res.status(404).json({
  //     success: false,
  //     msg: 'Brand not found or it has been soft-deleted!'
  //   });
  // }

  product.name = name || product.name;
  product.slug = name ? slugify(name, '-') : product.slug;
  product.description = description || product.description;
  product.brand = brand || product.brand;
  product.category = category || product.category;
  product.price = price || product.price;
  product.countInStock = countInStock || product.countInStock;
  if (typeof status !== 'undefined') {
    product.isActive = status;
  }

  // Handle image upload
  if (req.file) {
    // Delete the old image if it exists
    if (product.image) {
      const __dirname = path.resolve();
      const oldImagePath = path.join(__dirname, product.image);
      fs.unlink(oldImagePath, (err) => {
        if (err) console.error('Failed to delete old product image:', err);
      });
    }
    product.image = req.file.path;
  }

  // Save the updated product
  const updatedProduct = await product.save();

  return res.status(200).json({
    success: true,
    msg: "Product updated successfully!",
    data: updatedProduct
  });
})

//@route    /api/products/:id
//@desc     DELETE: delete a product
//@access   protected by admin
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const product = await Product.findById(id);

  if (!product) {
    return next(new ErrorResponse('No Product Found to Delete!', 404));
  }

  //if we need to delete permanently
  // Delete the product image from the server
  // const __dirname = path.resolve();
  // const imagePath = path.join(__dirname, product.image);

  // fs.unlink(imagePath, (err) => {
  //   if (err) {
  //     console.error(`Failed to delete image: ${imagePath}`, err);
  //     return next(new ErrorResponse('Failed to delete product image.', 500));
  //   }
  // });

  //update table
  product.isSoftDeleted = true;
  product.softDeletedAt = Date.now();
  product.deletedBy = req.user._id;


  await product.save();

  return res.status(200).json({
    success: true,
    msg: "Product deleted successfully!",
    data: product
  });
})