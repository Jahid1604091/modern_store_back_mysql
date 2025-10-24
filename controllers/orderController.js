const asyncHandler = require("../middleware/asyncHandler");
const db = require("../models/index");
const {Order, Product} = db;
const path = require("path");
const fs = require("fs");
const { invoiceGenerate } = require("../utils/invoiceGenerate");
const { per_page } = require("../utils/misc");

//--------------------------------------------------------------
//---------------- C U S T O M E R ------------------------------
//--------------------------------------------------------------

// @route    POST /api/orders
// @desc     Create a new order
// @access   Protected
exports.createOrder = asyncHandler(async function (req, res) {
  const order = new Order(Object.assign({}, req.body, { user: req.user.id }));
  const newOrder = await order.save();

  return res.status(200).json({
    success: true,
    data: newOrder,
    msg: "Order Creation Successful!",
  });
});

// @route    GET /api/orders/myorders
// @desc     Get logged-in user's orders
// @access   Protected
exports.getMyOrders = asyncHandler(async function (req, res) {
  const orders = await Order.find({ user: req.user.id });
  return res.status(200).json({
    success: true,
    data: orders,
  });
});

// @route    GET /api/orders/myorders/:id
// @desc     Get one specific order
// @access   Protected
exports.getMyOrder = asyncHandler(async function (req, res) {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "id name email"
  );
  return res.status(200).json({
    success: true,
    data: order,
  });
});

// @route    PUT /api/orders/myorders/:id/pay
// @desc     Update order to paid
// @access   Protected
exports.updateOrderToPaid = asyncHandler(async function (req, res) {
  const order = await Order.findById(req.params.id);
  order.isPaid = true;
  order.paidAt = Date.now();

  // increment sales count
  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);
    if (product) {
      product.sales += item.qty;
      await product.save();
    }
  }

  const updatedOrder = await order.save();
  return res.status(200).json({
    success: true,
    data: updatedOrder,
    msg: "Order Updated Successfully!",
  });
});

// @route    GET /api/orders/myorders/:id/invoice
// @desc     Generate invoice
// @access   Protected
exports.generateInvoice = asyncHandler(async function (req, res) {
  const __dirnameResolved = path.resolve();
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email"
  );

  const invoicesDir = path.join(__dirnameResolved, "invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const invoicePath = path.join(invoicesDir, `invoice_${order.id}.pdf`);

  const stream = res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment;filename=invoice.pdf",
  });

  await new Promise(function (resolve) {
    invoiceGenerate(
      order,
      invoicePath,
      function (chunk) {
        stream.write(chunk);
      },
      function () {
        stream.end();
      },
      resolve
    );
  });

  return res.status(200).json({
    success: true,
    data: invoicePath,
    msg: "Invoice Generated Successfully!",
  });
});

//--------------------------------------------------------------
//---------------- A D M I N -----------------------------------
//--------------------------------------------------------------

// @route    GET /api/orders
// @desc     Get all orders
// @access   Admin
exports.getAllOrders = asyncHandler(async function (req, res) {
  const page = Number(req.query.page) || 1;

  const orders = await Order.find({})
    .select(
      "_id shippingPrice taxPrice totalPrice isPaid isDelivered createdAt paidAt deliveredAt"
    )
    .limit(per_page)
    .skip(per_page * (page - 1));

  const totalOrders = await Order.countDocuments();

  return res.status(200).json({
    success: true,
    data: orders,
    count: totalOrders,
    page,
    pages: Math.ceil(totalOrders / per_page),
  });
});

// @route    GET /api/orders/:id
// @desc     Get single order details
// @access   Admin
exports.getOrder = asyncHandler(async function (req, res) {
  const orders = await Order.findById(req.params.id)
    .select("-updatedAt -__v")
    .populate("user", "id name email");

  return res.status(200).json({
    success: true,
    data: orders,
  });
});

// @route    PUT /api/orders/:id/change-to-delivered
// @desc     Update order to delivered
// @access   Admin
exports.updateToDelivered = asyncHandler(async function (req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({
      success: false,
      msg: "Order Not Found",
    });
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();
  const updatedOrder = await order.save();

  if (updatedOrder) {
    return res.status(200).json({
      success: true,
      msg: "Order Updated Successfully!",
    });
  } else {
    return res.status(400).json({
      success: false,
      msg: "Order Update to Delivered failed!",
    });
  }
});

// @route    GET /api/orders/overview
// @desc     Get summary of all orders
// @access   Admin
exports.getOrdersOverview = asyncHandler(async function (req, res) {
  const overview = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalPrice: { $sum: "$totalPrice" },
        totalOrders: { $sum: 1 },
        totalPaidOrders: {
          $sum: { $cond: ["$isPaid", 1, 0] },
        },
        totalDeliveredOrders: {
          $sum: { $cond: ["$isDelivered", 1, 0] },
        },
        totalOrderItems: { $sum: { $sum: "$orderItems.qty" } },
        uniqueUsers: { $addToSet: "$user" },
      },
    },
    {
      $project: {
        totalPrice: 1,
        totalOrders: 1,
        totalPaidOrders: 1,
        totalDeliveredOrders: 1,
        totalOrderItems: 1,
        totalUsers: { $size: "$uniqueUsers" },
      },
    },
  ]);

  return res.status(200).json({
    success: true,
    data: overview[0] || {},
  });
});
