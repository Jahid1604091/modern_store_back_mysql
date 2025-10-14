import express from 'express';
import { getProfile, login, register } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/register').post(register)
router.route('/login').post(login)
router.route('/profile').get(protect, getProfile)

export default router;