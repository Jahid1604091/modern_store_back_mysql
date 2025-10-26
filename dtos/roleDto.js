const { body, param } = require('express-validator');

const createRoleValidationRules = () => {
    return [
        body('role_name').trim().escape().notEmpty().withMessage('Role Name is required'),
    ]
}

const deleteRoleValidationRules = () => {
    return [
        param('id')
            .notEmpty().withMessage('Role ID is required')
            .isInt({ gt: 0 }).withMessage('Role ID must be a positive integer'),
    ];
};


module.exports = { createRoleValidationRules, deleteRoleValidationRules }