"use strict";
const { Model } = require("sequelize");
const slugify = require("slugify");
module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Category.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      company_id: {
        type: DataTypes.INTEGER,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      softDeletedAt:{
        type: DataTypes.DATE,
      },
      meta_data: DataTypes.JSON,
    },
    {
      sequelize,
      modelName: "Category",
      hooks: {
        beforeValidate: (category) => {
          if (category.name && !category.slug) {
            // options: lower: true to keep slugs lowercase
            category.slug = slugify(category.name, {
              lower: true,
              strict: true,
            });
          }
        },
      },
    }
  );
  return Category;
};
