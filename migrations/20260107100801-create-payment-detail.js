'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_details', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      payable_amount: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue:0
      },
      advance_paid: {
        type: Sequelize.DECIMAL,
        allowNull: false,
        defaultValue:0
      },
      user_id: {
        type: Sequelize.INTEGER,
      },
      payment_medium: {
        type: Sequelize.STRING(100),
      },
      acc_no: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      trx_id: {
       type: Sequelize.STRING(100),
        allowNull: true
      },
      bank_details: {
        type: Sequelize.JSON,
        allowNull: true
      },
      paid_by: {
        type: Sequelize.INTEGER
      },
      delivered_by: {
        type: Sequelize.INTEGER
      },
      shipped_by: {
        type: Sequelize.INTEGER
      },
      paid_at: {
        allowNull: true,
        type: Sequelize.DATE
      },
      delivered_at: {
        allowNull: true,
        type: Sequelize.DATE
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payment_details');
  }
};