'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('companies', 'steadfast_api_key', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('companies', 'steadfast_secret_key', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('companies', 'courier_settings', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('companies', 'steadfast_api_key');
    await queryInterface.removeColumn('companies', 'steadfast_secret_key');
    await queryInterface.removeColumn('companies', 'courier_settings');
  },
};
