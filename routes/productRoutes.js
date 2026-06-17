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
  adjustStock,
  getStockHistory,
} = require('../controllers/productController.js');

const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware.js');
const { resolveTenant, checkProductQuota } = require('../middleware/tenantMiddleware.js');
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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'tryon_image') {
      if (file.mimetype !== 'image/png') {
        return cb(new Error('Try-on image must be a transparent PNG.'));
      }
      return cb(null, true);
    }
    if (!/^image\//.test(file.mimetype)) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

const uploadProductImages = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'tryon_image', maxCount: 1 },
]);

// Routes
router
  .route('/')
  .get(optionalAuth, getAllProducts)
  .post(protect, resolveTenant, checkProductQuota, uploadProductImages, createValidationRules(), validator, createProduct);

router
  .route('/:id')
  .get(getProduct)
  .patch(protect, uploadProductImages, editProduct)
  .delete(protect, deleteProduct);

router.route('/:id/stock').patch(protect, authorize('admin', 'super-admin'), adjustStock);
router.route('/:id/stock-history').get(protect, getStockHistory);

router.route('/pos/:barcode').get(protect, authorize("admin"), getProductByBarCode)


// router.put('/:id/view', incremeentProductView);
router.patch('/:id/review', protect, addReviewToProduct);

module.exports = router;
