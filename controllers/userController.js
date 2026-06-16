const asyncHandler = require("../middleware/asyncHandler.js");
const ErrorResponse = require("../utils/errorresponse.js");
const db = require("../models/index");
const { User, Permission, Role } = db;
const Sequelize = require('sequelize');
const { Op } = Sequelize;
//@route    /api/users/register
//@desc     register a user
//@access   public
const register = asyncHandler(async (req, res, next) => {
    const isExist = await User.findOne({ where: { email: req.body.email } });
    if (isExist) {
        return next(new ErrorResponse("User Already Exist", 400));
    }
    const user = await User.create(req.body);
    if (user) {
        return res.status(201).json({
            success: true,
            msg: "User Creation Successful!",
            data: user,
            token: user.getSignedJwtToken(),
        });
    } else {
        return next(new ErrorResponse("Invalid Data", 400));
    }
});

//@desc     get auth user
//@route    POST     /api/users/login
//@access   public
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
        },
        ]

    });
    if (user && (await user.matchPassword(req.body.password))) {
        return res.status(200).json({
            success: true,
            msg: "Login Successful!",
            data: user,
            token: user.getSignedJwtToken(),
        });
    } else {
        return next(new ErrorResponse(`Invalid email or password`, 401));
    }
});

//@desc     get profile
//@route    GET     /api/users/profile
//@access   private
const getProfile = asyncHandler(async (req, res, next) => {
    const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ["password"] },
    });
    if (!user) {
        return next(new ErrorResponse("User not found", 404));
    }
    return res.status(200).json({
        success: true,
        msg: "User Fetched Successfully!",
        data: user,
    });
});

