'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrder extends Model {
    static associate(models) {
      PurchaseOrder.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      PurchaseOrder.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      PurchaseOrder.hasMany(models.PurchaseOrderItem, { foreignKey: 'purchase_order_id', as: 'items' });
    }
  }

  PurchaseOrder.init({
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    po_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    supplier_name: { type: DataTypes.STRING(200), allowNull: true },
    supplier_phone: { type: DataTypes.STRING(50), allowNull: true },
    status: {
      type: DataTypes.ENUM('draft', 'ordered', 'partial', 'received', 'cancelled'),
      defaultValue: 'draft',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    ordered_at: { type: DataTypes.DATE, allowNull: true },
    received_at: { type: DataTypes.DATE, allowNull: true },
    total_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'PurchaseOrder',
    tableName: 'purchase_orders',
  });

  return PurchaseOrder;
};
