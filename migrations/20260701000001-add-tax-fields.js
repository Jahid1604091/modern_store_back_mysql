'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'tax_rate', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: false,
      comment: 'Product-level VAT %. 0 means use company default_tax_rate.',
    });
    await queryInterface.addColumn('companies', 'default_tax_rate', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: false,
      comment: 'Company-wide default VAT % applied when product tax_rate is 0.',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'tax_rate');
    await queryInterface.removeColumn('companies', 'default_tax_rate');
  },
};
