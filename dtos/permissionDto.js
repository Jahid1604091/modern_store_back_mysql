const { body, param } = require('express-validator');

const createPermissiomValidationRules = () => {
    return [
        body('permission_name').trim().escape().notEmpty().withMessage('Permission Name is required'),
    ]
}

const deletePermissionValidationRules = () => {
    return [
        param('id')
            .notEmpty().withMessage('Permission ID is required')
            .isInt({ gt: 0 }).withMessage('Permission ID must be a positive integer'),
    ];
};


module.exports = { createPermissiomValidationRules, deletePermissionValidationRules }