'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('coupons', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      company_id: { type: Sequelize.INTEGER, allowNull: false },
      code: { type: Sequelize.STRING(40), allowNull: false },
      description: { type: Sequelize.STRING, allowNull: true },
      discount_type: { type: Sequelize.ENUM('percent', 'fixed'), defaultValue: 'percent' },
      discount_value: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      min_order_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      max_discount_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      usage_limit: { type: Sequelize.INTEGER, allowNull: true },
      used_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      starts_at: { type: Sequelize.DATE, allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      is_featured: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('coupons', ['company_id']);
    await queryInterface.addConstraint('coupons', {
      fields: ['company_id', 'code'],
      type: 'unique',
      name: 'coupons_company_id_code_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coupons');
  },
};
