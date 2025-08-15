const { DataTypes } = require('sequelize');
const sequelize = require('../config/database.js');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            len: [3, 50],
            isUsernameValid(value) {
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
                }
            }
        }
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
            len: [5, 100]
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            len: [8, 255]
        }
    },
    role: {
        type: DataTypes.ENUM('user', 'admin', 'manager'),
        defaultValue: 'user',
        validate: {
            isIn: [['user', 'admin', 'manager']]
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true,
    tableName: 'users'
});

module.exports = User;
