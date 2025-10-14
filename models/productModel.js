import mongoose from "mongoose";

const reviewSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        rating: {
            type: Number,
            required: true,
        },
        comment: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const productSchema = mongoose.Schema(
    {
        //to track the creator of the product
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        name: {
            type: String,
            required: true,
        },
        slug: {
            type: String,
        },
        image: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        brand: {
            type: String,
            // ref: "Brand",
            // required: true,
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        price: {
            type: Number,
            required: true,
            default: 0,
        },
        countInStock: {
            type: Number,
            required: true,
            default: 0,
        },
        views: {
            type: Number,
            default: 0,
        },
        sales: {
            type: Number,
            default: 0,
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
        },
        currency: {
            type: String,
        },
        rating: {
            type: Number,
            required: true,
            default: 0,
        },
        numReviews: {
            type: Number,
            required: true,
            default: 0,
        },
        reviews: [reviewSchema]
    },
    {
        timestamps: true,
    }
);

const Product = mongoose.model("Product", productSchema);
export default Product;