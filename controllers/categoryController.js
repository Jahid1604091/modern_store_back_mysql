const asyncHandler = require("../middleware/asyncHandler.js");
const db = require("../models/index");
const { Category } = db;
const slugify = require("slugify");
const ErrorResponse = require("../utils/errorresponse.js");

//@route    /api/categories
//@desc     POST: create a new category
//@access   protected by admin
const createCategory = asyncHandler(async (req, res, next) => {
  const { name, status } = req.body;
  const isExist = await Category.findOne({ where: { name } });
  if (isExist) {
    return next(new ErrorResponse("Already Exists Category!", 400));
  }
  const company_id = req.body.company_id || req.user.company_id;
  const catObj = { name, isActive: status, company_id };
  if (req.body.parentId) {
    catObj.parentId = req.body.parentId;
  }
  const category = new Category(catObj);
  const newCategory = await category.save();
  return res.status(200).json({
    success: true,
    msg: "Category created successfully!",
    data: newCategory,
  });
});

//@route    /api/categories
//@desc     GET:fetch all categories
//@access   public(optional protection given)
const getCategories = asyncHandler(async (req, res, next) => {
  let categories;
  // const company_id = req.body.company_id || req.user.company_id;

  if (req.user && req.user.role === "admin") {
    categories = await Category.findAll({ where: { softDeletedAt: null } });
  } else {
    categories = await Category.findAll({
      where: { isActive: true, softDeletedAt: null },
    });
  }
  if (!categories) {
    return next(new ErrorResponse("No Category Found!", 404));
  }
  const refinedCategories = formatCategories(categories);
  return res.status(200).json({
    success: true,
    msg: "Category fetched successfully!",
    data: refinedCategories,
  });
});

//@route    /api/categories/:id
//@desc     PATCH: update a category
//@access   protected by admin
const editCategory = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const { name, status } = req.body;
  const category = await Category.findByPk(id);

  if (!category) {
    return next(new ErrorResponse("No Category Found to Edit!", 404));
  }

  //update table
  category.name = name || category.name;
  if (name) {
    category.slug = slugify(name, "-");
  }
  if (typeof status !== "undefined") {
    category.isActive = status;
  }

  const updatedCategory = await category.save();

  return res.status(200).json({
    success: true,
    msg: "Category updated successfully!",
    data: updatedCategory,
  });
});

//@route    /api/categories/:id
//@desc     DELETE: delete a category
//@access   protected by admin
const deleteCategory = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const category = await Category.findByPk(id);

  if (!category) {
    return next(new ErrorResponse("No Category Found to Delete!", 404));
  }

  //update table
  category.softDeletedAt = Date.now();

  await category.save();

  return res.status(200).json({
    success: true,
    msg: "Category deleted successfully!",
    data: category,
  });
});

function formatCategories(passedCategories, parentId = null) {
  const finalFormatedCategoryList = [];
  let categories;
  if (parentId == null) {
    categories = passedCategories.filter((cat) => cat.parentId == undefined);
  } else {
    categories = passedCategories.filter((cat) => cat.parentId == parentId);
  }

  for (let c of categories) {
    finalFormatedCategoryList.push({
      _id: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.isActive,
      subcategories: formatCategories(passedCategories, c.id),
    });
  }

  return finalFormatedCategoryList;
}

module.exports = {
  createCategory,
  getCategories,
  editCategory,
  deleteCategory,
};
