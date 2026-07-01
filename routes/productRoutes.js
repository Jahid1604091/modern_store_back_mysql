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
  importProducts,
  downloadImportTemplate,
  bulkDeleteProducts,
  bulkUpdateProducts,
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

// Multer for CSV/Excel import (no image processing, single file)
const importDir = path.join(__dirname, '../tmp');
if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, importDir),
  filename: (req, file, cb) => cb(null, `import-${Date.now()}${path.extname(file.originalname)}`),
});
const uploadImport = multer({
  storage: importStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Only CSV and Excel files are allowed.'));
    }
    cb(null, true);
  },
}).single('file');

// Routes — static paths must come before /:id
router
  .route('/')
  .get(optionalAuth, getAllProducts)
  .post(protect, resolveTenant, checkProductQuota, uploadProductImages, createValidationRules(), validator, createProduct);

// Bulk import — static, must precede /:id
router.get('/import/template', protect, authorize('admin', 'super-admin'), downloadImportTemplate);
router.post('/import', protect, authorize('admin', 'super-admin'), uploadImport, importProducts);

// Bulk operations — static, must precede /:id
router.delete('/bulk', protect, authorize('admin', 'super-admin'), bulkDeleteProducts);
router.patch('/bulk', protect, authorize('admin', 'super-admin'), bulkUpdateProducts);

router.route('/pos/:barcode').get(protect, authorize("admin"), getProductByBarCode);

router
  .route('/:id')
  .get(optionalAuth, getProduct)
  .patch(protect, uploadProductImages, editProduct)
  .delete(protect, deleteProduct);

router.route('/:id/stock').patch(protect, authorize('admin', 'super-admin'), adjustStock);
router.route('/:id/stock-history').get(protect, getStockHistory);

// router.put('/:id/view', incremeentProductView);
router.patch('/:id/review', protect, addReviewToProduct);

module.exports = router;
