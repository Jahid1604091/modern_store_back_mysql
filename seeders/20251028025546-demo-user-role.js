'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.bulkInsert('user_roles', [
      {
        user_id: 1,
        role_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 7,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 9,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        role_id: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 2,
        role_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 2,
        role_id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 2,
        role_id: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 2,
        role_id: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 2,
        role_id: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 2,
        role_id: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 3,
        role_id: 7,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 3,
        role_id: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 3,
        role_id: 9,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 3,
        role_id: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      },

    ], {});
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.bulkDelete('user_roles', null, {});
  }
};
