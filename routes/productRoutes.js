const express = require('express');
const path = require('path');
const multer = require('multer');

const {
  createProduct,
  deleteProduct,
  editProduct,
  getAllProducts,
  getProduct,
} = require('../controllers/productController.js');

const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware.js');

const router = express.Router();

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images/products/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Routes
router
  .route('/')
  .get( getAllProducts)
  .post(protect, upload.single('image'), createProduct);

router
  .route('/:id')
  .get(getProduct)
  .patch(protect,  upload.single('image'), editProduct)
  .delete(protect, deleteProduct);

// router.put('/:id/view', incremeentProductView);
// router.post('/:id/review', protect, addReview);

module.exports = router;
