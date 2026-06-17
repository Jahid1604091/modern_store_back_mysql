'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('products');

    if (!cols['tryon_image']) {
      await queryInterface.addColumn('products', 'tryon_image', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'gallery',
      });
      console.log('[migration] added products.tryon_image');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'tryon_image');
  },
};
