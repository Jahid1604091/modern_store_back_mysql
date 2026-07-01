'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderItem extends Model {
    static associate(models) {
      PurchaseOrderItem.belongsTo(models.PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'purchaseOrder' });
      PurchaseOrderItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    }
  }

  PurchaseOrderItem.init({
    purchase_order_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    ordered_qty: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
    received_qty: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
    unit_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  }, {
    sequelize,
    modelName: 'PurchaseOrderItem',
    tableName: 'purchase_order_items',
  });

  return PurchaseOrderItem;
};
