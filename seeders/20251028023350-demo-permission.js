'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.bulkInsert('Permissions', [
      {
        name: 'create_users',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'edit_users',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'delete_users',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'view_users',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'create_roles',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'edit_roles',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'delete_roles',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'view_roles',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'create_permissions',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'edit_permissions',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'delete_permissions',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'view_permissions',
        createdAt: new Date(),
        updatedAt: new Date(),
      },

    ], {});
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.bulkDelete('Permissions', null, {});
  }
};
