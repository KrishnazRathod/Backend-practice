const express = require('express');
const app = express();
const { Task, User, TaskComment, sequelize } = require('./models');
const { validateTask, validateUser, validateComment, validateCommentWithParams } = require('./middleware/validation');

app.use(express.json());

// Database connection
sequelize.authenticate().then(() => {
    console.log("Database connection established successfully!");
}).catch((error) => {
    console.error("Unable to connect to the database:", error);
});

// Basic route
app.get('/', (req, res) => {
    res.send('Enhanced Task Manager API with Users and Comments');
});

// USER ROUTES

// Create a new user
app.post("/users", validateUser, async (req, res) => {
    try {
        const userData = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password, // In production, hash this password!
            role: req.body.role || 'user'
        };

        const newUser = await User.create(userData);

        // Don't send password in response
        const { password, ...userResponse } = newUser.toJSON();
        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: "Username or email already exists" });
        }
        res.status(400).json({ error: "Failed to create user", details: error.message });
    }
});

// Get all users
app.get("/users", async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] }, // Don't send passwords
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Get user by ID
app.get("/users/:id", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: Task,
                    as: 'Tasks',
                    attributes: ['id', 'title', 'status', 'dueDate']
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// TASK ROUTES (Updated with user association)

// Get all tasks with user information
app.get("/tasks", async (req, res) => {
    try {
        const { status, userId, page = 1, limit = 10 } = req.query;

        // Build where clause dynamically
        const whereClause = {};
        if (status) whereClause.status = status;
        if (userId) whereClause.userId = userId;

        const offset = (page - 1) * limit;

        const tasks = await Task.findAndCountAll({
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'email']
                }
            ],
            where: whereClause,
            limit: parseInt(limit),
            offset: offset,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            tasks: tasks.rows,
            total: tasks.count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(tasks.count / limit)
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
});

// Create task with validation and user association
app.post("/task", validateTask, async (req, res) => {
    try {
        const taskData = {
            title: req.body.title,
            description: req.body.description,
            status: req.body.status || "pending",
            dueDate: req.body.dueDate || null,
            userId: req.body.userId
        };

        const newTask = await Task.create(taskData);

        // Fetch the created task with user information
        const createdTask = await Task.findByPk(newTask.id, {
            include: [
                { model: User, as: 'User', attributes: ['id', 'username', 'email'] }
            ]
        });

        res.status(201).json(createdTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(400).json({ error: "Failed to create task", details: error.message });
    }
});

// Update task with validation
app.put("/task/:id", validateTask, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId);

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        await task.update(req.body);

        // Fetch updated task with user information
        const updatedTask = await Task.findByPk(taskId, {
            include: [
                { model: User, as: 'User', attributes: ['id', 'username', 'email'] }
            ]
        });

        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: "Failed to update task" });
    }
});

// Delete task
app.delete("/task/:id", async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId);

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        await task.destroy();
        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: "Failed to delete task" });
    }
});

// COMMENT ROUTES

// Add comment to task
app.post("/tasks/:id/comments", validateCommentWithParams, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId);

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        const comment = await TaskComment.create({
            content: req.body.content,
            taskId: taskId,
            userId: req.body.userId
        });

        // Fetch comment with user information
        const createdComment = await TaskComment.findByPk(comment.id, {
            include: [
                { model: User, as: 'User', attributes: ['id', 'username'] }
            ]
        });

        res.status(201).json(createdComment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(400).json({ error: "Failed to create comment" });
    }
});

// Get all comments for a task
app.get("/tasks/:id/comments", async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId);

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        const comments = await TaskComment.findAll({
            where: { taskId: taskId },
            include: [
                { model: User, as: 'User', attributes: ['id', 'username'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
});

// Get task with all comments
app.get("/tasks/:id", async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId, {
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'email']
                },
                {
                    model: TaskComment,
                    as: 'TaskComments',
                    include: [
                        {
                            model: User,
                            as: 'User',
                            attributes: ['id', 'username']
                        }
                    ],
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: "Failed to fetch task" });
    }
});

// Delete a comment
app.delete("/comments/:id", async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const comment = await TaskComment.findByPk(commentId);

        if (!comment) {
            return res.status(404).json({ error: "Comment not found" });
        }

        await comment.destroy();
        res.json({ message: "Comment deleted successfully" });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Enhanced Task Manager API with Users and Comments is running on port ${PORT}`);
});