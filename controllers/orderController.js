import asyncHandler from "../middleware/asyncHandler.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import path from 'path';
import { invoiceGenerate } from "../utils/invoiceGenerate.js";
import fs from 'fs';
import { per_page } from "../utils/misc.js";

//@route    /api/orders/
//@desc     post create a new order
//@access   protected
export const createOrder = asyncHandler(async (req, res) => {
    const order = new Order({ ...req.body, user: req.user._id })
    const newOrder = await order.save()
    return res.status(200).json({
        success: true,
        data: newOrder,
        msg: "Order Creation Successful!"
    });
})

//@route    /api/orders/myorders
//@desc     GET get my orders
//@access   protected
export const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id })
    return res.status(200).json({
        success: true,
        data: orders
    });
})

//@route    /api/orders/myorders/:id
//@desc     GET get one of my order details
//@access   protected
export const getMyOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'id name email')
    return res.status(200).json({
        success: true,
        data: order
    });
})

//@route    /api/orders/myorders/:id/pay
//@desc     put update order to paid
//@access   protected
export const updateOrderToPaid = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    order.isPaid = true;
    order.paidAt = Date.now();

    //increment the sales count in product table
    for (const item of order.orderItems) {
        const product = await Product.findById(item.product);
        if (product) {
            product.sales += item.qty;
            await product.save();
        }
    }

    // order.paymentResult = {
    //     id:req.body.id,
    //     status:req.body.status,
    //     update_time:req.body.update_time,
    //     email_address:req.body.payer.email_address,
    // }

    const updatedOrder = await order.save();
    return res.status(200).json({
        success: true,
        data: updatedOrder,
        msg: "Order Updated Successfully!"
    });
})


//@route    /api/orders/myorders/:id/invoice
//@desc     GET     generate an invoice
//@access   protected
export const generateInvoice = asyncHandler(async (req, res) => {
    const __dirname = path.resolve()
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    const invoicesDir = path.join(__dirname, 'invoices');
    if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
    }
    const invoicePath = path.join(invoicesDir, `invoice_${order._id}.pdf`);

    const stream = res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment;filename=invoice.pdf`,
    });

    await new Promise((resolve, reject) => {
        invoiceGenerate(order,
            invoicePath,
            (chunk) => stream.write(chunk),
            () => stream.end(),
            resolve
        );
    })

    // res.download(invoicePath);
    return res.status(200).json({
        success: true,
        data: invoicePath,
        msg: "Invoice Generated Successfully!"
    });
})

//--------------------------------------------------------------
//---------------- S Y S T E M      A D M I N ------------------
//--------------------------------------------------------------

//@route    /api/orders/
//@desc     GET all  orders
//@access   protected/Admin
export const getAllOrders = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1; //default page

    // Build the search query


    const orders = await Order.find({})
        .select('_id shippingPrice taxPrice totalPrice isPaid isDelivered createdAt paidAt deliveredAt')
        .limit(per_page)
        .skip(per_page * (page - 1))
    // .populate('user', 'id name')
    const totalOrders = await Order.countDocuments();
    return res.status(200).json({
        success: true,
        data: orders,
        count: totalOrders,
        page,
        pages: Math.ceil(totalOrders / per_page),
    });
})

//@route    /api/orders/:id
//@desc     GET all  orders
//@access   protected/Admin
export const getOrder = asyncHandler(async (req, res) => {
    const orders = await Order.findById(req.params.id)
        .select('-updatedAt -__v')
        .populate('user', 'id name email')
    return res.status(200).json({
        success: true,
        data: orders
    });
})

//@route    /api/orders/:id/change-to-delivered
//@desc     PUT   make order delivered
//@access   protected/Admin
export const updateToDelivered = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
        return res.status(404).json({
            success: false,
            msg: "Order Not Found"
        });
    }

    order.isDelivered = true;
    order.deliveredAt = Date.now();
    const updatedOrder = await order.save();

    if (updatedOrder) {
        return res.status(200).json({
            success: true,
            msg: "Order Updated Successfully!"
        });

    }
    else {
        return res.status(400).json({
            success: false,
            msg: "Order Update to Delivered failed!"
        });
    }
})

//@route    /api/orders/overview
//@desc     get   get summary of orders
//@access   protected/Admin
export const getOrdersOverview = asyncHandler(async (req, res) => {
    const overview = await Order.aggregate([
        {
            '$group': {
                '_id': null,
                'totalPrice': {
                    '$sum': '$totalPrice'
                },
                'totalOrders': {
                    '$sum': 1
                },
                'totalPaidOrders': {
                    '$sum': {
                        '$cond': [
                            'isPaid', 1, 0
                        ]
                    }
                },
                'totalDeliveredOrders': {
                    '$sum': {
                        '$cond': [
                            'isDelivered', 1, 0
                        ]
                    }
                },
                'totalOrderItems': {
                    '$sum': {
                        '$sum': '$orderItems.qty'
                    }
                },
                'uniqueUsers': {
                    '$addToSet': '$user'
                }
            }
        }, {
            '$project': {
                'totalPrice': 1,
                'totalOrders': 1,
                'totalPaidOrders': 1,
                'totalDeliveredOrders': 1,
                'totalOrderItems': 1,
                'totalUsers': {
                    '$size': '$uniqueUsers'
                }
            }
        }
    ]);
    return res.status(200).json({
        success: true,
        data: overview[0] || {}
    });
})

