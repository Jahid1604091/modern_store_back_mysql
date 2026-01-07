const asyncHandler = require("../middleware/asyncHandler");
const { Order, Product, User, OrderItem, sequelize } = require("../models");
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
exports.createOrder = asyncHandler(async (req, res) => {
  const { orderItems = [] } = req.body;

  if (!orderItems.length) {
    return res.status(400).json({
      success: false,
      msg: "Order items are required",
    });
  }

  const transaction = await Order.sequelize.transaction();

  try {
    /* ============================
       1. Fetch products from DB
    ============================ */
    const productIds = orderItems.map(item => item.id);

    const products = await Product.findAll({
      where: { id: productIds },
      transaction,
    });

    if (products.length !== productIds.length) {
      throw new Error("One or more products not found");
    }

    const productMap = {};
    products.forEach(p => {
      productMap[p.id] = p;
    });

    /* ============================
       2. Calculate Subtotal
    ============================ */
    let subtotal = 0;

    const processedOrderItems = orderItems.map(item => {
      const product = productMap[item.id];
      const unitPrice = product.price;
      const lineTotal = unitPrice * item.qty;

      subtotal += lineTotal;

      return {
        product_id: product.id,
        unit_price: unitPrice,
        order_quantity: item.qty,
      };
    });

    /* ============================
       3. Business Calculations
    ============================ */
    //@ add these in DB
    const SHIPPING_COST = 100;
    const TAX_PERCENT = 5;
    const DISCOUNT_PERCENT = 10;
    const FREE_SHIPPING_MIN = 1000;

    const discount = Math.round((subtotal * DISCOUNT_PERCENT) / 100);
    const taxableAmount = subtotal - discount;
    const tax = Math.round((taxableAmount * TAX_PERCENT) / 100);

    const shipping_cost =
      taxableAmount >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST;

    const total = taxableAmount + tax + shipping_cost;

    /* ============================
       4. Create Order
    ============================ */
    const newOrder = await Order.create(
      {
        user_id: req.user.id,
        subtotal,
        discount,
        tax, //add this column later
        shipping_cost,
        total,
        shipping_address: req.body.shippingAddress,
        billing_address: req.body.billingAddress,
        notes: req.body.notes,
        payment_method: req.body.paymentMethod,
      },
      { transaction }
    );

    /* ============================
       5. Save Order Items
    ============================ */
    processedOrderItems.forEach(item => {
      item.order_id = newOrder.id;
    });

    await OrderItem.bulkCreate(processedOrderItems, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: newOrder,
      msg: "Order Creation Successful!",
    });

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});



// @route    GET /api/orders/myorders
// @desc     Get logged-in user's orders
// @access   Protected
exports.getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.findAll({
    include: [
      // {
      //   model: User,
      //   as: 'user',
      //   attributes: ["id", "name", "email"],
      // },
      {
        model: OrderItem,
        as: 'items',
        attributes: ['order_quantity', 'unit_price'],
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price']
        }],
      },
    ],
    where: { user_id: req.user.id },
    order: [["createdAt", "DESC"]],
  });

  res.status(200).json({
    success: true,
    data: orders,
  });
});

// @route    GET /api/orders/myorders/:id
// @desc     Get one specific order
// @access   Protected
exports.getMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    where: {
      id: req.params.id,
      user_id: req.user.id,
    },
    include: [
      {
        model: OrderItem,
        as: 'items',
        attributes: ['order_quantity', 'unit_price'],
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price','image']
        }],
      },
    ],
  });

  res.status(200).json({
    success: true,
    data: order,
  });
});


// @route    PUT /api/orders/myorders/:id/pay
// @desc     Update order to paid
// @access   Protected
exports.updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, {
    include: [{ model: OrderItem }],
  });

  if (!order) {
    return res.status(404).json({ success: false, msg: "Order not found" });
  }

  await order.update({
    isPaid: true,
    paidAt: new Date(),
  });

  // increment product sales
  for (const item of order.OrderItems) {
    await Product.increment(
      { sales: item.qty },
      { where: { id: item.productId } }
    );
  }

  res.status(200).json({
    success: true,
    data: order,
    msg: "Order Updated Successfully!",
  });
});


// @route    GET /api/orders/myorders/:id/invoice
// @desc     Generate invoice
// @access   Protected
exports.generateInvoice = asyncHandler(async (req, res) => {
  const __dirnameResolved = path.resolve();

  const order = await Order.findByPk(req.params.id, {
    include: [
      { model: User, attributes: ["name", "email"] },
      { model: OrderItem, include: [Product] },
    ],
  });

  const invoicesDir = path.join(__dirnameResolved, "invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const invoicePath = path.join(invoicesDir, `invoice_${order.id}.pdf`);

  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment;filename=invoice.pdf",
  });

  await new Promise((resolve) => {
    invoiceGenerate(
      order,
      invoicePath,
      (chunk) => res.write(chunk),
      () => {
        res.end();
        resolve();
      }
    );
  });
});


//--------------------------------------------------------------
//---------------- A D M I N -----------------------------------
//--------------------------------------------------------------

// @route    GET /api/orders
// @desc     Get all orders
// @access   Admin
exports.getAllOrders = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const offset = per_page * (page - 1);

  const { rows, count } = await Order.findAndCountAll({
    attributes: [
      "id",
      "shipping_cost",
      "total",
      "status",
      "createdAt",
      // "paidAt",
      // "deliveredAt",
    ],
    limit: per_page,
    offset,
    order: [["createdAt", "DESC"]],
  });

  res.status(200).json({
    success: true,
    data: rows,
    count,
    page,
    pages: Math.ceil(count / per_page),
  });
});


// @route    GET /api/orders/:id
// @desc     Get single order details
// @access   Admin
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, {
    attributes: { exclude: ["updatedAt"] },
    include: [{ model: User, attributes: ["id", "name", "email"] }],
  });

  res.status(200).json({
    success: true,
    data: order,
  });
});


// @route    PUT /api/orders/:id/change-to-delivered
// @desc     Update order to delivered
// @access   Admin
exports.updateToDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      msg: "Order Not Found",
    });
  }

  await order.update({
    isDelivered: true,
    deliveredAt: new Date(),
  });

  res.status(200).json({
    success: true,
    msg: "Order Updated Successfully!",
  });
});


// @route    GET /api/orders/overview
// @desc     Get summary of all orders
// @access   Admin
exports.getOrdersOverview = asyncHandler(async (req, res) => {
  const overview = await Order.findOne({
    attributes: [
      [sequelize.fn("SUM", sequelize.col("total")), "totalPrice"],
      [sequelize.fn("COUNT", sequelize.col("id")), "totalOrders"],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal("CASE WHEN status = 'delivered' THEN 1 ELSE 0 END")
        ),
        "totalPaidOrders",
      ],
      // [
      //   sequelize.fn(
      //     "SUM",
      //     sequelize.literal("CASE WHEN status = delivered THEN 1 ELSE 0 END")
      //   ),
      //   "totalDeliveredOrders",
      // ],
      [
        sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("user_id"))),
        "totalUsers",
      ],
    ],
    raw: true,
  });

  res.status(200).json({
    success: true,
    data: overview,
  });
});
