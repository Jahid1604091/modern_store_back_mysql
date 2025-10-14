import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken'
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ["user", "admin","deliverable","super-admin"],
            default: "user",
        },
    },
    {
        timestamps: true, 
    }
);


//encrypt pass
userSchema.pre('save', async function (next) {
    //only run when changed
    if(!this.isModified('password')){
        next();
    }
    //else encrypt
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
})

//compare password
userSchema.methods.matchPassword = async function(plainPass){
    return await bcrypt.compare(plainPass,this.password)
}

//sign JWT
userSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRED_IN });
}

const User = mongoose.model("User", userSchema);

export default User;
