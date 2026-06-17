'use strict';
const { Model } = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    async matchPassword(enteredPassword) {
      return await bcrypt.compare(enteredPassword, this.password);
    }

    getSignedJwtToken() {
      return jwt.sign(
        { id: this.id, company_id: this.company_id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRED_IN }
      );
    }

    getPasswordResetToken() {
      const resetToken = crypto.randomBytes(32).toString('hex');
      this.password_reset_token = crypto.createHash('sha256').update(resetToken).digest('hex');
      this.password_reset_expire = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      return resetToken;
    }

    getEmailVerifyToken() {
      const token = crypto.randomBytes(32).toString('hex');
      this.email_verify_token = crypto.createHash('sha256').update(token).digest('hex');
      return token;
    }

    static associate(models) {
      User.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
      });

      User.belongsToMany(models.Role, {
        through: models.UserRole,
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'roles',
      });
    }
  }

  User.init(
    {
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      msisdn: DataTypes.STRING,
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: { msg: 'Please enter your password' },
          len: { args: [6, 100], msg: 'Password must be at least 6 characters long' },
        },
        set(value) {
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync(value, salt);
          this.setDataValue('password', hash);
        },
      },
      company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      email_verify_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password_reset_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password_reset_expire: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
    }
  );

  return User;
};
