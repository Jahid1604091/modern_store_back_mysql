const { body } = require('express-validator');

const loginValidationRules = () => {
   
    return [
        body('password', "Invalid Password").notEmpty().withMessage('Password is required')
            .trim(),

        body('email', "Invalid Email").notEmpty().withMessage('Email is required')
            .trim()
    ]
}

module.exports = loginValidationRules