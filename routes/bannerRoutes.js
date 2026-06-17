const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authMiddleware.js');
const { getBanners, createBanner, updateBanner, deleteBanner } = require('../controllers/bannerController.js');

const uploadPath = path.join(__dirname, '../images/banners');
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

router.route('/')
  .get(optionalAuth, getBanners)
  .post(protect, upload.single('image'), createBanner);

router.route('/:id')
  .patch(protect, upload.single('image'), updateBanner)
  .delete(protect, deleteBanner);

module.exports = router;
