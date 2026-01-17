const asyncHandler = require("../middleware/asyncHandler");
const { Order, Product, User, OrderItem, PaymentDetail, sequelize, Sequelize } = require("../models");
const path = require("path");
const fs = require("fs");
const { invoiceGenerate } = require("../utils/invoiceGenerate");
const { per_page } = require("../utils/misc");
const { Op } = require("sequelize");
const dayjs = require("dayjs");
const ExcelExportService = require("../services/ExcelExportService");
const ErrorResponse = require("../utils/errorresponse");
const DateUtils = require("../utils/DateUtils");


//--------------------------------------------------------------
//---------------- C U S T O M E R ------------------------------
//--------------------------------------------------------------

// @route    POST /api/orders
// @desc     Create a new order
// @access   Protected
exports.createOrder = asyncHandler(async (req, res) => {
  const { orderItems = [], discount } = req.body;

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

    // const discount = Math.round((subtotal * DISCOUNT_PERCENT) / 100);
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
        discount: +discount,
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
          attributes: ['id', 'name', 'price', 'image']
        }],
      },
      {
        model: PaymentDetail,
        as: 'payment_details',
        attributes: ['payable_amount', 'advance_paid', 'payment_medium']
      }
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
  // for (const item of order.OrderItems) {
  //   await Product.increment(
  //     { sales: item.qty },
  //     { where: { id: item.productId } }
  //   );
  // }

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
      { model: User, as: 'user', attributes: ["name", "email"] },
      { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
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
  const { start_date, end_date, format } = req.query;

  const startDate = start_date ? new Date(start_date) : new Date(new Date().setHours(0, 0, 0, 0));
  const endDate = end_date ? new Date(end_date) : new Date(new Date().setHours(23, 59, 59, 999));

  const page = Number(req.query.page) || 1;
  const offset = per_page * (page - 1);

  const where = {
    createdAt: {
      [Op.between]: [new Date(startDate), new Date(endDate)],
    },
  };

  const { rows, count } = await Order.findAndCountAll({
    include: [
      {
        model: OrderItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product'
          }
        ]
      },
      {
        model:User,
        as:'user',
        attributes:['name']
      }
    ],
    attributes: [
      "id",
      "order_number",
      "shipping_cost",
      "total",
      "status",
      "payment_status",
      "payment_method",
      "createdAt",
    ],
    // raw:true,
    where,
    limit: per_page,
    offset,
    // order: [["createdAt", "DESC"]],
  });

  const totalOrders = await Order.count({ where });
  const completedOrders = await Order.count({
    where: { ...where, status: 'delivered' }
  });
  const cancelledOrders = await Order.count({
    where: { ...where, status: 'cancelled' }
  });
  const pendingOrders = await Order.count({
    where: { ...where, status: 'pending' }
  });
  const totalSales = await Order.sum('total', { where }) || 0;
  const totalDiscount = await Order.sum('discount', { where }) || 0;
  const netSales = totalSales - totalDiscount;

  const averageOrderValue = totalOrders
    ? (totalSales / totalOrders).toFixed(2)
    : 0;
  // total quantity sold
  const totalItemsSold = await OrderItem.sum('order_quantity', {
    include: [
      {
        model: Order,
        as: 'items',
        where,
        attributes: [],
      },
    ],
  }) || 0;

  // unique products sold
  const uniqueProductsSold = await OrderItem.count({
    distinct: true,
    col: 'product_id',
    include: [
      {
        model: Order,
        as: 'items',
        where,
        attributes: [],
      },
    ],
  });

  const summary = {
    total_orders: totalOrders,
    pending_orders: pendingOrders,
    completed_orders: completedOrders,
    cancelled_orders: cancelledOrders,
    total_sales: totalSales,
    total_discount: totalDiscount,
    net_sales: netSales,
    average_order_value: averageOrderValue,
    total_items_sold: totalItemsSold,
    unique_products_sold: uniqueProductsSold,
  }

  if (format === 'excel') {
    return await handleExcelExport(res, rows, {
      startDate,
      endDate,
      summaryStats: summary,
      filters: {
        // location_id,
        // area_id,
        // user_id,
        // designation_id,
        // rff_point_id,
        // status,
      },
    });
  }
  else {
    res.status(200).json({
      success: true,
      pagination: {
        page,
        pages: Math.ceil(count / per_page),
      },
      summary,
      data: rows,
    });
  }

});

