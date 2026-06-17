const express  = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { protect, authorize, optionalAuth } =  require('../middleware/authMiddleware.js');
const { createCategory, deleteCategory, editCategory, getCategories } = require('../controllers/categoryController.js');

const uploadPath = path.join(__dirname, '../images/categories');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

router.route('/').post(protect, upload.single('image'), createCategory);
router.route('/:id').delete(protect, deleteCategory);
router.route('/:id').patch(protect, upload.single('image'), editCategory);

router.route('/').get(optionalAuth, getCategories);

module.exports =  router
