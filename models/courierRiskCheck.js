'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CourierRiskCheck extends Model {
    static associate(models) {
      CourierRiskCheck.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
    }

    isExpired() {
      return new Date() > new Date(this.expires_at);
    }
  }

  CourierRiskCheck.init(
    {
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      total_orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      delivered_orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      cancelled_orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      returned_orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      success_rate: {
        type: DataTypes.DECIMAL(4, 3),
        allowNull: true,
      },
      raw_response: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      checked_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'CourierRiskCheck',
      tableName: 'courier_risk_checks',
    }
  );

  return CourierRiskCheck;
};
