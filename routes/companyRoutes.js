const express = require('express');
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

// Public — storefront calls this on load to resolve subdomain → company data
router.get('/resolve', resolveCompany);

// Tenant self-service
router.get('/me', protect, getMyCompany);
router.patch('/me', protect, updateMyCompany);

// Platform admin only (user with company_id = null)
router.get('/platform-stats', protect, platformAdminOnly, getPlatformStats);
router.post('/', protect, platformAdminOnly, createCompany);
router.get('/', protect, platformAdminOnly, getCompanies);
router.patch('/:id', protect, platformAdminOnly, updateCompany);

// Public — fetch a single company by numeric id
router.get('/:id', getCompany);

module.exports = router;
