const express = require('express');
const { getProfile, login, register, getAllPermissions, createPermission, deletPermissionPermanently, getAllRoles, createRole, editRole, deleteRolePermanently, getUserBySearch, registerForPOS } = require('../controllers/userController.js');
const { protect, authorize } = require('../middleware/authMiddleware.js');
const loginValidationRules = require('../dtos/loginDto.js');
const { createPermissiomValidationRules, deletePermissionValidationRules } = require('../dtos/permissionDto.js');
const { createRoleValidationRules, deleteRoleValidationRules } = require('../dtos/roleDto.js');
const validator = require('../middleware/validator');

const router = express.Router();

router.route('/register').post(register)
router.route('/profile').get(protect, getProfile)
router.route('/pos/register').post(protect, authorize('admin', 'super-admin'), registerForPOS)
router.route('/pos/search').get(protect, authorize('admin', 'super-admin'), getUserBySearch)
/* -------------------- AUTH -------------------- */
router.post('/login', loginValidationRules(), validator, login);

/* -------------------- PERMISSIONS -------------------- */
router.get('/permissions', protect, authorize('admin', 'super-admin'), getAllPermissions);
router.post(
  '/permissions',
  protect,
  authorize('admin', 'super-admin'),
  createPermissiomValidationRules(),
  validator,
  createPermission
);
router.delete(
  '/permissions/:id/delete',
  protect,
  authorize('admin', 'super-admin'),
  deletePermissionValidationRules(),
  validator,
  deletPermissionPermanently
);

/* -------------------- ROLES -------------------- */
router.get('/roles', protect, getAllRoles);
router.post(
  '/roles',
  protect,
  authorize('admin', 'super-admin'),
  createRoleValidationRules(),
  validator,
  createRole
);
router.patch(
  '/roles/:id',
  protect,
  authorize('admin', 'super-admin'),
  deleteRoleValidationRules(),
  validator,
  editRole
);
router.delete(
  '/roles/:id/delete',
  protect,
  authorize('admin', 'super-admin'),
  deleteRoleValidationRules(),
  validator,
  deleteRolePermanently
);

module.exports = router;