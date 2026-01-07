"use strict";
const bcrypt = require("bcryptjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const salt = bcrypt.genSaltSync(10);
    await queryInterface.bulkInsert("users", [
      {
        name: "Administrator",
        email: "admin@gmail.com",
        password: bcrypt.hashSync("admin@123", salt),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Test User 1",
        email: "test@gmail.com",
        password: bcrypt.hashSync("123456", salt),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("users", {
      email:['admin@gmail.com','test@gmail.com']
    });
  },
};