// @route    GET /api/orders
// @desc     Get all orders
// @access   Admin
exports.getSalesReport = asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  const start = start_date ? new Date(start_date) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = end_date ? new Date(end_date) : new Date(new Date().setHours(23, 59, 59, 999));

  const page = Number(req.query.page) || 1;
  const offset = per_page * (page - 1);

  const where = {
    createdAt: {
      [Op.between]: [new Date(start), new Date(end)],
    },
  };

  const { rows, count } = await Order.findAndCountAll({
    include: [
      {
        model: OrderItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product'
          }
        ]
      }
    ],
    attributes: [
      "id",
      "order_number",
      "shipping_cost",
      "total",
      "status",
      "payment_status",
      "createdAt",
    ],
    // raw:true,
    where,
    limit: per_page,
    offset,
    // order: [["createdAt", "DESC"]],
  });

  const totalOrders = await Order.count({ where });
  const completedOrders = await Order.count({
    where: { ...where, status: 'delivered' }
  });
  const cancelledOrders = await Order.count({
    where: { ...where, status: 'cancelled' }
  });
  const pendingOrders = await Order.count({
    where: { ...where, status: 'pending' }
  });
  const totalSales = await Order.sum('total', { where }) || 0;
  const totalDiscount = await Order.sum('discount', { where }) || 0;
  const netSales = totalSales - totalDiscount;

  const averageOrderValue = totalOrders
    ? (totalSales / totalOrders).toFixed(2)
    : 0;
  // total quantity sold
  const totalItemsSold = await OrderItem.sum('order_quantity', {
    include: [
      {
        model: Order,
        as: 'items',
        where,
        attributes: [],
      },
    ],
  }) || 0;

  // unique products sold
  const uniqueProductsSold = await OrderItem.count({
    distinct: true,
    col: 'product_id',
    include: [
      {
        model: Order,
        as: 'items',
        where,
        attributes: [],
      },
    ],
  });

  const paymentMethods = await Order.findAll({
    attributes: ['payment_method',
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_orders'],
      [sequelize.fn('SUM', sequelize.col('total')), 'total_amount'],
    ],
    where,
    raw: true,
    group: ['payment_method']
  });

  const productWiseSold = await OrderItem.findAll({
    attributes: [
      'product_id',
      [sequelize.col('product.name'), 'product_name'],
      [sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'total_orders'],
      [sequelize.fn('SUM', sequelize.col('order_quantity')), 'sold_quantity'],
    ],
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['price'],
      },
      {
        model: Order,
        as: 'items',
        where,           // date filter applied here
        attributes: [],
      },
    ],
    group: ['product_id', 'product.name'],
    order: [
      [sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'DESC'],
    ],
    // raw: true,
  });


  res.status(200).json({
    success: true,
    pagination: {
      page,
      pages: Math.ceil(count / per_page),
    },
    summary: {
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      completed_orders: completedOrders,
      cancelled_orders: cancelledOrders,
      total_sales: totalSales,
      total_discount: totalDiscount,
      net_sales: netSales,
      average_order_value: averageOrderValue,
    },
    items: {
      total_items_sold: totalItemsSold,
      unique_products_sold: uniqueProductsSold,
    },
    payments: paymentMethods,
    product_wise_sold: productWiseSold,
    data: rows,
    report_range: {
      start_date,
      end_date,
    },
  });
});

// @route    GET /api/orders/:id
// @desc     Get single order details
// @access   Admin
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, {
    attributes: { exclude: ["updatedAt"] },
    include: [
      { model: User, as: 'user', attributes: ["id", "name", "email"] },
      { model: OrderItem, as: 'items', attributes: { exclude: ["createdAt", "updatedAt"] }, include: { model: Product, as: 'product', attributes: ['id', 'name', 'price', 'image'] } },
    ],
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
    status: "delivered",
    delivered_at: new Date(),
  });

  res.status(200).json({
    success: true,
    msg: "Order Updated Successfully!",
  });
});

// @route    GET /api/orders/overview
// @desc     Get summary of all orders and others
// @access   Admin
exports.getOrdersOverview = asyncHandler(async (req, res) => {
  const { count, rows } = await Product.findAndCountAll({
    where: { stock_quantity: { [Op.lt]: sequelize.col('min_stock_threshold'), } }
  });
  const overview = await Order.findOne({
    attributes: [
      [sequelize.fn("SUM", sequelize.col("Order.total")), "totalPrice"],
      [sequelize.fn("COUNT", sequelize.col("Order.id")), "totalOrders"],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal("CASE WHEN status = 'delivered' THEN 1 ELSE 0 END")
        ),
        "totalPaidOrders",
      ],
      [
        sequelize.fn("SUM", sequelize.col("items.order_quantity")),
        "totalSold",
      ],
      [
        sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("items.product_id"))),
        "totalSoldItems",
      ],
      [
        sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("user_id"))),
        "totalUsers",
      ],
    ],
    include: [
      {
        model: OrderItem,
        as: 'items',
        attributes: [],
        required: false,
      }
    ],
    raw: true,
    subQuery: false,
  });

  res.status(200).json({
    success: true,
    data: { ...overview, outOfStock: count },
  });
});

