"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("companies", "subscription_plan", {
      type: Sequelize.ENUM("trial", "starter", "professional", "enterprise"),
      defaultValue: "trial",
      allowNull: false,
    });
    await queryInterface.addColumn("companies", "subscription_status", {
      type: Sequelize.ENUM("active", "inactive", "suspended", "cancelled"),
      defaultValue: "active",
      allowNull: false,
    });
    await queryInterface.addColumn("companies", "trial_ends_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("companies", "max_users", {
      type: Sequelize.INTEGER,
      defaultValue: 3,
    });
    await queryInterface.addColumn("companies", "max_products", {
      type: Sequelize.INTEGER,
      defaultValue: 100,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("companies", "subscription_plan");
    await queryInterface.removeColumn("companies", "subscription_status");
    await queryInterface.removeColumn("companies", "trial_ends_at");
    await queryInterface.removeColumn("companies", "max_users");
    await queryInterface.removeColumn("companies", "max_products");
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_companies_subscription_plan;"
    );
    await queryInterface.sequelize.query(
      "DROP TYPE IF EXISTS enum_companies_subscription_status;"
    );
  },
};
