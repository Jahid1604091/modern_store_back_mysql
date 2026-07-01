const asyncHandler = require("../middleware/asyncHandler");
const { Order, Product, User, OrderItem, PaymentDetail, Company, sequelize, Sequelize } = require("../models");
const path = require("path");
const fs = require("fs");
const { invoiceGenerate } = require("../utils/invoiceGenerate");
const { per_page } = require("../utils/misc");
const { Op } = require("sequelize");
const dayjs = require("dayjs");
const ExcelExportService = require("../services/ExcelExportService");
const ErrorResponse = require("../utils/errorresponse");
const DateUtils = require("../utils/DateUtils");
const sendMail = require("../utils/sendEmail");
const { companyScopeWhere, resolveCompanyId } = require("../utils/companyScope");
const { computeDiscount } = require("./couponController");
const { Coupon } = require("../models");
const RiskGatingService = require("../services/courier/RiskGatingService");
const CourierBookingService = require("../services/courier/CourierBookingService");


//--------------------------------------------------------------
//---------------- C U S T O M E R ------------------------------
//--------------------------------------------------------------

// @route    POST /api/orders
// @desc     Create a new order
// @access   Protected
exports.createOrder = asyncHandler(async (req, res) => {
  const { orderItems = [], coupon_code } = req.body;

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
        selected_size: item.size || null,
      };
    });

    /* ============================
       3. Validate coupon & compute discount server-side
          (never trust a client-supplied discount amount)
    ============================ */
    let discount = 0;
    let appliedCouponCode = null;
    if (coupon_code) {
      const coupon = await Coupon.findOne({
        where: { company_id: req.user.company_id, code: String(coupon_code).trim().toUpperCase() },
        transaction,
      });
      if (
        coupon &&
        coupon.isCurrentlyValid() &&
        (coupon.min_order_amount == null || subtotal >= Number(coupon.min_order_amount))
      ) {
        discount = computeDiscount(coupon, subtotal);
        appliedCouponCode = coupon.code;
        await coupon.increment("used_count", { transaction });
      }
    }

    /* ============================
       4. Business Calculations
    ============================ */
    const SHIPPING_COST = 100;
    const FREE_SHIPPING_MIN = 1000;

    const taxableAmount = subtotal - discount;
    const shipping_cost =
      taxableAmount >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST;

    const total = taxableAmount + shipping_cost;

    /* ============================
       5. Create Order
    ============================ */
    const newOrder = await Order.create(
      {
        user_id: req.user.id,
        company_id: req.user.company_id,
        subtotal,
        discount,
        coupon_code: appliedCouponCode,
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

    /* ============================
         6. Update Stock & Trigger Low Stock Alerts
      ============================ */
    for (const item of processedOrderItems) {
      const product = productMap[item.product_id];

      // Reduce stock
      product.stock_quantity -= item.order_quantity;

      // Save updated stock
      await product.save({ transaction });

      // Trigger stock alert if below threshold
      if (product.stock_quantity <= product.min_stock_threshold) {
        //send notification
        const message = `${product.name} remains only ${product.stock_quantity} [${product.min_stock_threshold}], Please Restock!`
        await sendMail({
          email: 'jh409780@gmail.com',
          subject: 'Low Stock Alert',
          message
        })
        // await stockAlert(product); 
      }
    }

    /* ============================
       7. Commit Transaction
    ============================ */
    await transaction.commit();

    // Fire-and-forget: risk-check + auto-book must never delay or break checkout.
    runRiskGatingAndAutoBook(newOrder).catch((error) => {
      console.error(`Order ${newOrder.id}: risk gating failed`, error.message);
    });

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

async function runRiskGatingAndAutoBook(order) {
  const company = await Company.findByPk(order.company_id);
  if (!company) return;

  const { should_auto_book } = await RiskGatingService.evaluate(order, company);
  if (should_auto_book) {
    await CourierBookingService.bookOrder(order, company);
  }
}

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
        attributes: ['order_quantity', 'unit_price', 'selected_size'],
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
        attributes: ['order_quantity', 'unit_price', 'selected_size'],
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
      { model: Company, as: 'company', attributes: ["company_name", "address", "contact", "currency"] },
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
  const { start_date, end_date, format, status, payment_method, q } = req.query;

  const startDate = start_date ? new Date(start_date) : new Date(new Date().setHours(0, 0, 0, 0));
  const endDate = end_date ? new Date(end_date) : new Date(new Date().setHours(23, 59, 59, 999));

  const page = Number(req.query.page) || 1;
  const offset = per_page * (page - 1);

  const where = companyScopeWhere(req, {
    createdAt: {
      [Op.between]: [new Date(startDate), new Date(endDate)],
    },
  });

  if (status) where.status = status;
  if (payment_method) where.payment_method = payment_method;
  if (q && q.trim()) where.order_number = { [Op.like]: `%${q.trim()}%` };

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
        model: User,
        as: 'user',
        attributes: ['name']
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
      "risk_level",
      "courier_status",
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
    // Export must cover the whole filtered range, not just the current page.
    const allRows = await Order.findAll({
      include: [
        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: User, as: 'user', attributes: ['name'] },
      ],
      attributes: ["id", "order_number", "shipping_cost", "discount", "total", "status", "payment_status", "payment_method", "createdAt"],
      where,
      order: [["createdAt", "DESC"]],
    });

    const paymentBreakdown = await Order.findAll({
      attributes: ['payment_method',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total'],
      ],
      where,
      raw: true,
      group: ['payment_method'],
    });

    const topProducts = await OrderItem.findAll({
      attributes: [
        'product_id',
        [sequelize.col('product.name'), 'name'],
        [sequelize.fn('SUM', sequelize.col('order_quantity')), 'qty_sold'],
      ],
      include: [
        { model: Product, as: 'product', attributes: [] },
        { model: Order, as: 'items', where, attributes: [] },
      ],
      group: ['product_id', 'product.name'],
      order: [[sequelize.fn('SUM', sequelize.col('order_quantity')), 'DESC']],
      limit: 10,
      raw: true,
    });

    return await handleExcelExport(res, allRows, {
      startDate,
      endDate,
      summaryStats: summary,
      paymentBreakdown,
      topProducts,
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

  const where = companyScopeWhere(req, {
    createdAt: {
      [Op.between]: [new Date(start), new Date(end)],
    },
  });

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
      { model:PaymentDetail, as: 'payment_details', limit: 1 }
    ],
  });

  //@retrieve only paid at column 

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

