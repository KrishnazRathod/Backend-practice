const { Sequelize } = require("sequelize");
const config = require("./config");

const env = process.env.NODE_ENV || "development"
const dbConfig = config[env]
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: false,
        dialectOptions: dbConfig.dialectOptions
    });

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to MySQL database has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the MySQL database:', error);
    }
})();

module.exports = sequelize;
