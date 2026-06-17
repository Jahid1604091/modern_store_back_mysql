const asyncHandler = require("../middleware/asyncHandler.js");
const db = require("../models/index.js");
const { Company, User, Role, UserRole } = db;
const ErrorResponse = require("../utils/errorresponse.js");
const { Op, fn, col } = require("sequelize");
const crypto = require("crypto");
const sendMail = require("../utils/sendEmail.js");
const PLANS = require("../config/plans.js");

function toSubdomain(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
}

// @route  GET /api/companies/resolve?subdomain=xxx
// @desc   Resolve a subdomain to its company's public info (used by storefront on load)
// @access Public
exports.resolveCompany = asyncHandler(async (req, res, next) => {
  const { subdomain } = req.query;
  if (!subdomain) return next(new ErrorResponse('subdomain query parameter is required.', 400));

  const company = await Company.findOne({
    where: { subdomain: subdomain.toLowerCase().trim(), is_active: true },
    attributes: ['id', 'company_name', 'subdomain', 'tag_line', 'logo', 'currency', 'address',
      'details', 'about_company', 'contact', 'social_links', 'payment_methods',
      'return_refund_policy', 'shipping_info', 't_and_c', 'privacy_policy'],
  });

  if (!company) return next(new ErrorResponse('Company not found.', 404));

  res.status(200).json({ success: true, data: company });
});

// @route  POST /api/companies
// @desc   Platform admin creates a company + its first admin user in one shot.
//         The new user receives a welcome email with their login credentials.
// @access Platform Admin
exports.createCompany = asyncHandler(async (req, res, next) => {
  const {
    company_name,
    plan = 'trial',
    user_name,
    user_email,
    user_password,   // optional — auto-generated if omitted
  } = req.body;

  if (!company_name || !user_name || !user_email) {
    return next(new ErrorResponse('company_name, user_name, and user_email are required.', 400));
  }

  const existingCompany = await Company.findOne({ where: { company_name } });
  if (existingCompany) return next(new ErrorResponse('A company with that name already exists.', 400));

  const existingUser = await User.findOne({ where: { email: user_email } });
  if (existingUser) return next(new ErrorResponse('A user with that email already exists.', 400));

  // Auto-generate password if not supplied
  const plainPassword = user_password || crypto.randomBytes(6).toString('hex'); // 12-char hex

  // Unique subdomain
  let baseSlug = toSubdomain(company_name);
  let subdomain = baseSlug;
  let suffix = 1;
  while (await Company.findOne({ where: { subdomain } })) {
    subdomain = `${baseSlug}-${suffix++}`;
  }

  const selectedPlan = PLANS[plan] ? plan : 'trial';
  const limits = PLANS[selectedPlan];
  const trial_ends_at = selectedPlan === 'trial'
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    : null;

  const company = await Company.create({
    company_name,
    subdomain,
    subscription_plan: selectedPlan,
    subscription_status: 'active',
    trial_ends_at,
    max_users: limits.max_users,
    max_products: limits.max_products,
  });

  const user = await User.create({
    name: user_name,
    email: user_email,
    password: plainPassword,
    company_id: company.id,
  });

  // Assign admin role to the new user
  const adminRole = await Role.findOne({
    where: { name: { [db.Sequelize.Op.in]: ['admin', 'super-admin'] } },
  });
  if (adminRole) {
    await UserRole.create({ user_id: user.id, role_id: adminRole.id });
  }

  // Send welcome email with credentials (non-blocking)
  const adminUrl = process.env.ADMIN_URL || 'http://localhost:5173';
  try {
    await sendMail({
      email: user_email,
      subject: `Your ${process.env.APP_NAME || 'ModernStore'} store is ready — ${company_name}`,
      message: `
        <h2>Welcome, ${user_name}!</h2>
        <p>Your store <strong>${company_name}</strong> has been set up on ${process.env.APP_NAME || 'ModernStore'}.</p>
        <p>Here are your admin login credentials:</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;">${user_email}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Password</td><td style="padding:6px 12px;">${plainPassword}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Subdomain</td><td style="padding:6px 12px;">${subdomain}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Plan</td><td style="padding:6px 12px;">${selectedPlan}</td></tr>
        </table>
        <p><a href="${adminUrl}/login" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Log in to your dashboard</a></p>
        <p style="color:#888;font-size:12px;">Please change your password after your first login.</p>
      `,
    });
  } catch (_) { /* email failure must not block the response */ }

  res.status(201).json({
    success: true,
    msg: `Company "${company_name}" created. Welcome email sent to ${user_email}.`,
    data: {
      company: { id: company.id, company_name, subdomain, subscription_plan: selectedPlan, trial_ends_at },
      user: { id: user.id, name: user_name, email: user_email },
      // only include plaintext password in response if it was auto-generated
      ...(!user_password && { generated_password: plainPassword }),
    },
  });
});

