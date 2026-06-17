const asyncHandler = require("../middleware/asyncHandler");
const { Order, Company } = require("../models");
const ErrorResponse = require("../utils/errorresponse");

// Steadfast's delivery_status values mapped to our internal courier/order status.
const STATUS_MAP = {
  delivered: { courier_status: "delivered", order_status: "delivered" },
  partial_delivered: { courier_status: "delivered", order_status: "delivered" },
  cancelled: { courier_status: "cancelled", order_status: "cancelled" },
  delivery_cancelled: { courier_status: "cancelled", order_status: "cancelled" },
  hold: { courier_status: "in_transit", order_status: null },
  in_review: { courier_status: "in_transit", order_status: null },
  unknown: { courier_status: "returned", order_status: null },
};

// @route    POST /api/webhooks/steadfast/:company_id
// @desc     Receive delivery status push updates from Steadfast
// @access   Public (validated via shared secret)
exports.handleSteadfastWebhook = asyncHandler(async (req, res, next) => {
  const company = await Company.findByPk(req.params.company_id);
  if (!company || !company.steadfast_secret_key) {
    return next(new ErrorResponse("Unknown company", 404));
  }

  const providedSecret = req.headers["x-steadfast-secret"] || req.query.secret;
  if (providedSecret !== company.steadfast_secret_key) {
    return next(new ErrorResponse("Invalid webhook secret", 401));
  }

  const { consignment_id, tracking_code, delivery_status } = req.body;

  const order = await Order.findOne({
    where: { company_id: company.id, courier_consignment_id: consignment_id },
  });
  if (!order) return next(new ErrorResponse("Order not found for consignment", 404));

  const mapped = STATUS_MAP[delivery_status] || { courier_status: "in_transit", order_status: null };
  const updates = { courier_status: mapped.courier_status };
  if (tracking_code) updates.tracking_number = tracking_code;
  if (mapped.order_status) updates.status = mapped.order_status;

  await order.update(updates);

  res.status(200).json({ success: true });
});
