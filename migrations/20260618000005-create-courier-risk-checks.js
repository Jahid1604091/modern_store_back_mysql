'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('courier_risk_checks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      company_id: { type: Sequelize.INTEGER, allowNull: false },
      phone: { type: Sequelize.STRING(30), allowNull: false },
      provider: { type: Sequelize.STRING(30), allowNull: false },
      total_orders: { type: Sequelize.INTEGER, defaultValue: 0 },
      delivered_orders: { type: Sequelize.INTEGER, defaultValue: 0 },
      cancelled_orders: { type: Sequelize.INTEGER, defaultValue: 0 },
      returned_orders: { type: Sequelize.INTEGER, defaultValue: 0 },
      success_rate: { type: Sequelize.DECIMAL(4, 3), allowNull: true },
      raw_response: { type: Sequelize.JSON, allowNull: true },
      checked_at: { type: Sequelize.DATE, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('courier_risk_checks', ['company_id', 'phone']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('courier_risk_checks');
  },
};
