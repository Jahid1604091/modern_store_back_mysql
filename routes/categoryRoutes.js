const express  = require('express');
const router = express.Router();
const { protect, authorize, optionalAuth } =  require('../middleware/authMiddleware.js');
const { createCategory, deleteCategory, editCategory, getCategories } = require('../controllers/categoryController.js');


router.route('/').post(protect, createCategory);
router.route('/:id').delete(protect, deleteCategory);
router.route('/:id').patch(protect, editCategory);

router.route('/').get(getCategories);

module.exports =  router