// @route    POST /api/orders/:id/recheck-risk
// @desc     Re-run the COD fraud-check, bypassing the cache (e.g. after a confirmation call)
// @access   Admin
exports.recheckRisk = asyncHandler(async (req, res, next) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return next(new ErrorResponse("Order Not Found", 404));

  const company = await Company.findByPk(order.company_id);
  if (!company) return next(new ErrorResponse("Company Not Found", 404));

  const result = await RiskGatingService.evaluate(order, company, { skipCache: true });

  res.status(200).json({
    success: true,
    data: { risk_level: order.risk_level, risk_score: order.risk_score, should_auto_book: result.should_auto_book },
  });
});

// @route    POST /api/orders/:id/book-courier
// @desc     Manually book the order with Steadfast, overriding the risk gate
// @access   Admin
exports.bookCourier = asyncHandler(async (req, res, next) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return next(new ErrorResponse("Order Not Found", 404));

  if (order.courier_status === "booked" || order.courier_status === "in_transit") {
    return next(new ErrorResponse(`Order is already ${order.courier_status} with the courier`, 400));
  }

  const company = await Company.findByPk(order.company_id);
  if (!company) return next(new ErrorResponse("Company Not Found", 404));

  const result = await CourierBookingService.bookOrder(order, company);

  res.status(result.booked ? 200 : 422).json({
    success: result.booked,
    msg: result.booked ? "Order booked with Steadfast!" : result.reason,
    data: { courier_status: order.courier_status, courier_tracking_code: order.courier_tracking_code },
  });
});

