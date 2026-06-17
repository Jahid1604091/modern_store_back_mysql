'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'courier_provider', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'courier_consignment_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'courier_tracking_code', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'courier_status', {
      type: Sequelize.ENUM(
        'not_booked',
        'pending_review',
        'booked',
        'in_transit',
        'delivered',
        'returned',
        'cancelled'
      ),
      defaultValue: 'not_booked',
    });
    await queryInterface.addColumn('orders', 'risk_level', {
      type: Sequelize.ENUM('unverified', 'low', 'medium', 'high'),
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'risk_score', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'risk_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'courier_provider');
    await queryInterface.removeColumn('orders', 'courier_consignment_id');
    await queryInterface.removeColumn('orders', 'courier_tracking_code');
    await queryInterface.removeColumn('orders', 'courier_status');
    await queryInterface.removeColumn('orders', 'risk_level');
    await queryInterface.removeColumn('orders', 'risk_score');
    await queryInterface.removeColumn('orders', 'risk_checked_at');
  },
};