// @route    POST /api/orders/pos
// @desc     Create a new order through admin
// @access   Protected
exports.createOrderForPOS = asyncHandler(async (req, res) => {
  const { orderItems = [], userId, discount } = req.body;

  if (!orderItems.length) {
    return res.status(400).json({
      success: false,
      msg: "Order items are required",
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      msg: "User ID is required",
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
       2. Validate Stock Availability
    ============================ */
    const stockErrors = [];

    orderItems.forEach(item => {
      const product = productMap[item.id];

      if (!product) {
        stockErrors.push(`Product ID ${item.id} not found`);
        return;
      }

      if (product.status !== 'active') {
        stockErrors.push(`${product.name} is not available for sale`);
      }

      if (product.stock_quantity < item.qty) {
        stockErrors.push(
          `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}, Requested: ${item.qty}`
        );
      }
    });

    if (stockErrors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        msg: "Stock validation failed",
        errors: stockErrors,
      });
    }

    /* ============================
       3. Calculate Subtotal
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
       4. Business Calculations
    ============================ */
    const SHIPPING_COST = 0;
    const TAX_PERCENT = 0;
    const DISCOUNT_PERCENT = 0;
    const FREE_SHIPPING_MIN = 1000;

    // const discount = Math.round((subtotal * DISCOUNT_PERCENT) / 100);
    const taxableAmount = subtotal - discount;
    const tax = Math.round((taxableAmount * TAX_PERCENT) / 100);

    const shipping_cost =
      taxableAmount >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST;

    const total = taxableAmount + tax + shipping_cost;

    /* ============================
       5. Create Order
    ============================ */
    const newOrder = await Order.create(
      {
        user_id: userId,
        subtotal,
        discount,
        tax,
        shipping_cost,
        total,
        shipping_address: req.body.shippingAddress || null,
        billing_address: req.body.billingAddress || null,
        payment_method: req.body.paymentMethod || 'cod',
        notes: req.body.notes || 'pos',
        payment_status: 'paid',
        status: 'delivered'
      },
      { transaction }
    );

    /* ============================
       6. Save Order Items
    ============================ */
    processedOrderItems.forEach(item => {
      item.order_id = newOrder.id;
    });

    await OrderItem.bulkCreate(processedOrderItems, { transaction });

    /* ============================
       7. Update Product Stock
    ============================ */
    const stockUpdatePromises = orderItems.map(item => {
      const product = productMap[item.id];
      return Product.decrement(
        { stock_quantity: item.qty },
        {
          where: { id: item.id },
          transaction,
        }
      );
    });

    await Promise.all(stockUpdatePromises);

    /* ============================
       8. Create Payment Details
    ============================ */
    await PaymentDetail.create(
      {
        order_id: newOrder.id,
        user_id: userId,
        payment_medium: req.body.paymentMethod || 'cod',
        advance_paid: newOrder.total,
        payable_amount: 0,
        paid_at: new Date(),
        delivered_by: req.user.id,
      },
      { transaction }
    );

    /* ============================
       9. Commit Transaction
    ============================ */
    await transaction.commit();

    /* ============================
       10. Fetch Complete Order with Items
    ============================ */
    const completeOrder = await Order.findByPk(newOrder.id, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'stock_quantity'],
            },
          ],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'msisdn'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: completeOrder,
      msg: "Order created successfully!",
    });

  } catch (error) {

    console.error('Order creation error:', error);

    res.status(500).json({
      success: false,
      msg: error.message || "Failed to create order",
    });
  }
});

// @route    GET /api/orders/pos/:id/invoice
// @desc     Generate invoice
// @access   Protected
exports.generateInvoiceForPOS = asyncHandler(async (req, res) => {
  const __dirnameResolved = path.resolve();

  const order = await Order.findByPk(req.params.id, {
    include: [
      { model: User, as: 'user', attributes: ["name", "email"] },
      { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
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

async function handleExcelExport(res, data, options) {
  try {
    const { startDate, endDate } = options || {};
    const formattedStart = DateUtils.formatDate(startDate, "YYYY-MM-DD");
    const formattedEnd = DateUtils.formatDate(endDate, "YYYY-MM-DD");
    const filename = `orders_report_${formattedStart}_to_${formattedEnd}.xlsx`;
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const workbook = await ExcelExportService.generateExcel(data, {
      ...options,
      formattedStart,
      formattedEnd,
    });
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    throw new ErrorResponse(`Excel export failed: ${error.message}`);
  }
}