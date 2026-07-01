const express = require('express');
const router = express.Router();
const { getAllPOs, createPO, getPO, receivePO, cancelPO } = require('../controllers/purchaseOrderController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('admin', 'super-admin'), getAllPOs);
router.post('/', protect, authorize('admin', 'super-admin'), createPO);
router.get('/:id', protect, authorize('admin', 'super-admin'), getPO);
router.post('/:id/receive', protect, authorize('admin', 'super-admin'), receivePO);
router.patch('/:id/cancel', protect, authorize('admin', 'super-admin'), cancelPO);

module.exports = router;
