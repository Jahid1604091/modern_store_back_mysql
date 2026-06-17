"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable("users");

    const addIfMissing = async (col, def) => {
      if (!tableDesc[col]) {
        await queryInterface.addColumn("users", col, def);
      }
    };

    await addIfMissing("is_active", {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });

    await addIfMissing("email_verified", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    await addIfMissing("email_verify_token", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await addIfMissing("password_reset_token", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await addIfMissing("password_reset_expire", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    for (const col of [
      "is_active",
      "email_verified",
      "email_verify_token",
      "password_reset_token",
      "password_reset_expire",
    ]) {
      await queryInterface.removeColumn("users", col).catch(() => {});
    }
  },
};
