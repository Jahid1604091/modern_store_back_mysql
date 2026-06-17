const asyncHandler = require("../middleware/asyncHandler.js");
const ErrorResponse = require("../utils/errorresponse.js");
const db = require("../models/index");
const { User, Permission, Role, RolePermission, UserRole } = db;
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const { companyScopeWhere, resolveCompanyId } = require("../utils/companyScope.js");

// @route  POST /api/users/register
// @desc   Register a customer user for a specific company's storefront
// @access Public
const register = asyncHandler(async (req, res, next) => {
    const { email, company_id } = req.body;

    if (!company_id) {
        return next(new ErrorResponse("company_id is required for registration.", 400));
    }

    const isExist = await User.findOne({ where: { email, company_id } });
    if (isExist) {
        return next(new ErrorResponse("User already exists for this company.", 400));
    }

    const user = await User.create(req.body);
    if (user) {
        return res.status(201).json({
            success: true,
            msg: "User registration successful!",
            data: { id: user.id, name: user.name, email: user.email },
            token: user.getSignedJwtToken(),
        });
    }
    return next(new ErrorResponse("Invalid data", 400));
});

// @route  POST /api/users/login
// @access Public
const login = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({
        where: { email: req.body.email },
        include: [{
            model: Role,
            as: 'roles',
            attributes: ['id', 'name'],
            through: { attributes: [] },
            include: {
                model: Permission,
                as: 'permissions',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            }
        }]
    });

    if (user && (await user.matchPassword(req.body.password))) {
        return res.status(200).json({
            success: true,
            msg: "Login successful!",
            data: user,
            token: user.getSignedJwtToken(),
        });
    }
    return next(new ErrorResponse("Invalid email or password", 401));
});

// @route  GET /api/users/profile
// @access Private
const getProfile = asyncHandler(async (req, res, next) => {
    const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ["password"] },
    });
    if (!user) return next(new ErrorResponse("User not found", 404));
    return res.status(200).json({ success: true, msg: "User fetched successfully!", data: user });
});

// @route  GET /api/users/search?q=term
// @desc   Search users within the same company
// @access Admin
const getUserBySearch = asyncHandler(async (req, res, next) => {
    const { q } = req.query;
    const users = await User.findAll({
        where: companyScopeWhere(req, {
            [Op.or]: [
                { name: { [Op.like]: `%${q}%` } },
                { email: { [Op.like]: `%${q}%` } },
                { msisdn: { [Op.like]: `%${q}%` } },
            ],
        }),
        attributes: ['id', 'name', 'email', 'msisdn'],
    });
    res.json({ success: true, msg: 'Users found', data: users });
});

// @route  DELETE /api/users/:id/delete
// @access Admin
const deleteUserPermanently = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({
        where: companyScopeWhere(req, { id: req.params.id }),
    });
    if (!user) return next(new ErrorResponse('User not found!', 404));
    await user.destroy();
    return res.status(200).json({ success: true, msg: "User deleted successfully!" });
});

// @route  GET /api/users/roles
// @access Admin / Super-Admin
const getAllRoles = asyncHandler(async (req, res, next) => {
    const roleIds = req.user.roles.map(r => r.id);
    const hasSuperAdminRole = roleIds.includes(1);
    const hasAdminRole = roleIds.includes(2);

    let whereClause = {};
    if (hasSuperAdminRole) {
        whereClause = {};
    } else if (hasAdminRole) {
        whereClause = { id: { [Op.ne]: 1 } };
    } else {
        whereClause = { id: { [Op.in]: roleIds } };
    }

    const data = await Role.findAll({
        where: whereClause,
        attributes: ['id', 'name'],
        include: [{
            model: Permission,
            as: 'permissions',
            attributes: ['id', 'name'],
            through: { attributes: [] }
        }],
    });

    if (!data || data.length === 0) return next(new ErrorResponse('No roles found', 404));
    return res.status(200).json({ success: true, data });
});

