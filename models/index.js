'use strict';


// Import models manually
const Task = require('./task');
const User = require('./user');
const TaskComment = require('./taskComment');

// Define associations for data integrity
User.hasMany(Task, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Task.belongsTo(User, { foreignKey: 'userId' });

Task.hasMany(TaskComment, {
  foreignKey: 'taskId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
TaskComment.belongsTo(Task, { foreignKey: 'taskId' });

User.hasMany(TaskComment, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
TaskComment.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  Task,
  User,
  TaskComment
};