//@desc     get profile
//@route    GET     /api/users/search
//@access   private
const getUserBySearch = asyncHandler(async (req, res, next) => {
    const { q } = req.query;
    console.log(q)
    try {
        const users = await User.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${q}%` } },
                    { email: { [Op.like]: `%${q}%` } },
                    { msisdn: { [Op.like]: `%${q}%` } }
                ]
            },
            attributes: ['id', 'name', 'email', 'msisdn'],
            // limit: 10
        });
        res.json({ success: true, msg: 'Filtered Users', data: users });
    } catch (error) {
        res.status(500).json({ msg: 'Error searching users' });
    }

});

//@route    /api/users/:id/delete
//@desc     DELETE: delete a user
//@access   protected by admin
const deleteUserPermanently = asyncHandler(async (req, res, next) => {

    const user = await User.findByPk(req.params.id);

    if (!user) {
        return next(new ErrorResponse('No user Found to Delete!', 404));
    }

    if (user.avatar) {
        const __dirname = path.resolve();
        const imagePath = path.join(__dirname, user.avatar);

        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error(`Failed to delete image: ${imagePath}`, err);
                return next(new ErrorResponse('Failed to delete user image.', 500));
            }
        });
    }

    await user.destroy();

    return res.status(200).json({
        success: true,
        msg: "User deleted successfully!",
    });
})

//@desc     get all
//@route    GET     /api/users/roles
//@access   protected by admin/s-admin
const getAllRoles = asyncHandler(async (req, res, next) => {
    const roleIds = req.user.roles.map(r => r.id);
    const hasSuperAdminRole = roleIds.includes(1); // Super Admin
    const hasAdminRole = roleIds.includes(2); // Admin

    let whereClause = {};

    if (hasSuperAdminRole) {
        // Super Admin (role_id 1) can see ALL roles
        whereClause = {};
    } else if (hasAdminRole) {
        // Admin (role_id 2) can see all roles EXCEPT Super Admin (role_id 1)
        whereClause = {
            id: {
                [Op.ne]: 1
            }
        };
    } else {
        // Other users can only see their own roles or implement your business logic
        whereClause = {
            id: {
                [Op.in]: roleIds
            }
        };
    }

    const data = await Role.findAll({
        where: whereClause,
        attributes: ['id', 'name'],
        include: [
            {
                model: Permission,
                as: 'permissions',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            }
        ],
    });

    if (!data || data.length === 0) {
        return next(new ErrorResponse('No roles found', 404));
    }

    return res.status(200).json({
        success: true,
        data,
    });
});


//@route    /api/users/roles
//@desc     POST: create a new role
//@access   protected by admin
const createRole = asyncHandler(async (req, res, next) => {
    const { role_name, permission_ids } = req.body;

    const isExist = await Role.findOne({ where: { name: role_name } });
    if (isExist) {
        return next(new ErrorResponse('Role already exists', 400));
    }

    // Create new role
    const newRole = await Role.create({ name: role_name });

    // Validate and assign permissions
    if (newRole && Array.isArray(permission_ids) && permission_ids.length > 0) {
        // Fetch valid permissions
        const validPermissions = await Permission.findAll({
            where: {
                id: {
                    [Op.in]: permission_ids
                }
            }
        });

        if (validPermissions.length === 0) {
            return next(new ErrorResponse('No valid permissions found to assign', 400));
        }

        // Create entries in RolePermission table
        const rolePermissions = validPermissions.map(permission => ({
            role_id: newRole.id,
            permission_id: permission.id
        }));

        await RolePermission.bulkCreate(rolePermissions);
    }

    return res.status(200).json({
        success: true,
        msg: "Role created successfully!",
        data: {
            role_id: newRole.id,
            role_name: newRole.name
        }
    });
});

//@route    PUT /api/users/roles/:id
//@desc     Update role name and assigned permissions
//@access   Protected by admin

const editRole = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { role_name, permission_ids } = req.body;

    if (!role_name) {
        return next(new ErrorResponse("Role name is required", 400));
    }

    // Check if role exists
    const role = await Role.findByPk(id);
    if (!role) {
        return next(new ErrorResponse("Role not found", 404));
    }

    // Check for duplicate role name (excluding current role)
    const existingRole = await Role.findOne({
        where: {
            name: role_name,
            id: { [Op.ne]: id }
        }
    });

    if (existingRole) {
        return next(new ErrorResponse("Role name already exists", 400));
    }

    // Update role name
    role.name = role_name;
    await role.save();

    // If permission_ids are provided, update role-permission mapping
    if (Array.isArray(permission_ids)) {
        // Clear existing permissions
        await RolePermission.destroy({ where: { role_id: id } });

        // Validate permissions exist
        const validPermissions = await Permission.findAll({
            where: {
                id: { [Op.in]: permission_ids }
            }
        });

        if (validPermissions.length === 0 && permission_ids.length > 0) {
            return next(new ErrorResponse("No valid permissions found to assign", 400));
        }

        // Create new entries
        const newMappings = validPermissions.map(p => ({
            role_id: id,
            permission_id: p.id
        }));

        if (newMappings.length > 0) {
            await RolePermission.bulkCreate(newMappings);
        }
    }

    return res.status(200).json({
        success: true,
        msg: "Role updated successfully!",
        data: {
            role_id: role.id,
            role_name: role.name,
            updated_permissions: permission_ids || []
        }
    });
});


//@route    /api/users/roles/:id/delete
//@desc     DELETE: delete a  role
//@access   protected by admin
const deleteRolePermanently = asyncHandler(async (req, res, next) => {
    const id = req.params.id;
    const role = await Role.findByPk(id);

    if (!role) {
        return next(new ErrorResponse('No Role Found to Delete!', 404));
    }

    if (role.name === 'super-admin' || role.name === 'admin') {
        return next(new ErrorResponse('Super Admin or Admin Role cannot be deleted!', 403));
    }

    await role.destroy();

    return res.status(200).json({
        success: true,
        msg: `${role.name} deleted successfully!`,
    });
})

//@desc     get all
//@route    GET     /api/users/permissions
//@access   protected by admin/s-admin
const getAllPermissions = asyncHandler(async (req, res, next) => {
    const roleIds = req.user.roles.map(r => r.id);
    const hasSuperAdminRole = roleIds.includes(1); // Check if user has admin role (role_id 1)
    let data;
    if (hasSuperAdminRole) {
        data = await Permission.findAll({ attributes: ['name', 'id'] });
        return res.status(200).json({
            success: true,
            data,
        });
    } else {
        // For other roles, only get permissions assigned to their roles
        data = await RolePermission.findAll({
            where: {
                role_id: {
                    [Op.in]: roleIds // Use Op.in for multiple role IDs
                }
            },
            include: [
                {
                    model: Permission,
                    attributes: ['name'],
                }
            ],
            attributes: ['role_id', 'permission_id'],
            raw: true
        });
    }

    // Transform the data to desired format
    const transformedData = data.map(item => ({
        id: item.permission_id,
        name: item['Permission.name'],
        // role_id: item.role_id
    }));

    return res.status(200).json({
        success: true,
        data: transformedData,
    });
});


//@route    /api/users/permissions
//@desc     POST: create a new permission
//@access   protected by admin
const createPermission = asyncHandler(async (req, res, next) => {
    const { permission_name } = req.body;

    const isExist = await Permission.findOne({ where: { name: permission_name } });
    if (isExist) {
        return next(new ErrorResponse('Permission Already Exist', 400));
    }
    const permission = new Permission({
        name: permission_name,
    });
    const newPermission = await permission.save();

    const selectedData = {
        permission_id: newPermission.id,
        permission_name: newPermission.name,
    }

    return res.status(200).json({
        success: true,
        msg: "Permission created successfully!",
        data: selectedData
    });
})

//@route    /api/users/permissions/:id/delete
//@desc     DELETE: delete a  permission
//@access   protected by admin
const deletPermissionPermanently = asyncHandler(async (req, res, next) => {
    const id = req.params.id;
    const permission = await Permission.findByPk(id);

    if (!permission) {
        return next(new ErrorResponse('No Permission Found to Delete!', 404));
    }

    await permission.destroy();

    return res.status(200).json({
        success: true,
        msg: `${permission.name} deleted successfully!`,
    });
})

//@route    /api/pos/users/register
//@desc     register a user
//@access   protected by admin
const registerForPOS = asyncHandler(async (req, res, next) => {
    const { email, msisdn } = req.body;
    const isExist = await User.findOne({ where: { [Op.or]: { email, msisdn } } });
    if (isExist) {
        return next(new ErrorResponse("User Already Exist", 400));
    }
    const user = await User.create({ ...req.body, password: '123456' });
    if (user) {
        return res.status(201).json({
            success: true,
            msg: "User Creation Successful!",
            data: user,
            // token: user.getSignedJwtToken(),
        });
    } else {
        return next(new ErrorResponse("Invalid Data", 400));
    }
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
    registerForPOS
};
