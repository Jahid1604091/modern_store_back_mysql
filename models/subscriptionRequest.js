'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SubscriptionRequest extends Model {
    static associate(models) {
      SubscriptionRequest.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
      });
      SubscriptionRequest.belongsTo(models.User, {
        foreignKey: 'requested_by',
        as: 'requester',
      });
      SubscriptionRequest.belongsTo(models.User, {
        foreignKey: 'reviewed_by',
        as: 'reviewer',
      });
    }
  }

  SubscriptionRequest.init(
    {
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      requested_plan: {
        type: DataTypes.ENUM('trial', 'starter', 'professional', 'enterprise'),
        allowNull: false,
      },
      current_plan: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      admin_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      requested_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reviewed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'SubscriptionRequest',
      tableName: 'subscription_requests',
    }
  );

  return SubscriptionRequest;
};
