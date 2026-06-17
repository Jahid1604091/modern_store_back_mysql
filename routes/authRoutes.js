const express = require('express');
const router = express.Router();
const {
  registerCompany,
  getSubscription,
  forgotPassword,
  resetPassword,
  verifyEmail,
  seedPlatformAdmin,
} = require('../controllers/authController.js');
const { protect } = require('../middleware/authMiddleware.js');
const PLANS = require('../config/plans.js');

// SaaS onboarding — create company + first admin user
router.post('/register', registerCompany);

// One-time platform admin bootstrap (self-disables after first use)
router.post('/seed-platform-admin', seedPlatformAdmin);

// Subscription management — read-only here; plan changes go through
// /api/subscription-requests (company admin) or /api/companies/:id (platform admin)
router.get('/subscription', protect, getSubscription);

// Password reset
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Email verification
router.get('/verify-email/:token', verifyEmail);

// Public plans listing
router.get('/plans', (req, res) => {
  res.json({ success: true, data: PLANS });
});

// Current tenant's feature flags
router.get('/features', protect, async (req, res, next) => {
  try {
    const db = require('../models/index');
    const company = await db.Company.findByPk(req.user.company_id, {
      attributes: ['subscription_plan', 'max_users', 'max_products'],
    });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    const plan = PLANS[company.subscription_plan] || PLANS.trial;
    return res.json({
      success: true,
      data: {
        plan: company.subscription_plan,
        max_users: company.max_users,
        max_products: company.max_products,
        features: plan.features,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
