'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {

      Product.belongsTo(models.Category, {
        foreignKey: 'category_id',
        as: 'category',
      });

      Product.hasMany(models.Review, {
        foreignKey: 'product_id',
        as: 'reviews',
      });

      // Product.belongsTo(models.Vendor, {
      //   foreignKey: 'vendor_id',
      //   as: 'vendor_info',
      // });
    }
  }

  Product.init(
    {
      // Basic info
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(255),
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
      },

      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      
      // Category info
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // Pricing info
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      discount_price: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'BDT',
      },

      // Stock info
      stock_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      min_stock_threshold: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      sku: {
        type: DataTypes.STRING(100),
        unique: true,
      },
      unit: {
        type: DataTypes.STRING(50), // e.g., 'kg', 'pcs', 'litre'
      },

      // Brand / Vendor (future)
      brand_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // Product media
      image: {
        type: DataTypes.STRING,
      },

      barcode: {
        type: DataTypes.STRING,
      },
      gallery: {
        type: DataTypes.JSON, // multiple images as array
      },

      // Metadata
      tags: {
        type: DataTypes.JSON, // array of strings
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'draft'),
        defaultValue: 'active',
      },
      featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'products',
    }
  );

  return Product;
};
