const asyncHandler = require("../middleware/asyncHandler.js");
const db = require("../models/index.js");
const { Coupon } = db;
const { Op } = require("sequelize");
const ErrorResponse = require("../utils/errorresponse.js");
const { companyScopeWhere, resolveCompanyId } = require("../utils/companyScope.js");

function computeDiscount(coupon, subtotal) {
  let discount = coupon.discount_type === "percent"
    ? (subtotal * Number(coupon.discount_value)) / 100
    : Number(coupon.discount_value);

  if (coupon.max_discount_amount != null) {
    discount = Math.min(discount, Number(coupon.max_discount_amount));
  }
  return Math.min(Math.round(discount * 100) / 100, subtotal);
}

// @route  GET /api/coupons
// @desc   List all coupons for the admin's company
// @access Admin
exports.getCoupons = asyncHandler(async (req, res, next) => {
  const coupons = await Coupon.findAll({
    where: companyScopeWhere(req),
    order: [["createdAt", "DESC"]],
  });
  res.status(200).json({ success: true, data: coupons });
});

// @route  POST /api/coupons
// @desc   Create a coupon (scoped to admin's company)
// @access Admin
exports.createCoupon = asyncHandler(async (req, res, next) => {
  const company_id = resolveCompanyId(req);
  if (!company_id) return next(new ErrorResponse("company_id is required.", 400));

  const {
    code, description, discount_type, discount_value,
    min_order_amount, max_discount_amount, usage_limit,
    starts_at, expires_at, is_active, is_featured,
  } = req.body;

  if (!code || !discount_value) {
    return next(new ErrorResponse("code and discount_value are required.", 400));
  }

  const existing = await Coupon.findOne({ where: { company_id, code: code.trim().toUpperCase() } });
  if (existing) return next(new ErrorResponse("A coupon with this code already exists.", 400));

  const coupon = await Coupon.create({
    company_id,
    code,
    description: description || null,
    discount_type: discount_type === "fixed" ? "fixed" : "percent",
    discount_value,
    min_order_amount: min_order_amount || null,
    max_discount_amount: max_discount_amount || null,
    usage_limit: usage_limit || null,
    starts_at: starts_at || null,
    expires_at: expires_at || null,
    is_active: is_active === undefined ? true : !!is_active,
    is_featured: !!is_featured,
  });

  res.status(201).json({ success: true, msg: "Coupon created successfully!", data: coupon });
});

// @route  PATCH /api/coupons/:id
// @desc   Update a coupon (own company only)
// @access Admin
exports.updateCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findOne({ where: companyScopeWhere(req, { id: req.params.id }) });
  if (!coupon) return next(new ErrorResponse("Coupon not found!", 404));

  const {
    code, description, discount_type, discount_value,
    min_order_amount, max_discount_amount, usage_limit,
    starts_at, expires_at, is_active, is_featured,
  } = req.body;

  await coupon.update({
    code: code ?? coupon.code,
    description: description ?? coupon.description,
    discount_type: discount_type ?? coupon.discount_type,
    discount_value: discount_value ?? coupon.discount_value,
    min_order_amount: min_order_amount !== undefined ? (min_order_amount || null) : coupon.min_order_amount,
    max_discount_amount: max_discount_amount !== undefined ? (max_discount_amount || null) : coupon.max_discount_amount,
    usage_limit: usage_limit !== undefined ? (usage_limit || null) : coupon.usage_limit,
    starts_at: starts_at !== undefined ? (starts_at || null) : coupon.starts_at,
    expires_at: expires_at !== undefined ? (expires_at || null) : coupon.expires_at,
    is_active: is_active !== undefined ? !!is_active : coupon.is_active,
    is_featured: is_featured !== undefined ? !!is_featured : coupon.is_featured,
  });

  res.status(200).json({ success: true, msg: "Coupon updated successfully!", data: coupon });
});

// @route  DELETE /api/coupons/:id
// @desc   Delete a coupon (own company only)
// @access Admin
exports.deleteCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findOne({ where: companyScopeWhere(req, { id: req.params.id }) });
  if (!coupon) return next(new ErrorResponse("Coupon not found!", 404));

  await coupon.destroy();
  res.status(200).json({ success: true, msg: "Coupon deleted successfully!" });
});

// @route  GET /api/coupons/featured?company_id=X
// @desc   Public: the single active+featured coupon to advertise in the storefront banner, if any.
// @access Public
exports.getFeaturedCoupon = asyncHandler(async (req, res, next) => {
  const { company_id } = req.query;
  if (!company_id) return next(new ErrorResponse("company_id query parameter is required.", 400));

  const now = new Date();
  const coupon = await Coupon.findOne({
    where: {
      company_id,
      is_active: true,
      is_featured: true,
      [Op.and]: [
        { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: now } }] },
        { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gte]: now } }] },
      ],
    },
    order: [["createdAt", "DESC"]],
  });

  if (!coupon || !coupon.isCurrentlyValid()) {
    return res.status(200).json({ success: true, data: null });
  }

  res.status(200).json({
    success: true,
    data: {
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount,
    },
  });
});

// @route  POST /api/coupons/validate
// @desc   Public: validate a coupon code against the cart subtotal and return the discount.
//         The discount is recomputed server-side again at checkout — this is for instant UI feedback.
// @access Public
exports.validateCoupon = asyncHandler(async (req, res, next) => {
  const { code, company_id, subtotal } = req.body;
  if (!code || !company_id) {
    return next(new ErrorResponse("code and company_id are required.", 400));
  }

  const coupon = await Coupon.findOne({
    where: { company_id, code: String(code).trim().toUpperCase() },
  });

  if (!coupon) {
    return res.status(404).json({ success: false, msg: "Invalid coupon code." });
  }
  if (!coupon.isCurrentlyValid()) {
    return res.status(400).json({ success: false, msg: "This coupon is no longer valid." });
  }
  const cartSubtotal = Number(subtotal) || 0;
  if (coupon.min_order_amount != null && cartSubtotal < Number(coupon.min_order_amount)) {
    return res.status(400).json({
      success: false,
      msg: `This coupon requires a minimum order of ${coupon.min_order_amount}.`,
    });
  }

  const discount_amount = computeDiscount(coupon, cartSubtotal);

  res.status(200).json({
    success: true,
    msg: "Coupon applied!",
    data: { code: coupon.code, discount_amount, discount_type: coupon.discount_type, discount_value: coupon.discount_value },
  });
});

exports.computeDiscount = computeDiscount;
