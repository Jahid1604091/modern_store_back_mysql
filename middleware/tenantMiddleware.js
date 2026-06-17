const asyncHandler = require('./asyncHandler');
const ErrorResponse = require('../utils/errorresponse');
const db = require('../models/index');
const { Company } = db;

/**
 * Resolves the tenant (company) for the authenticated user and validates
 * subscription status. Must be used after the `protect` middleware.
 *
 * Sets req.company and req.company_id on success.
 */
const resolveTenant = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorResponse('Tenant not identified. Please login with a company account.', 400));
  }

  // Platform admin has no company of their own — only resolve a tenant if
  // they explicitly target one (e.g. acting on behalf of a company).
  if (req.user.company_id == null) {
    const targetCompanyId = req.query.company_id || req.body.company_id;
    if (!targetCompanyId) {
      return next();
    }
    const company = await Company.findByPk(targetCompanyId);
    if (!company) {
      return next(new ErrorResponse('Company not found.', 404));
    }
    req.company = company;
    req.company_id = company.id;
    return next();
  }

  const company = await Company.findByPk(req.user.company_id);

  if (!company) {
    return next(new ErrorResponse('Company not found.', 404));
  }

  if (!company.is_active) {
    return next(new ErrorResponse('Your company account has been deactivated. Please contact support.', 403));
  }

  if (company.subscription_status === 'suspended') {
    return next(new ErrorResponse('Your subscription has been suspended. Please contact support.', 403));
  }

  if (company.subscription_status === 'cancelled') {
    return next(new ErrorResponse('Your subscription has been cancelled. Please renew to continue.', 403));
  }

  if (
    company.subscription_plan === 'trial' &&
    company.trial_ends_at &&
    new Date() > new Date(company.trial_ends_at)
  ) {
    return next(new ErrorResponse('Your trial period has expired. Please upgrade your plan.', 403));
  }

  req.company = company;
  req.company_id = company.id;
  next();
});

/**
 * Checks that the tenant has not exceeded their user quota.
 * Must be used after resolveTenant.
 */
const checkUserQuota = asyncHandler(async (req, res, next) => {
  if (!req.company_id) return next();
  const { User } = db;
  const userCount = await User.count({ where: { company_id: req.company_id } });
  if (userCount >= req.company.max_users) {
    return next(
      new ErrorResponse(
        `User limit reached (${req.company.max_users}). Upgrade your plan to add more users.`,
        403
      )
    );
  }
  next();
});

/**
 * Checks that the tenant has not exceeded their product quota.
 * Must be used after resolveTenant.
 */
const checkProductQuota = asyncHandler(async (req, res, next) => {
  if (!req.company_id) return next();
  const { Product } = db;
  const productCount = await Product.count({ where: { company_id: req.company_id } });
  if (productCount >= req.company.max_products) {
    return next(
      new ErrorResponse(
        `Product limit reached (${req.company.max_products}). Upgrade your plan to add more products.`,
        403
      )
    );
  }
  next();
});

module.exports = { resolveTenant, checkUserQuota, checkProductQuota };
