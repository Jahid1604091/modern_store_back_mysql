const express = require('express');
const router = express.Router();
const { protect, authorize, platformAdminOnly } = require('../middleware/authMiddleware.js');
const {
  createRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest,
} = require('../controllers/subscriptionRequestController.js');

// Company admin
router.post('/', protect, authorize('admin', 'super-admin'), createRequest);
router.get('/mine', protect, getMyRequests);

// Platform admin
router.get('/', protect, platformAdminOnly, getAllRequests);
router.patch('/:id', protect, platformAdminOnly, reviewRequest);

module.exports = router;
