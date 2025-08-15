const { DataTypes } = require("sequelize");
const sequelize = require("../config/database.js")

const Task = sequelize.define("Task", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.ENUM("pending", "in_progress", "done"),
        defaultValue: "pending",
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    timestamps: true,
    tableName: "tasks"
});

module.exports = Task;