// @route  GET /api/companies
// @desc   Fetch all companies with pagination/filter (platform super-admin)
// @access Super-Admin
exports.getCompanies = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, plan, status, q } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const where = {};
  if (plan) where.subscription_plan = plan;
  if (status) where.subscription_status = status;
  if (q) where.company_name = { [Op.like]: `%${q}%` };

  const { count, rows } = await Company.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset,
  });

  res.status(200).json({
    success: true,
    data: rows,
    pagination: { total: count, page: Number(page), limit: Number(limit), pages: Math.ceil(count / Number(limit)) },
  });
});

// @route  GET /api/companies/platform-stats
// @desc   Platform-level KPIs for super-admin dashboard
// @access Super-Admin
exports.getPlatformStats = asyncHandler(async (req, res, next) => {
  const { User, Order, Product } = db;

  const [
    totalCompanies,
    activeCompanies,
    trialCompanies,
    suspendedCompanies,
    planCounts,
    totalUsers,
    totalOrders,
    totalProducts,
  ] = await Promise.all([
    Company.count(),
    Company.count({ where: { subscription_status: 'active' } }),
    Company.count({ where: { subscription_plan: 'trial' } }),
    Company.count({ where: { subscription_status: 'suspended' } }),
    Company.findAll({
      attributes: ['subscription_plan', [fn('COUNT', col('id')), 'count']],
      group: ['subscription_plan'],
      raw: true,
    }),
    User.count(),
    Order.count(),
    Product.count(),
  ]);

  // Trial expiring in next 3 days
  const trialsExpiringSoon = await Company.count({
    where: {
      subscription_plan: 'trial',
      trial_ends_at: {
        [Op.between]: [new Date(), new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)],
      },
    },
  });

  // Recent signups last 30 days
  const recentSignups = await Company.count({
    where: { createdAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });

  res.status(200).json({
    success: true,
    data: {
      companies: { total: totalCompanies, active: activeCompanies, trial: trialCompanies, suspended: suspendedCompanies, recent_30d: recentSignups, trials_expiring_soon: trialsExpiringSoon },
      by_plan: planCounts,
      users: { total: totalUsers },
      orders: { total: totalOrders },
      products: { total: totalProducts },
    },
  });
});

// @route  GET /api/companies/:id
// @desc   Fetch a single company's public info
// @access Public
exports.getCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findByPk(req.params.id);

  if (!company || (!req.user && !company.is_active)) {
    return next(new ErrorResponse("Company not found!", 404));
  }

  res.status(200).json({ success: true, msg: "Company fetched successfully!", data: company });
});

// @route  GET /api/companies/me
// @desc   Get the authenticated user's own company details
// @access Protected (any role)
exports.getMyCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findByPk(req.user.company_id);
  if (!company) return next(new ErrorResponse("Company not found!", 404));

  res.status(200).json({ success: true, data: company });
});

// @route  PATCH /api/companies/me
// @desc   Update own company info (admin/super-admin can only update their own company)
// @access Admin
exports.updateMyCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findByPk(req.user.company_id);
  if (!company) return next(new ErrorResponse("Company not found!", 404));

  // Prevent tenants from changing subscription fields directly
  const { subscription_plan, subscription_status, trial_ends_at, ...safeBody } = req.body;

  await company.update(safeBody);

  res.status(200).json({ success: true, msg: "Company updated successfully!", data: company });
});

// @route  PATCH /api/companies/:id
// @desc   Update any company (platform super-admin only)
// @access Super-Admin
exports.updateCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return next(new ErrorResponse("Company not found!", 404));

  const updates = { ...req.body };
  if (updates.subscription_plan && PLANS[updates.subscription_plan]) {
    updates.max_users = PLANS[updates.subscription_plan].max_users;
    updates.max_products = PLANS[updates.subscription_plan].max_products;
    if (updates.subscription_plan !== 'trial') updates.trial_ends_at = null;
  }

  await company.update(updates);

  res.status(200).json({ success: true, msg: "Company updated successfully!", data: company });
});
