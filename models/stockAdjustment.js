'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockAdjustment extends Model {
    static associate(models) {
      StockAdjustment.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product',
      });
      StockAdjustment.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
      StockAdjustment.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
      });
    }
  }

  StockAdjustment.init(
    {
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      change: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      previous_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      new_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'StockAdjustment',
      tableName: 'stock_adjustments',
      updatedAt: false,
    }
  );

  return StockAdjustment;
};
