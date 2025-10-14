const dotenv = require('dotenv');
dotenv.config();

const { Sequelize } = require('sequelize');


// Connect with Sequelize
const sequelize = new Sequelize(
    process.env.MYSQL_DB,
    process.env.MYSQL_USERNAME,
    process.env.MYSQL_PASSWORD,
    {
        host: process.env.MYSQL_HOST,
        dialect: 'mysql',
        // logging: false,
        // timezone: '+06:00'
    }
);

module.exports = {sequelize};




