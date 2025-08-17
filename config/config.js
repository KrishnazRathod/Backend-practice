require('dotenv').config();

module.exports = {
  development: {
    username: "root",
    password: "",
    database: "task_manager",
    host: "localhost",
    port: 3306,
    dialect: "mysql",
    dialectOptions: {
      charset: 'utf8mb4'
    }
  },
  test: {
    username: "root",
    password: "",
    database: "task_manager_test",
    host: "localhost",
    port: 3306,
    dialect: "mysql",
    dialectOptions: {
      charset: 'utf8mb4'
    }
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    dialectOptions: {
      charset: 'utf8mb4'
    }
  }
};
