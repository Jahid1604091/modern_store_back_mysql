const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler.js');
const User = require('../models/user.js');
const ErrorResponse = require('../utils/errorresponse.js');


const protect = asyncHandler(async(req,res,next)=>{
    let token = null;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }
    // else if(req.cookies.token){
    //     token = req.cookies.token
    // }

    if(!token){
        return next(new ErrorResponse('Unauthorized user',401));
    }

    try {
        //verify token
        const decoded = jwt.verify(token,process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        next();
    } catch (error) {
        
        return next(new ErrorResponse('Unauthorized user',401));

    }

});

const optionalAuth = asyncHandler(async(req,res,next)=>{
    let token = null;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }

    if(!token){
        req.user = null;
        return next();
    }

    try {
        //verify token
        const decoded = jwt.verify(token,process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        next();
    } catch (error) {
        
        return next(new ErrorResponse('Unauthorized user',401));

    }

});

//access for specific role
const authorize = (...roles) =>{
    return (req,res,next) => {
        if(!roles.includes(req.user.role)){
            return next(new ErrorResponse(`Role : ${req.user.role} - is not authorized to access`,403));

        }
        next();
    }
}

module.exports = {
    protect,
    authorize,
    optionalAuth
}