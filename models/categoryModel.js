import mongoose from "mongoose";


const categorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    slug: {
        type: String,
        unique: true,
    },
    parentId: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isSoftDeleted: {
        type: Boolean,
        default: false
    },
    softDeletedAt: {
        type: Date,
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);
export default Category;