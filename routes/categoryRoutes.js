import express from 'express';
const router = express.Router();
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';
import { createCategory, deleteCategory, editCategory, getCategories } from '../controllers/categoryController.js';


router.route('/').post(protect, authorize('admin'), createCategory);
router.route('/:id').delete(protect, authorize('admin'), deleteCategory);
router.route('/:id').patch(protect, authorize('admin'), editCategory);

router.route('/').get(optionalAuth,getCategories);

export default router