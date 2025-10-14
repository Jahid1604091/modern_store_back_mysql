import asyncHandler from "../middleware/asyncHandler.js";
import User from '../models/userModel.js';
import ErrorResponse from "../utils/errorresponse.js";

//@route    /api/users/register
//@desc     register a user
//@access   public
export const register = asyncHandler(async (req, res, next) => {
    const isExist = await User.findOne({ email: req.body.email });
    if (isExist) {
        return next(new ErrorResponse('User Already Exist', 400));
    }
    const user = await User.create(req.body);
    if (user) {
        return res.status(201).json({
            success: true,
            data: user,
            token: user.getSignedJwtToken(),
            msg: 'User Creation Successful!'
        });
    }
    else {
        return next(new ErrorResponse('Invalid Data', 400));
    }
})

//@desc     get auth user
//@route    POST     /api/users/login
//@access   public
export const login = asyncHandler(async (req, res, next) => {

    const user = await User.findOne({ email: req.body.email });
    if (user && (await user.matchPassword(req.body.password))) {
        return res.status(200).json({
            success: true,
            data: user,
            token: user.getSignedJwtToken(),
            msg: 'Login Successful!'
        });

    }
    else {
        return next(new ErrorResponse(`Invalid email or password`, 401));
    }
});

//@desc     get profile
//@route    GET     /api/users/profile
//@access   private
export const getProfile = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }
    return res.status(200).json({
        success: true,
        data: user
    });
});