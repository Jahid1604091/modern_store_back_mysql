const asyncHandler = require("../middleware/asyncHandler.js");
const ErrorResponse = require("../utils/errorresponse.js");
const db = require("../models/index.js");
const { SubscriptionRequest, Company, User } = db;
const PLANS = require("../config/plans.js");

// @route  POST /api/subscription-requests
// @desc   Company admin applies for a plan upgrade/change (requires platform admin approval)
// @access Admin (company)
exports.createRequest = asyncHandler(async (req, res, next) => {
  const { requested_plan, message } = req.body;
  const company_id = req.user.company_id;

  if (!company_id) {
    return next(new ErrorResponse("Only company accounts can request a plan change.", 400));
  }

  if (!requested_plan || !PLANS[requested_plan]) {
    return next(new ErrorResponse("A valid requested_plan is required.", 400));
  }

  const company = await Company.findByPk(company_id);
  if (!company) return next(new ErrorResponse("Company not found.", 404));

  if (requested_plan === company.subscription_plan) {
    return next(new ErrorResponse("You are already on this plan.", 400));
  }

  const existingPending = await SubscriptionRequest.findOne({
    where: { company_id, status: "pending" },
  });
  if (existingPending) {
    return next(new ErrorResponse("You already have a pending plan request.", 400));
  }

  const request = await SubscriptionRequest.create({
    company_id,
    requested_plan,
    current_plan: company.subscription_plan,
    message: message || null,
    requested_by: req.user.id,
  });

  res.status(201).json({ success: true, msg: "Plan change request submitted.", data: request });
});

// @route  GET /api/subscription-requests/mine
// @desc   List the logged-in company's own subscription requests
// @access Admin (company)
exports.getMyRequests = asyncHandler(async (req, res, next) => {
  if (!req.user.company_id) {
    return next(new ErrorResponse("Only company accounts have subscription requests.", 400));
  }

  const requests = await SubscriptionRequest.findAll({
    where: { company_id: req.user.company_id },
    order: [["createdAt", "DESC"]],
  });

  res.status(200).json({ success: true, data: requests });
});

// @route  GET /api/subscription-requests?status=pending
// @desc   List all subscription requests across companies
// @access Platform admin
exports.getAllRequests = asyncHandler(async (req, res, next) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;

  const requests = await SubscriptionRequest.findAll({
    where,
    include: [
      { model: Company, as: "company", attributes: ["id", "company_name", "subdomain"] },
      { model: User, as: "requester", attributes: ["id", "name", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });

  res.status(200).json({ success: true, data: requests });
});

// @route  PATCH /api/subscription-requests/:id
// @desc   Approve or reject a pending request
// @access Platform admin
exports.reviewRequest = asyncHandler(async (req, res, next) => {
  const { action, admin_note } = req.body;

  if (!["approve", "reject"].includes(action)) {
    return next(new ErrorResponse("action must be 'approve' or 'reject'.", 400));
  }

  const request = await SubscriptionRequest.findByPk(req.params.id);
  if (!request) return next(new ErrorResponse("Request not found.", 404));
  if (request.status !== "pending") {
    return next(new ErrorResponse("This request has already been reviewed.", 400));
  }

  if (action === "approve") {
    const company = await Company.findByPk(request.company_id);
    if (!company) return next(new ErrorResponse("Company not found.", 404));

    const plan = PLANS[request.requested_plan];
    await company.update({
      subscription_plan: request.requested_plan,
      max_users: plan.max_users,
      max_products: plan.max_products,
      trial_ends_at: request.requested_plan === "trial" ? company.trial_ends_at : null,
    });
  }

  await request.update({
    status: action === "approve" ? "approved" : "rejected",
    admin_note: admin_note || null,
    reviewed_by: req.user.id,
    reviewed_at: new Date(),
  });

  res.status(200).json({
    success: true,
    msg: `Request ${action === "approve" ? "approved" : "rejected"}.`,
    data: request,
  });
});
