const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const db = require('../models/index');
const { User, Role, Permission, RolePermission} = db;
const { Op } = require('sequelize');
const ErrorResponse = require('../utils/errorresponse');
const dotenv = require('dotenv');

dotenv.config();

const protect = asyncHandler(async (req, res, next) => {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new ErrorResponse('Unauthorized user', 401));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findOne({
            where: { id: decoded.id },
            include: {
                model: Role,
                as: 'roles',
                attributes: ['name','id'],
                through: { attributes: [] },
            },
        });

        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        req.user = user;
        next();
    } catch (error) {
        return next(new ErrorResponse('Unauthorized user', 401));
    }
});

const optionalAuth = asyncHandler(async (req, res, next) => {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({
            where: { email: decoded.email },
            include: {
                model: Role,
                as: 'roles',
                attributes: ['name'],
                through: { attributes: [] },
            },
        });

        req.user = user;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
});

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return next(new ErrorResponse('Access denied. No role assigned.', 403));
        }

        const userRoles = req.user.roles.map(role => role.name);
        const hasRole = userRoles.some(role => allowedRoles.includes(role));

        if (!hasRole) {
            return next(
                new ErrorResponse(
                    `Access denied. Required roles: ${allowedRoles.join(', ')}`,
                    403
                )
            );
        }

        next();
    };
};

const checkPermission = (permissionKeys, requireAll = false) => {
  return async (req, res, next) => {
    try {
      // Check if user exists and has roles
      if (!req.user || !req.user.roles || !Array.isArray(req.user.roles) || req.user.roles.length === 0) {
        return next(new ErrorResponse('Access denied. No roles found.', 403));
      }

      // Extract role IDs from user's roles array
      const userRoleIds = req.user.roles.map(role => role.id);

      // Find user's permissions through their roles
      const userPermissions = await RolePermission.findAll({
        include: [
          {
            model: Permission,
            required: true,
           
          }
        ],
        where: {
          role_id: {
            [Op.in]: userRoleIds
          }
        }
      });

      // Extract permission names
      const userPermissionNames = userPermissions.map(rp => rp.Permission.name);

      // Check if user has required permissions
      let hasAccess = false;

      if (requireAll) {
        // User must have ALL specified permissions
        hasAccess = permissionKeys.every(permission => 
          userPermissionNames.includes(permission)
        );
      } else {
        // User must have AT LEAST ONE of the specified permissions
        hasAccess = permissionKeys.some(permission => 
          userPermissionNames.includes(permission)
        );
      }

      if (!hasAccess) {
        const requiredPerms = Array.isArray(permissionKeys) ? permissionKeys.join(', ') : permissionKeys;
        return next(new ErrorResponse(
          `Access denied. Required permission(s): ${requiredPerms}`, 
          403
        ));
      }

      // Optionally attach user permissions to request for later use
      req.userPermissions = userPermissionNames;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return next(new ErrorResponse('Error checking permissions', 500));
    }
  };
};

module.exports = {
    protect,
    authorize,
    optionalAuth,
    checkPermission
};
