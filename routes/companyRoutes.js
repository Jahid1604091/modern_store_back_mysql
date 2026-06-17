const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { protect, platformAdminOnly } = require('../middleware/authMiddleware.js');
const {
  createCompany,
  getCompanies,
  getCompany,
  getMyCompany,
  updateMyCompany,
  updateCompany,
  getPlatformStats,
  resolveCompany,
} = require('../controllers/companyController.js');

const uploadPath = path.join(__dirname, '../images/company');
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

// Public — storefront calls this on load to resolve subdomain → company data
router.get('/resolve', resolveCompany);

// Tenant self-service
router.get('/me', protect, getMyCompany);
router.patch('/me', protect, upload.single('logo'), updateMyCompany);

// Platform admin only (user with company_id = null)
router.get('/platform-stats', protect, platformAdminOnly, getPlatformStats);
router.post('/', protect, platformAdminOnly, createCompany);
router.get('/', protect, platformAdminOnly, getCompanies);
router.patch('/:id', protect, platformAdminOnly, updateCompany);

// Public — fetch a single company by numeric id
router.get('/:id', getCompany);

module.exports = router;
