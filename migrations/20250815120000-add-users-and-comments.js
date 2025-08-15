'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Create users table
        await queryInterface.createTable('users', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            username: {
                type: Sequelize.STRING(50),
                allowNull: false,
                unique: true
            },
            email: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true
            },
            password: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            role: {
                type: Sequelize.ENUM('user', 'admin', 'manager'),
                defaultValue: 'user'
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // Add userId column to existing tasks table
        await queryInterface.addColumn('tasks', 'userId', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1, // Default user ID
            references: {
                model: 'users',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        });

        // Create task_comments table
        await queryInterface.createTable('task_comments', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            taskId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'tasks',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // Add indexes for better performance
        await queryInterface.addIndex('tasks', ['userId']);
        await queryInterface.addIndex('task_comments', ['taskId']);
        await queryInterface.addIndex('task_comments', ['userId']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('task_comments');
        await queryInterface.removeColumn('tasks', 'userId');
        await queryInterface.dropTable('users');
    }
};
