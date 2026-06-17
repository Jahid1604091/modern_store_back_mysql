"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Company extends Model {
    isTrialExpired() {
      return (
        this.subscription_plan === "trial" &&
        this.trial_ends_at &&
        new Date() > new Date(this.trial_ends_at)
      );
    }

    isAccessible() {
      return (
        this.is_active &&
        this.subscription_status === "active" &&
        !this.isTrialExpired()
      );
    }

    static associate(models) {
      Company.hasMany(models.User, { foreignKey: "company_id", as: "users" });
      Company.hasMany(models.Product, { foreignKey: "company_id", as: "products" });
      Company.hasMany(models.Category, { foreignKey: "company_id", as: "categories" });
      Company.hasMany(models.Order, { foreignKey: "company_id", as: "orders" });
      Company.hasMany(models.SubscriptionRequest, { foreignKey: "company_id", as: "subscription_requests" });
    }
  }

  Company.init(
    {
      company_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subdomain: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
      },
      tag_line: DataTypes.STRING,
      logo: DataTypes.STRING,
      currency: {
        type: DataTypes.STRING,
        defaultValue: "BDT",
      },
      address: DataTypes.STRING,
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      details: DataTypes.TEXT,
      about_company: DataTypes.TEXT,
      no_customers: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      social_links: DataTypes.JSON,
      payment_methods: DataTypes.JSON,
      contact: DataTypes.JSON,
      t_and_c: DataTypes.TEXT,
      privacy_policy: DataTypes.TEXT,
      faq: DataTypes.JSON,
      return_refund_policy: DataTypes.TEXT,
      shipping_info: DataTypes.TEXT,
      // SaaS fields
      subscription_plan: {
        type: DataTypes.ENUM("trial", "starter", "professional", "enterprise"),
        defaultValue: "trial",
      },
      subscription_status: {
        type: DataTypes.ENUM("active", "inactive", "suspended", "cancelled"),
        defaultValue: "active",
      },
      trial_ends_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      max_users: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
      },
      max_products: {
        type: DataTypes.INTEGER,
        defaultValue: 100,
      },
    },
    {
      sequelize,
      modelName: "Company",
      tableName: "companies",
    }
  );

  return Company;
};
