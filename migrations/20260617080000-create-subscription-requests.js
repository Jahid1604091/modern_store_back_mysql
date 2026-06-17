'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_requests', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      requested_plan: {
        type: Sequelize.ENUM('trial', 'starter', 'professional', 'enterprise'),
        allowNull: false,
      },
      current_plan: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      admin_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      requested_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
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
    await queryInterface.addIndex('subscription_requests', ['company_id']);
    await queryInterface.addIndex('subscription_requests', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subscription_requests');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS enum_subscription_requests_requested_plan;'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS enum_subscription_requests_status;'
    );
  },
};
