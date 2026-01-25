'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'min_stock_threshold', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue:1,
      after:'stock_quantity'
    });

    await queryInterface.addColumn('Products', 'barcode', {
      type: Sequelize.STRING,
      allowNull: true,
      after:'id'
    });

    await queryInterface.addColumn('Products', 'metadata', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Products', 'min_stock_threshold');
    await queryInterface.removeColumn('Products', 'barcode');
    await queryInterface.removeColumn('Products', 'metadata');
  }
};
