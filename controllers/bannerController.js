const asyncHandler = require("../middleware/asyncHandler.js");
const db = require("../models/index.js");
const { Banner } = db;
const fs = require("fs");
const path = require("path");
const ErrorResponse = require("../utils/errorresponse.js");
const { companyScopeWhere, resolveCompanyId } = require("../utils/companyScope.js");

// @route  GET /api/banners?company_id=X
// @desc   Public: active banners for the storefront slider, ordered for display.
//         Admin: all banners (active + inactive) for management.
// @access Public / Admin
exports.getBanners = asyncHandler(async (req, res, next) => {
  let company_id;
  if (req.user && req.user.company_id != null) {
    company_id = req.user.company_id;
  } else {
    company_id = req.query.company_id;
    if (!company_id) return next(new ErrorResponse("company_id query parameter is required.", 400));
  }

  const where = { company_id };
  if (!req.user) where.is_active = true;

  const banners = await Banner.findAll({
    where,
    order: [["display_order", "ASC"], ["id", "ASC"]],
  });

  res.status(200).json({ success: true, data: banners });
});

// @route  POST /api/banners
// @desc   Create a banner (scoped to admin's company)
// @access Admin
exports.createBanner = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, msg: "A banner image is required." });
  }

  const company_id = resolveCompanyId(req);
  if (!company_id) return next(new ErrorResponse("company_id is required.", 400));

  const { title, subtitle, link_url, button_text, display_order, is_active } = req.body;

  const banner = await Banner.create({
    company_id,
    title: title || null,
    subtitle: subtitle || null,
    link_url: link_url || null,
    button_text: button_text || null,
    display_order: Number(display_order) || 0,
    is_active: is_active === undefined ? true : is_active === "1" || is_active === "true" || is_active === true,
    image: `images/banners/${req.file.filename}`,
  });

  res.status(201).json({ success: true, msg: "Banner created successfully!", data: banner });
});

// @route  PATCH /api/banners/:id
// @desc   Update a banner (own company only)
// @access Admin
exports.updateBanner = asyncHandler(async (req, res, next) => {
  const banner = await Banner.findOne({ where: companyScopeWhere(req, { id: req.params.id }) });
  if (!banner) return next(new ErrorResponse("Banner not found!", 404));

  const { title, subtitle, link_url, button_text, display_order, is_active } = req.body;
  const updates = {
    title: title ?? banner.title,
    subtitle: subtitle ?? banner.subtitle,
    link_url: link_url ?? banner.link_url,
    button_text: button_text ?? banner.button_text,
    display_order: display_order !== undefined ? Number(display_order) || 0 : banner.display_order,
    is_active: is_active !== undefined ? (is_active === "1" || is_active === "true" || is_active === true) : banner.is_active,
  };

  if (req.file) {
    if (banner.image) {
      fs.unlink(path.join(process.cwd(), banner.image), (err) => {
        if (err) console.error("Error deleting old banner image:", err.message);
      });
    }
    updates.image = `images/banners/${req.file.filename}`;
  }

  await banner.update(updates);
  res.status(200).json({ success: true, msg: "Banner updated successfully!", data: banner });
});

// @route  DELETE /api/banners/:id
// @desc   Delete a banner (own company only)
// @access Admin
exports.deleteBanner = asyncHandler(async (req, res, next) => {
  const banner = await Banner.findOne({ where: companyScopeWhere(req, { id: req.params.id }) });
  if (!banner) return next(new ErrorResponse("Banner not found!", 404));

  if (banner.image) {
    fs.unlink(path.join(process.cwd(), banner.image), (err) => {
      if (err) console.error("Error deleting banner image:", err.message);
    });
  }
  await banner.destroy();

  res.status(200).json({ success: true, msg: "Banner deleted successfully!" });
});
