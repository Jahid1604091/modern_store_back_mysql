'use strict';
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    order_number: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },

    status: {
      type: DataTypes.ENUM(
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded'
      ),
      defaultValue: 'pending',
    },

    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    shipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'BDT',
    },

    payment_method: {
      type: DataTypes.STRING(50),
    },
    payment_status: {
      type: DataTypes.ENUM('unpaid', 'paid', 'refunded'),
      defaultValue: 'unpaid',
    },
    transaction_id: {
      type: DataTypes.STRING(255),
    },

    shipping_address: {
      type: DataTypes.TEXT,
      get() {
        const raw = this.getDataValue('shipping_address');
        return raw ? JSON.parse(raw) : null;
      },
      set(value) {
        this.setDataValue('shipping_address', JSON.stringify(value));
      },
    },
    billing_address: {
      type: DataTypes.TEXT,
    },

    notes: {
      type: DataTypes.TEXT,
    },
    tracking_number: {
      type: DataTypes.STRING(100),
    },
    // createdAt: {
    //   allowNull: true,
    //   type: DataTypes.DATE
    // },
  },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
    });

  // Associations (future-ready)
  Order.associate = function (models) {
    Order.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items' });
    Order.hasMany(models.PaymentDetail, { foreignKey: 'order_id', as: 'payment_details' });
  };

  return Order;
};
