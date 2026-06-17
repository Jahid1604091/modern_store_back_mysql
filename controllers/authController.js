const asyncHandler = require('../middleware/asyncHandler.js');
const ErrorResponse = require('../utils/errorresponse.js');
const db = require('../models/index');
const { Company, User, Role, UserRole } = db;
const crypto = require('crypto');
const sendMail = require('../utils/sendEmail.js');
const PLANS = require('../config/plans.js');

// Converts "WoodPacker Sportswear!" → "woodpacker-sportswear"
function toSubdomain(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/**
 * @route  POST /api/auth/register
 * @desc   Register a new company (SaaS tenant) with its first admin user.
 *         Creates the company, starts a 14-day trial, and returns a JWT.
 * @access Public
 */
exports.registerCompany = asyncHandler(async (req, res, next) => {
  const { company_name, name, email, password, plan } = req.body;

  if (!company_name || !name || !email || !password) {
    return next(new ErrorResponse('company_name, name, email and password are required.', 400));
  }

  const existingCompany = await Company.findOne({ where: { company_name } });
  if (existingCompany) {
    return next(new ErrorResponse('A company with that name is already registered.', 400));
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return next(new ErrorResponse('Email is already in use.', 400));
  }

  const selectedPlan = plan && PLANS[plan] ? plan : 'trial';
  const limits = PLANS[selectedPlan];
  const trial_ends_at = selectedPlan === 'trial'
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    : null;

  // Generate a unique subdomain from the company name
  let baseSlug = toSubdomain(company_name);
  let subdomain = baseSlug;
  let suffix = 1;
  while (await Company.findOne({ where: { subdomain } })) {
    subdomain = `${baseSlug}-${suffix++}`;
  }

  const company = await Company.create({
    company_name,
    subdomain,
    subscription_plan: selectedPlan,
    subscription_status: 'active',
    trial_ends_at,
    max_users: limits.max_users,
    max_products: limits.max_products,
  });

  const user = await User.create({ name, email, password, company_id: company.id });

  // First user of the company gets the admin role (not platform-admin)
  const adminRole = await Role.findOne({ where: { name: { [db.Sequelize.Op.in]: ['admin', 'super-admin'] } } });
  if (adminRole) {
    await UserRole.create({ user_id: user.id, role_id: adminRole.id });
  }

  // Send welcome email (non-blocking)
  try {
    await sendMail({
      email: user.email,
      subject: `Welcome to ${process.env.APP_NAME || 'Modern Store'}!`,
      message: `
        <h2>Welcome, ${user.name}!</h2>
        <p>Your store <strong>${company.company_name}</strong> is ready.</p>
        ${selectedPlan === 'trial'
          ? `<p>Your 14-day free trial started today. Upgrade anytime from your dashboard.</p>`
          : `<p>You are on the <strong>${selectedPlan}</strong> plan.</p>`}
        <p>Log in to your admin dashboard to get started.</p>
      `,
    });
  } catch (_) { /* email failure should not block registration */ }

  return res.status(201).json({
    success: true,
    msg: selectedPlan === 'trial'
      ? `Welcome ${name}! Your 14-day trial has started.`
      : `Welcome ${name}! Your ${selectedPlan} plan is active.`,
    data: {
      company: { id: company.id, company_name: company.company_name, subdomain: company.subdomain, trial_ends_at, subscription_plan: selectedPlan },
      user: { id: user.id, name: user.name, email: user.email },
    },
    token: user.getSignedJwtToken(),
  });
});

/**
 * @route  GET /api/auth/subscription
 * @desc   Get the current tenant's subscription details.
 * @access Protected
 */
exports.getSubscription = asyncHandler(async (req, res, next) => {
  const company = await Company.findByPk(req.user.company_id, {
    attributes: [
      'id', 'company_name', 'subscription_plan', 'subscription_status',
      'trial_ends_at', 'max_users', 'max_products', 'is_active',
    ],
  });

  if (!company) {
    return next(new ErrorResponse('Company not found.', 404));
  }

  const { User: UserModel, Product } = db;
  const [userCount, productCount] = await Promise.all([
    UserModel.count({ where: { company_id: company.id } }),
    Product.count({ where: { company_id: company.id } }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      ...company.toJSON(),
      usage: { users: userCount, products: productCount },
      is_trial_expired: company.isTrialExpired?.() ?? false,
    },
  });
});

/**
 * @route  POST /api/auth/forgot-password
 * @desc   Send password reset email.
 * @access Public
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new ErrorResponse('Email is required.', 400));

  const user = await User.findOne({ where: { email } });
  // Always return 200 to prevent email enumeration
  if (!user) {
    return res.status(200).json({ success: true, msg: 'If that email exists, a reset link has been sent.' });
  }

  const resetToken = user.getPasswordResetToken();
  await user.save({ validate: false });

  const resetUrl = `${process.env.ADMIN_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

  try {
    await sendMail({
      email: user.email,
      subject: 'Password Reset Request',
      message: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below within 30 minutes:</p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;">Reset Password</a>
        <p>If you did not request this, ignore this email.</p>
      `,
    });
  } catch (err) {
    user.password_reset_token = null;
    user.password_reset_expire = null;
    await user.save({ validate: false });
    return next(new ErrorResponse('Email could not be sent.', 500));
  }

  return res.status(200).json({ success: true, msg: 'If that email exists, a reset link has been sent.' });
});

/**
 * @route  PUT /api/auth/reset-password/:token
 * @desc   Reset password using token.
 * @access Public
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { password } = req.body;
  if (!password) return next(new ErrorResponse('Password is required.', 400));

  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const { Op } = require('sequelize');

  const user = await User.findOne({
    where: {
      password_reset_token: hashedToken,
      password_reset_expire: { [Op.gt]: new Date() },
    },
  });

  if (!user) return next(new ErrorResponse('Invalid or expired reset token.', 400));

  user.password = password;
  user.password_reset_token = null;
  user.password_reset_expire = null;
  await user.save();

  return res.status(200).json({
    success: true,
    msg: 'Password has been reset successfully.',
    token: user.getSignedJwtToken(),
  });
});

/**
 * @route  POST /api/auth/seed-platform-admin
 * @desc   One-time bootstrap: creates the platform admin account (company_id = null).
 *         Blocked permanently once any platform admin already exists.
 * @access Public (but only works once)
 */
exports.seedPlatformAdmin = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorResponse('name, email, and password are required.', 400));
  }

  // Block if a platform admin (company_id = null) already exists
  const existing = await User.findOne({ where: { company_id: null } });
  if (existing) {
    return next(new ErrorResponse('Platform admin already exists. This endpoint is disabled.', 403));
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) return next(new ErrorResponse('Email already in use.', 400));

  const user = await User.create({ name, email, password, company_id: null });

  // Assign a platform-admin role (create it if it doesn't exist yet)
  let role = await Role.findOne({ where: { name: 'platform-admin' } });
  if (!role) {
    role = await Role.create({ name: 'platform-admin' });
  }
  await UserRole.create({ user_id: user.id, role_id: role.id });

  return res.status(201).json({
    success: true,
    msg: 'Platform admin created. This endpoint is now permanently disabled.',
    data: { id: user.id, name: user.name, email: user.email, company_id: null },
    token: user.getSignedJwtToken(),
  });
});

/**
 * @route  GET /api/auth/verify-email/:token
 * @desc   Verify user email address.
 * @access Public
 */
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({ where: { email_verify_token: hashedToken } });
  if (!user) return next(new ErrorResponse('Invalid verification token.', 400));

  user.email_verified = true;
  user.email_verify_token = null;
  await user.save({ validate: false });

  return res.status(200).json({ success: true, msg: 'Email verified successfully.' });
});
