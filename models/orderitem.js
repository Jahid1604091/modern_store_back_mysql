'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      OrderItem.belongsTo(models.Order,{
        as:'items',
        foreignKey:'order_id'
      }),
      OrderItem.belongsTo(models.Product,{
        as:'product',
        foreignKey:'product_id'
      })
    }
  }
  OrderItem.init({
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: false

      },
      product_id: {
        type: DataTypes.INTEGER
      },
      order_quantity: {
        type: DataTypes.INTEGER
      },
      unit_price: {
        type: DataTypes.DECIMAL(5, 2)
      },
  }, {
    sequelize,
    modelName: 'OrderItem',
    tableName:'order_items'
  });
  return OrderItem;
};