const express = require('express');
const path = require('path');
const multer = require('multer');

const {
  createProduct,
  deleteProduct,
  editProduct,
  getAllProducts,
  getProduct,
  addReviewToProduct,
  getProductByBarCode,
} = require('../controllers/productController.js');

const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware.js');
const { updateValidationRules } = require('../dtos/productDto.js');
const validator = require('../middleware/validator.js');
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
  .get(getAllProducts)
  .post(protect, upload.single('image'), createProduct);

router
  .route('/:id')
  .get(getProduct)
  .patch(protect, upload.single('image'), updateValidationRules(), validator, editProduct)
  .delete(protect, deleteProduct);

router.route('/pos/:barcode').get(protect, authorize("admin"), getProductByBarCode)


// router.put('/:id/view', incremeentProductView);
router.patch('/:id/review', protect, addReviewToProduct);

module.exports = router;
