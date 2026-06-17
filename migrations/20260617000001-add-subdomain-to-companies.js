'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('companies');

    if (!cols['subdomain']) {
      await queryInterface.addColumn('companies', 'subdomain', {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true,
        after: 'company_name',
      });
      console.log('[migration] added companies.subdomain');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('companies', 'subdomain');
  },
};
