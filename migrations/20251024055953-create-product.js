'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // Basic info
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
      },
      company_id: {
        type: Sequelize.INTEGER,
      },

      category_id: {
        type: Sequelize.INTEGER,
      },

      // Pricing info
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      discount_price: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      currency: {
        type: Sequelize.STRING(10),
        defaultValue: 'BDT',
      },

      // Stock info
      stock_quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      sku: {
        type: Sequelize.STRING(100),
        unique: true,
      },
      unit: {
        type: Sequelize.STRING(50), // e.g., 'kg', 'pcs', 'litre'
      },

      // Brand / Vendor
      brand_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      // Product media
      image: {
        type: Sequelize.STRING,
      },
      gallery: {
        type: Sequelize.JSON, // multiple images as array
      },

      // Metadata
      tags: {
        type: Sequelize.JSON, // array of strings
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'draft'),
        defaultValue: 'active',
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // Automatic timestamps
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('products');
  },
};
