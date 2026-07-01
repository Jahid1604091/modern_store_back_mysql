"use strict";
const { Model } = require("sequelize");
const { encrypt, decrypt } = require("../utils/crypto");

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

    getCourierSettings() {
      return {
        auto_book_enabled: true,
        auto_book_min_orders: 3,
        auto_book_min_success_rate: 0.8,
        high_risk_max_success_rate: 0.5,
        ...(this.courier_settings || {}),
      };
    }

    static associate(models) {
      Company.hasMany(models.User, { foreignKey: "company_id", as: "users" });
      Company.hasMany(models.Product, { foreignKey: "company_id", as: "products" });
      Company.hasMany(models.Category, { foreignKey: "company_id", as: "categories" });
      Company.hasMany(models.Order, { foreignKey: "company_id", as: "orders" });
      Company.hasMany(models.SubscriptionRequest, { foreignKey: "company_id", as: "subscription_requests" });
      Company.hasMany(models.Banner, { foreignKey: "company_id", as: "banners" });
      Company.hasMany(models.Coupon, { foreignKey: "company_id", as: "coupons" });
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
      // VAT / tax
      default_tax_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        allowNull: false,
      },

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
      // Courier integration (Steadfast)
      steadfast_api_key: {
        type: DataTypes.STRING,
        allowNull: true,
        get() {
          return decrypt(this.getDataValue("steadfast_api_key"));
        },
        set(value) {
          this.setDataValue("steadfast_api_key", encrypt(value));
        },
      },
      steadfast_secret_key: {
        type: DataTypes.STRING,
        allowNull: true,
        get() {
          return decrypt(this.getDataValue("steadfast_secret_key"));
        },
        set(value) {
          this.setDataValue("steadfast_secret_key", encrypt(value));
        },
      },
      courier_settings: {
        type: DataTypes.JSON,
        allowNull: true,
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
