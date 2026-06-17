const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware.js');
const {
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  getFeaturedCoupon, validateCoupon,
} = require('../controllers/couponController.js');

// Public
router.get('/featured', getFeaturedCoupon);
router.post('/validate', validateCoupon);

// Admin
router.get('/', protect, getCoupons);
router.post('/', protect, createCoupon);
router.patch('/:id', protect, updateCoupon);
router.delete('/:id', protect, deleteCoupon);

module.exports = router;
