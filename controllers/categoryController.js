const asyncHandler = require("../middleware/asyncHandler.js");
const { Category, Product, sequelize } = require("../models");
const slugify = require("slugify");
const ErrorResponse = require("../utils/errorresponse.js");
const { companyScopeWhere, resolveCompanyId } = require("../utils/companyScope.js");

// @route    POST /api/categories
// @desc     Create a new category (scoped to admin's company)
// @access   Admin
exports.createCategory = asyncHandler(async (req, res, next) => {
  const { name, status, parentId } = req.body;
  const company_id = resolveCompanyId(req);
  if (!company_id) {
    return next(new ErrorResponse("company_id is required.", 400));
  }

  const isExist = await Category.findOne({
    where: { name, company_id, softDeletedAt: null },
  });

  if (isExist) {
    return next(new ErrorResponse("Category already exists!", 400));
  }

  const category = await Category.create({
    name,
    slug: slugify(name, { lower: true }),
    isActive: status,
    parentId: parentId || null,
    company_id,
  });

  res.status(200).json({ success: true, msg: "Category created successfully!", data: category });
});

// @route    GET /api/categories?company_id=X
// @desc     Fetch all categories
//           - Public: requires company_id query param, returns only active
//           - Admin: scoped from JWT company_id, returns all
// @access   Public / Admin
exports.getCategories = asyncHandler(async (req, res, next) => {
  let company_id;

  if (req.user && req.user.company_id != null) {
    company_id = req.user.company_id;
  } else {
    company_id = req.query.company_id;
    if (!company_id) {
      return next(new ErrorResponse("company_id query parameter is required.", 400));
    }
  }

  const whereCondition = { softDeletedAt: null, company_id };

  // Public callers only see active categories
  if (!req.user) {
    whereCondition.isActive = true;
  }

  const categories = await Category.findAll({
    attributes: [
      'id', 'name', 'slug', 'isActive', 'parentId',
      [sequelize.fn('COUNT', sequelize.col('products.id')), 'productCount'],
    ],
    include: [{ model: Product, as: 'products', attributes: [], required: false }],
    where: whereCondition,
    group: ['Category.id'],
    order: [['id', 'ASC']],
    raw: true,
  });

  if (!categories.length) {
    return next(new ErrorResponse("No category found!", 404));
  }

  res.status(200).json({
    success: true,
    msg: "Categories fetched successfully!",
    data: formatCategories(categories),
  });
});

// @route    PATCH /api/categories/:id
// @desc     Update a category (own company only)
// @access   Admin
exports.editCategory = asyncHandler(async (req, res, next) => {
  const { name, status, parentId } = req.body;
  const category = await Category.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
  });

  if (!category || category.softDeletedAt) {
    return next(new ErrorResponse("Category not found!", 404));
  }

  await category.update({
    name: name ?? category.name,
    slug: name ? slugify(name, { lower: true }) : category.slug,
    isActive: typeof status !== "undefined" ? status : category.isActive,
    parentId: typeof parentId !== "undefined" ? parentId : category.parentId,
  });

  res.status(200).json({ success: true, msg: "Category updated successfully!", data: category });
});

// @route    DELETE /api/categories/:id
// @desc     Soft delete a category (own company only)
// @access   Admin
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({
    where: companyScopeWhere(req, { id: req.params.id }),
  });

  if (!category || category.softDeletedAt) {
    return next(new ErrorResponse("Category not found!", 404));
  }

  await category.update({ softDeletedAt: new Date() });

  res.status(200).json({ success: true, msg: "Category deleted successfully!" });
});

function formatCategories(categories, parentId = null) {
  return categories
    .filter(cat => cat.parentId === parentId)
    .map(cat => ({
      _id: cat.id,
      name: cat.name,
      slug: cat.slug,
      isActive: cat.isActive,
      productCount: Number(cat.productCount) || 0,
      subcategories: formatCategories(categories, cat.id),
    }));
}
