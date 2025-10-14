import express from 'express';
const router = express.Router();
import { createOrder, getAllOrders, getMyOrders, getMyOrder, updateOrderToPaid, generateInvoice, updateToDelivered, getOrder, getOrdersOverview } from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';


router.route('/').post(protect, createOrder)
router.route('/myorders').get(protect, getMyOrders)
router.route('/myorders/:id').get(protect, getMyOrder)
router.route('/myorders/:id/pay').put(protect, updateOrderToPaid)
router.route('/myorders/:id/invoice').get(protect, generateInvoice)

//---- SYSTEM ADMIN ------
router.route('/overview').get(protect, authorize('admin'), getOrdersOverview)
router.route('/').get(protect, authorize('admin'), getAllOrders)
router.route('/:id').get(protect, authorize('admin'), getOrder)
router.route('/:id/change-to-delivered').put(protect, authorize('admin'), updateToDelivered)



export default router