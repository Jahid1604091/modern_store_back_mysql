import express from 'express';
import { addReview, createProduct, deleteProduct, editProduct, getAllProducts, getProduct, incremeentProductView } from '../controllers/productController.js';
import { protect, authorize, optionalAuth } from '../middleware/authMiddleware.js';
import path from 'path';
import multer from 'multer';

const router = express.Router();

// Set up storage for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/products/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.route('/')
    .get(optionalAuth,getAllProducts)
    .post(protect, authorize('admin'), upload.single('image'), createProduct);

router.route('/:id')
    .get(getProduct)
    .patch(protect, authorize('admin'), upload.single('image'), editProduct)
    .delete(protect, authorize('admin'), deleteProduct);

router.route('/:id/view').put(incremeentProductView);
router.route('/:id/review').post(protect,addReview);

export default router;