// @route  POST /api/users/roles
// @access Admin
const createRole = asyncHandler(async (req, res, next) => {
    const { role_name, permission_ids } = req.body;

    const isExist = await Role.findOne({ where: { name: role_name } });
    if (isExist) return next(new ErrorResponse('Role already exists', 400));

    const newRole = await Role.create({ name: role_name });

    if (newRole && Array.isArray(permission_ids) && permission_ids.length > 0) {
        const validPermissions = await Permission.findAll({
            where: { id: { [Op.in]: permission_ids } }
        });
        if (validPermissions.length === 0) {
            return next(new ErrorResponse('No valid permissions found to assign', 400));
        }
        await RolePermission.bulkCreate(
            validPermissions.map(p => ({ role_id: newRole.id, permission_id: p.id }))
        );
    }

    return res.status(200).json({
        success: true,
        msg: "Role created successfully!",
        data: { role_id: newRole.id, role_name: newRole.name }
    });
});

// @route  PATCH /api/users/roles/:id
// @access Admin
const editRole = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { role_name, permission_ids } = req.body;

    if (!role_name) return next(new ErrorResponse("Role name is required", 400));

    const role = await Role.findByPk(id);
    if (!role) return next(new ErrorResponse("Role not found", 404));

    const existingRole = await Role.findOne({
        where: { name: role_name, id: { [Op.ne]: id } }
    });
    if (existingRole) return next(new ErrorResponse("Role name already exists", 400));

    role.name = role_name;
    await role.save();

    if (Array.isArray(permission_ids)) {
        await RolePermission.destroy({ where: { role_id: id } });
        const validPermissions = await Permission.findAll({
            where: { id: { [Op.in]: permission_ids } }
        });
        if (validPermissions.length === 0 && permission_ids.length > 0) {
            return next(new ErrorResponse("No valid permissions found to assign", 400));
        }
        const newMappings = validPermissions.map(p => ({ role_id: id, permission_id: p.id }));
        if (newMappings.length > 0) await RolePermission.bulkCreate(newMappings);
    }

    return res.status(200).json({
        success: true,
        msg: "Role updated successfully!",
        data: { role_id: role.id, role_name: role.name, updated_permissions: permission_ids || [] }
    });
});

// @route  DELETE /api/users/roles/:id/delete
// @access Admin
const deleteRolePermanently = asyncHandler(async (req, res, next) => {
    const role = await Role.findByPk(req.params.id);
    if (!role) return next(new ErrorResponse('Role not found!', 404));
    if (role.name === 'super-admin' || role.name === 'admin') {
        return next(new ErrorResponse('Super Admin or Admin role cannot be deleted!', 403));
    }
    await role.destroy();
    return res.status(200).json({ success: true, msg: `${role.name} deleted successfully!` });
});

// @route  GET /api/users/permissions
// @access Admin / Super-Admin
const getAllPermissions = asyncHandler(async (req, res, next) => {
    const roleIds = req.user.roles.map(r => r.id);
    const hasSuperAdminRole = roleIds.includes(1);

    if (hasSuperAdminRole) {
        const data = await Permission.findAll({ attributes: ['name', 'id'] });
        return res.status(200).json({ success: true, data });
    }

    const data = await RolePermission.findAll({
        where: { role_id: { [Op.in]: roleIds } },
        include: [{ model: Permission, attributes: ['name'] }],
        attributes: ['role_id', 'permission_id'],
        raw: true,
    });

    const transformedData = data.map(item => ({
        id: item.permission_id,
        name: item['Permission.name'],
    }));

    return res.status(200).json({ success: true, data: transformedData });
});

// @route  POST /api/users/permissions
// @access Admin
const createPermission = asyncHandler(async (req, res, next) => {
    const { permission_name } = req.body;
    const isExist = await Permission.findOne({ where: { name: permission_name } });
    if (isExist) return next(new ErrorResponse('Permission already exists', 400));

    const newPermission = await new Permission({ name: permission_name }).save();
    return res.status(200).json({
        success: true,
        msg: "Permission created successfully!",
        data: { permission_id: newPermission.id, permission_name: newPermission.name }
    });
});

