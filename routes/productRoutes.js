const express = require('express');
const fs = require('fs');
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
const { updateValidationRules, createValidationRules } = require('../dtos/productDto.js');
const validator = require('../middleware/validator.js');
const router = express.Router();
const uploadPath = path.join(__dirname, '../images/products');

// ensure directory exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Routes
router
  .route('/')
  .get(getAllProducts)
  .post(protect, upload.single('image'), createValidationRules(), validator, createProduct);

router
  .route('/:id')
  .get(getProduct)
  .patch(protect, upload.single('image'),  editProduct)
  .delete(protect, deleteProduct);

router.route('/pos/:barcode').get(protect, authorize("admin"), getProductByBarCode)


// router.put('/:id/view', incremeentProductView);
router.patch('/:id/review', protect, addReviewToProduct);

module.exports = router;
