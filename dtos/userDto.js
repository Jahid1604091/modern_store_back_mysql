const { body, param } = require('express-validator');

const employeeRegisterValidationRules = () => {
    return [
        // Debug middleware to see what's in req.body
        body('employee_id')
            .custom((value, { req }) => {
                console.log('Validating employee_id:', value);
                console.log('Type of employee_id:', typeof value);
                console.log('Full req.body:', req.body);
                return true; // Continue with validation
            })
            .trim()
            .notEmpty()
            .withMessage('Employee ID is required'),

        body('name')
            .trim()
            .notEmpty()
            .withMessage('Employee name is required'),

        body('password')
            .trim()
            .notEmpty()
            .withMessage('Password is required'),

        body('role')
            .notEmpty()
            .withMessage('Role is required'),
    ];
};
const employeeUpdateValidationRules = () => {

    return [
        param('id')
            .notEmpty()
            .withMessage('Employee ID is required'),
        body('name')
            .optional()
            .isString().withMessage('Name must be a string')
            .trim(),

        body('password')
            .optional()
            .isString().withMessage('Password must be a string')
            .trim(),

        body('location_id')
            .optional()
            .isInt({ gt: 0 }).withMessage('Location Id must be a number'),

        body('company_id')
            .optional()
            .isInt({ gt: 0 }).withMessage('Company Id must be a number'),

        body('area_id')
            .optional()
            .isInt({ gt: 0 }).withMessage('Area Id must be a number')

    ]
}

const employeeFingerprintRegisterValidationRules = () => {

    return [
        body('employee_id')
            .notEmpty().withMessage('Employee Id is required')
            .isString().withMessage('Employee Id must be a string'),

    ]
}

module.exports = { employeeRegisterValidationRules, employeeUpdateValidationRules, employeeFingerprintRegisterValidationRules }