'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'min_stock_threshold', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue:1,
      after:'stock_quantity'
    });

    await queryInterface.addColumn('products', 'barcode', {
      type: Sequelize.STRING,
      allowNull: true,
      after:'id'
    });

    await queryInterface.addColumn('products', 'metadata', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'min_stock_threshold');
    await queryInterface.removeColumn('products', 'barcode');
    await queryInterface.removeColumn('products', 'metadata');
  }
};
