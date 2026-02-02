const { body } = require('express-validator');
const db = require("../models/index");
const { Product } = db;

const createValidationRules = () => {
  return [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .custom(async (value, { req }) => {
        const isExist = await Product.findOne({
          where: { name: value }
        });

        if (isExist) {
          throw new Error('A product already exists!');
        }
      }),
  ];
};


module.exports = { createValidationRules }