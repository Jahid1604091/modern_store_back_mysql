const asyncHandler = require("../middleware/asyncHandler.js");
const ErrorResponse = require("../utils/errorresponse.js");
const db = require("../models/index");
const { User } = db;

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
  const user = await User.findOne({ where: { email: req.body.email } });
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

module.exports = {
  register,
  login,
  getProfile,
};
