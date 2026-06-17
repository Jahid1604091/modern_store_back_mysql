'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Coupon extends Model {
    static associate(models) {
      Coupon.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
    }

    isCurrentlyValid() {
      const now = new Date();
      if (!this.is_active) return false;
      if (this.starts_at && now < new Date(this.starts_at)) return false;
      if (this.expires_at && now > new Date(this.expires_at)) return false;
      if (this.usage_limit != null && this.used_count >= this.usage_limit) return false;
      return true;
    }
  }

  Coupon.init(
    {
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      discount_type: {
        type: DataTypes.ENUM('percent', 'fixed'),
        defaultValue: 'percent',
      },
      discount_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      min_order_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      max_discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      usage_limit: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      used_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      starts_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Coupon',
      tableName: 'coupons',
      hooks: {
        beforeValidate: (coupon) => {
          if (coupon.code) coupon.code = coupon.code.trim().toUpperCase();
        },
      },
    }
  );

  return Coupon;
};
