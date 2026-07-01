'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase_orders', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      company_id: { type: Sequelize.INTEGER, allowNull: false },
      po_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      supplier_name: { type: Sequelize.STRING(200), allowNull: true },
      supplier_phone: { type: Sequelize.STRING(50), allowNull: true },
      status: {
        type: Sequelize.ENUM('draft', 'ordered', 'partial', 'received', 'cancelled'),
        defaultValue: 'draft',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      ordered_at: { type: Sequelize.DATE, allowNull: true },
      received_at: { type: Sequelize.DATE, allowNull: true },
      total_amount: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('purchase_order_items', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      purchase_order_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'purchase_orders', key: 'id' }, onDelete: 'CASCADE' },
      product_id: { type: Sequelize.INTEGER, allowNull: false },
      ordered_qty: { type: Sequelize.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
      received_qty: { type: Sequelize.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
      unit_cost: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('purchase_order_items');
    await queryInterface.dropTable('purchase_orders');
  },
};
