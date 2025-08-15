const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("task_manager", "root", "", {
    host: "localhost",
    dialect: "mysql",
    port: 3306,
    logging: false,
    // MySQL specific options
    dialectOptions: {
        charset: 'utf8mb4'
    }
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
