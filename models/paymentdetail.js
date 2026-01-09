'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PaymentDetail extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      PaymentDetail.belongsTo(models.Order,{
        as:'payment_details',
        foreignKey:'order_id'
      })
    }
  }
  PaymentDetail.init({
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    payable_amount: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    },
    advance_paid: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    },
    user_id: {
      type: DataTypes.INTEGER,
    },
    payment_medium: {
      type: DataTypes.STRING(100),
    },
    acc_no: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    trx_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    bank_details: {
      type: DataTypes.JSON,
      allowNull: true
    },
    paid_by: {
      type: DataTypes.INTEGER
    },
    delivered_by: {
      type: DataTypes.INTEGER
    },
    shipped_by: {
      type: DataTypes.INTEGER
    },
    paid_at: {
      allowNull: true,
      type: DataTypes.DATE
    },
    delivered_at: {
      allowNull: true,
      type: DataTypes.DATE
    },
  }, {
    sequelize,
    modelName: 'PaymentDetail',
    tableName: "payment_details"
  });
  return PaymentDetail;
};