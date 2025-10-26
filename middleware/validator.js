const { validationResult } = require("express-validator");
const ErrorResponse = require("../utils/errorresponse");

const validator = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  //const extractedErrors = [];
  //errors.array().map((err) => extractedErrors.push({ [err.param]: err.msg }));

  return next(new ErrorResponse(errors.array()[0].msg, 400));

  /*return res.status(422).json({
    errors: extractedErrors,
  });*/
};

module.exports = validator;