// @route  DELETE /api/users/permissions/:id/delete
// @access Admin
const deletPermissionPermanently = asyncHandler(async (req, res, next) => {
    const permission = await Permission.findByPk(req.params.id);
    if (!permission) return next(new ErrorResponse('Permission not found!', 404));
    await permission.destroy();
    return res.status(200).json({ success: true, msg: `${permission.name} deleted successfully!` });
});

// @route  POST /api/users/pos/register
// @desc   Register a POS customer user (inherits admin's company)
// @access Admin
const registerForPOS = asyncHandler(async (req, res, next) => {
    const { email, msisdn } = req.body;
    const company_id = resolveCompanyId(req);
    if (!company_id) {
        return next(new ErrorResponse("company_id is required.", 400));
    }

    const isExist = await User.findOne({
        where: { company_id, [Op.or]: [{ email }, { msisdn }] }
    });
    if (isExist) return next(new ErrorResponse("User already exists", 400));

    const user = await User.create({ ...req.body, company_id, password: '123456' });
    return res.status(201).json({
        success: true,
        msg: "User creation successful!",
        data: { id: user.id, name: user.name, email: user.email },
    });
});

// @route  GET /api/users
// @desc   List all users within the company (admin)
// @access Admin
const getCompanyUsers = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where = companyScopeWhere(req);
    if (q) {
        where[Op.or] = [
            { name: { [Op.like]: `%${q}%` } },
            { email: { [Op.like]: `%${q}%` } },
            { msisdn: { [Op.like]: `%${q}%` } },
        ];
    }

    const { count, rows } = await User.findAndCountAll({
        where,
        attributes: ['id', 'name', 'email', 'msisdn', 'is_active', 'email_verified', 'createdAt'],
        include: [{
            model: Role,
            as: 'roles',
            attributes: ['id', 'name'],
            through: { attributes: [] },
        }],
        limit: Number(limit),
        offset,
        order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
        success: true,
        data: rows,
        pagination: { total: count, page: Number(page), limit: Number(limit), pages: Math.ceil(count / limit) },
    });
});

// @route  PATCH /api/users/:id/status
// @desc   Activate or deactivate a user within the company
// @access Admin
const updateUserStatus = asyncHandler(async (req, res, next) => {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
        return next(new ErrorResponse('is_active (boolean) is required.', 400));
    }

    const user = await User.findOne({
        where: companyScopeWhere(req, { id: req.params.id }),
    });
    if (!user) return next(new ErrorResponse('User not found.', 404));
    if (user.id === req.user.id) {
        return next(new ErrorResponse('You cannot deactivate your own account.', 400));
    }

    await user.update({ is_active });
    return res.status(200).json({ success: true, msg: `User ${is_active ? 'activated' : 'deactivated'}.`, data: { id: user.id, is_active } });
});

// @route  PATCH /api/users/:id/roles
// @desc   Update a user's roles within the company
// @access Admin
const updateUserRoles = asyncHandler(async (req, res, next) => {
    const { role_ids } = req.body;
    if (!Array.isArray(role_ids) || role_ids.length === 0) {
        return next(new ErrorResponse('role_ids array is required.', 400));
    }

    const user = await User.findOne({
        where: companyScopeWhere(req, { id: req.params.id }),
    });
    if (!user) return next(new ErrorResponse('User not found.', 404));

    const { UserRole } = db;
    await UserRole.destroy({ where: { user_id: user.id } });
    await UserRole.bulkCreate(role_ids.map(role_id => ({ user_id: user.id, role_id })));

    return res.status(200).json({ success: true, msg: 'User roles updated.' });
});

module.exports = {
    register,
    login,
    getProfile,
    deleteUserPermanently,
    getAllRoles,
    createRole,
    editRole,
    deleteRolePermanently,
    getAllPermissions,
    createPermission,
    deletPermissionPermanently,
    getUserBySearch,
    registerForPOS,
    getCompanyUsers,
    updateUserStatus,
    updateUserRoles,
};
