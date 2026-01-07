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
      // define association here
    }
  }
  PaymentDetail.init({
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: false
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
      paidAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      deliveredAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
  }, {
    sequelize,
    modelName: 'PaymentDetail',
    tableName:"payment_details"
  });
  return PaymentDetail;
};