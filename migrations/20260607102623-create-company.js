"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("companies", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      company_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      tag_line: {
        type: Sequelize.STRING,
      },
      logo: {
        type: Sequelize.STRING,
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: "BDT",
      },
      address: {
        type: Sequelize.STRING,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      details: {
        type: Sequelize.TEXT,
      },
      about_company: {
        type: Sequelize.TEXT,
      },
      no_customers: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      social_links: {
        type: Sequelize.JSON,
      },
      payment_methods: {
        type: Sequelize.JSON,
      },
      contact: {
        type: Sequelize.JSON,
      },
      t_and_c: {
        type: Sequelize.TEXT,
      },
      privacy_policy: {
        type: Sequelize.TEXT,
      },
      faq: {
        type: Sequelize.JSON,
      },
      return_refund_policy: {
        type: Sequelize.TEXT,
      },
      shipping_info: {
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("companies");
  },
};