// @route    GET /api/orders/overview
// @desc     Get summary of all orders and others
// @access   Admin
exports.getOrdersOverview = asyncHandler(async (req, res) => {
  const where = companyScopeWhere(req);
  const { count, rows } = await Product.findAndCountAll({
    where: { ...where, stock_quantity: { [Op.lt]: sequelize.col('min_stock_threshold'), } }
  });
  const overview = await Order.findOne({
    where,
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

// @route    GET /api/orders/dashboard-stats?days=14
// @desc     Sales trend, order status breakdown, top products, payment method
//           breakdown, and recent orders — powers the admin dashboard charts.
// @access   Admin
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const where = companyScopeWhere(req, {
    createdAt: { [Op.between]: [start, end] },
  });

  // ── Daily revenue / order count trend (zero-filled for days with no orders)
  const trendRows = await Order.findAll({
    where,
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
      [sequelize.fn('SUM', sequelize.col('total')), 'revenue'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    raw: true,
  });
  const trendMap = {};
  trendRows.forEach((r) => {
    const key = typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10);
    trendMap[key] = { orders: Number(r.orders) || 0, revenue: Number(r.revenue) || 0 };
  });
  const trend = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trend.push({ date: key, orders: trendMap[key]?.orders || 0, revenue: trendMap[key]?.revenue || 0 });
  }

  // ── Order status breakdown (all statuses, including zero counts)
  const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const statusRows = await Order.findAll({
    where,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const statusMap = {};
  statusRows.forEach((r) => { statusMap[r.status] = Number(r.count) || 0; });
  const status_breakdown = STATUSES.map((s) => ({ status: s, count: statusMap[s] || 0 }));

  // ── Top 5 products by units sold
  const topProductRows = await OrderItem.findAll({
    attributes: [
      'product_id',
      [sequelize.col('product.name'), 'name'],
      [sequelize.fn('SUM', sequelize.col('order_quantity')), 'qty_sold'],
    ],
    include: [
      { model: Product, as: 'product', attributes: [] },
      { model: Order, as: 'items', where, attributes: [] },
    ],
    group: ['product_id', 'product.name'],
    order: [[sequelize.fn('SUM', sequelize.col('order_quantity')), 'DESC']],
    limit: 5,
    raw: true,
  });
  const top_products = topProductRows.map((p) => ({
    product_id: p.product_id,
    name: p.name,
    qty_sold: Number(p.qty_sold) || 0,
  }));

  // ── Payment method breakdown
  const paymentRows = await Order.findAll({
    where,
    attributes: ['payment_method',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('total')), 'total'],
    ],
    group: ['payment_method'],
    raw: true,
  });
  const payment_breakdown = paymentRows.map((p) => ({
    payment_method: p.payment_method || 'unknown',
    count: Number(p.count) || 0,
    total: Number(p.total) || 0,
  }));

  // ── 5 most recent orders (regardless of the trend date range)
  const recent_orders = await Order.findAll({
    where: companyScopeWhere(req),
    include: [{ model: User, as: 'user', attributes: ['name'] }],
    attributes: ['id', 'order_number', 'total', 'status', 'payment_status', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  res.status(200).json({
    success: true,
    data: { trend, status_breakdown, top_products, payment_breakdown, recent_orders },
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
        selected_size: item.size || null,
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
        company_id: resolveCompanyId(req),
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
      { model: Company, as: 'company', attributes: ["company_name", "address", "contact", "currency"] },
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
// @route    GET /api/orders/z-report?date=YYYY-MM-DD
// @desc     Day-end Z-report for POS: totals, payment breakdown, top products
// @access   Protected (Admin)
exports.getZReport = asyncHandler(async (req, res) => {
  const dateStr = req.query.date || dayjs().format('YYYY-MM-DD');
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  // Use local midnight for start and end
  const startLocal = dayjs(dateStr).startOf('day').toDate();
  const endLocal   = dayjs(dateStr).endOf('day').toDate();

  const company_id = resolveCompanyId(req);
  const where = {
    company_id,
    createdAt: { [Op.between]: [startLocal, endLocal] },
  };

  const [
    totalOrders,
    totalSales,
    totalDiscount,
    paymentBreakdown,
    topProducts,
    statusBreakdown,
  ] = await Promise.all([
    Order.count({ where }),
    Order.sum('total',    { where }),
    Order.sum('discount', { where }),
    Order.findAll({
      attributes: [
        'payment_method',
        [sequelize.fn('COUNT', sequelize.col('Order.id')), 'order_count'],
        [sequelize.fn('SUM',   sequelize.col('total')),   'total_amount'],
      ],
      where,
      group: ['payment_method'],
      raw: true,
    }),
    OrderItem.findAll({
      attributes: [
        'product_id',
        [sequelize.col('product.name'), 'product_name'],
        [sequelize.fn('SUM', sequelize.col('order_quantity')), 'total_qty'],
        [sequelize.literal('SUM(order_quantity * unit_price)'), 'total_revenue'],
      ],
      include: [
        { model: Product, as: 'product', attributes: [] },
        { model: Order,   as: 'items',   where, attributes: [] },
      ],
      group: ['product_id', 'product.name'],
      order: [[sequelize.literal('total_qty'), 'DESC']],
      limit: 10,
      raw: true,
    }),
    Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('Order.id')), 'count'],
      ],
      where,
      group: ['status'],
      raw: true,
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      date: dateStr,
      total_orders: totalOrders || 0,
      gross_sales:  Number(totalSales   || 0).toFixed(2),
      total_discount: Number(totalDiscount || 0).toFixed(2),
      net_sales: Number((totalSales || 0) - (totalDiscount || 0)).toFixed(2),
      payment_breakdown: paymentBreakdown,
      top_products: topProducts,
      status_breakdown: statusBreakdown,
    },
  });
});
