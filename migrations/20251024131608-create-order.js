'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      company_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },

      // User who placed the order
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // Order details
      order_number: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        unique: true,
      },

      status: {
        type: Sequelize.ENUM(
          'pending',
          'processing',
          'shipped',
          'delivered',
          'cancelled',
          'refunded'
        ),
        defaultValue: 'pending',
      },

      // Financial info
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      discount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      shipping_cost: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      currency: {
        type: Sequelize.STRING(10),
        defaultValue: 'BDT',
      },

      // Payment info
      payment_method: {
        type: Sequelize.STRING(50), // e.g., 'cash', 'card', 'bkash'
      },
      payment_status: {
        type: Sequelize.ENUM('unpaid', 'paid', 'refunded'),
        defaultValue: 'unpaid',
      },
      transaction_id: {
        type: Sequelize.STRING(255),
      },

      // Shipping info
      shipping_address: {
        type: Sequelize.TEXT,
      },
      billing_address: {
        type: Sequelize.TEXT,
      },

      // Extra info
      notes: {
        type: Sequelize.TEXT,
      },
      tracking_number: {
        type: Sequelize.STRING(100),
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
    await queryInterface.dropTable('Orders');
  },
};
