const asyncHandler = require("../middleware/asyncHandler.js");
const { Category } = require("../models");
const slugify = require("slugify");
const ErrorResponse = require("../utils/errorresponse.js");


//--------------------------------------------------------------
//---------------- C A T E G O R Y ------------------------------
//--------------------------------------------------------------

// @route    POST /api/categories
// @desc     Create a new category
// @access   Admin
exports.createCategory = asyncHandler(async (req, res, next) => {
  const { name, status, parentId } = req.body;
  const company_id = req.body.company_id || req.user.company_id;

  const isExist = await Category.findOne({
    where: { name, company_id, softDeletedAt: null },
  });

  if (isExist) {
    return next(new ErrorResponse("Already Exists Category!", 400));
  }

  const category = await Category.create({
    name,
    slug: slugify(name, { lower: true }),
    isActive: status,
    parentId: parentId || null,
    company_id,
  });

  res.status(200).json({
    success: true,
    msg: "Category created successfully!",
    data: category,
  });
});


// @route    GET /api/categories
// @desc     Fetch all categories
// @access   Public / Admin
exports.getCategories = asyncHandler(async (req, res, next) => {
  const whereCondition = {
    softDeletedAt: null,
  };

  if (!req.user || req.user.role !== "admin") {
    whereCondition.isActive = true;
  }

  const categories = await Category.findAll({
    where: whereCondition,
    order: [["id", "ASC"]],
  });

  if (!categories.length) {
    return next(new ErrorResponse("No Category Found!", 404));
  }

  const refinedCategories = formatCategories(categories);

  res.status(200).json({
    success: true,
    msg: "Category fetched successfully!",
    data: refinedCategories,
  });
});


// @route    PATCH /api/categories/:id
// @desc     Update a category
// @access   Admin
exports.editCategory = asyncHandler(async (req, res, next) => {
  const { name, status, parentId } = req.body;
  const category = await Category.findByPk(req.params.id);

  if (!category || category.softDeletedAt) {
    return next(new ErrorResponse("No Category Found to Edit!", 404));
  }

  await category.update({
    name: name ?? category.name,
    slug: name ? slugify(name, { lower: true }) : category.slug,
    isActive: typeof status !== "undefined" ? status : category.isActive,
    parentId: typeof parentId !== "undefined" ? parentId : category.parentId,
  });

  res.status(200).json({
    success: true,
    msg: "Category updated successfully!",
    data: category,
  });
});


// @route    DELETE /api/categories/:id
// @desc     Soft delete a category
// @access   Admin
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findByPk(req.params.id);

  if (!category || category.softDeletedAt) {
    return next(new ErrorResponse("No Category Found to Delete!", 404));
  }

  await category.update({
    softDeletedAt: new Date(),
  });

  res.status(200).json({
    success: true,
    msg: "Category deleted successfully!",
  });
});


//--------------------------------------------------------------
//---------------- H E L P E R --------------------------------
//--------------------------------------------------------------
function formatCategories(categories, parentId = null) {
  return categories
    .filter((cat) => cat.parentId === parentId)
    .map((cat) => ({
      _id: cat.id,
      name: cat.name,
      slug: cat.slug,
      isActive: cat.isActive,
      subcategories: formatCategories(categories, cat.id),
    }));
}

