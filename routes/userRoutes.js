const express = require('express');
const { getProfile, login, register } = require('../controllers/userController.js');
const { protect } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.route('/register').post(register)
router.route('/login').post(login)
router.route('/profile').get(protect, getProfile)

module.exports = router;