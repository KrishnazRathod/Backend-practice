const express = require('express');
const { Task, User, TaskComment } = require('./models');
const sequelize = require('./config/database.js');
const { Op } = require('sequelize');

// Import middleware
const {
    accessLog,
    consoleLog,
    routeLog,
    errorLog
} = require('./middleware/logging.js');

const {
    globalErrorHandler,
    notFoundHandler,
    asyncHandler,
    handleUnhandledRejection,
    handleUncaughtException
} = require('./middleware/errorHandler.js');

const {
    initializeSecurity,
    rateLimiters,
    speedLimiters
} = require('./middleware/security.js');

const {
    authenticateToken,
    authorizeRoles,
    authorizeResourceOwnership,
    generateToken,
    hashPassword,
    comparePassword,
    validatePasswordStrength
} = require('./middleware/authentication.js');

const {
    validateTask,
    validateUser,
    validateCommentWithParams
} = require('./middleware/validation.js');

const app = express();

// Set up global error handlers for unhandled promises and exceptions
process.on('unhandledRejection', handleUnhandledRejection);
process.on('uncaughtException', handleUncaughtException);

// Initialize security middleware
initializeSecurity(app);

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize logging middleware
app.use(accessLog); // File logging
app.use(consoleLog); // Console logging

// Apply basic rate limiting
app.use('/api/', rateLimiters.general);

// Database connection with error handling
sequelize.authenticate()
    .then(() => {
        console.log("Database connection established successfully!");
    })
    .catch((error) => {
        console.error("Unable to connect to the database:", error);
        process.exit(1);
    });

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Basic route
app.get('/', routeLog('Home'), (req, res) => {
    res.json({
        message: 'Enhanced Task Manager API with Security Features',
        version: '2.0.0',
        features: [
            'JWT Authentication',
            'Role-based Authorization',
            'Basic Rate Limiting',
            'Security Headers',
            'Input Validation with Joi',
            'Comprehensive Logging',
            'Error Handling'
        ]
    });
});

// AUTHENTICATION ROUTES

// User registration
app.post("/api/auth/register",
    routeLog('User Registration'),
    validateUser,
    asyncHandler(async (req, res) => {
        // Validate password strength
        const passwordValidation = validatePasswordStrength(req.body.password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: "Password validation failed",
                details: passwordValidation.errors
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(req.body.password);

        const userData = {
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            role: req.body.role || 'user'
        };

        const newUser = await User.create(userData);

        // Generate JWT tokens
        const accessToken = generateToken(newUser, 'access');
        const refreshToken = generateToken(newUser, 'refresh');

        // Don't send password in response
        const { password, ...userResponse } = newUser.toJSON();

        res.status(201).json({
            message: "User created successfully",
            user: userResponse,
            tokens: {
                access: accessToken,
                refresh: refreshToken
            }
        });
    })
);

// User login
app.post("/api/auth/login",
    routeLog('User Login'),
    asyncHandler(async (req, res) => {
        const { username, email, password } = req.body;

        // Find user by username or email
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { username: username || email },
                    { email: username || email }
                ]
            }
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Verify password
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate JWT tokens
        const accessToken = generateToken(user, 'access');
        const refreshToken = generateToken(user, 'refresh');

        // Don't send password in response
        const { password: userPassword, ...userResponse } = user.toJSON();

        res.json({
            message: "Login successful",
            user: userResponse,
            tokens: {
                access: accessToken,
                refresh: refreshToken
            }
        });
    })
);

// TASK ROUTES (Protected)

// Get all tasks
app.get("/api/tasks",
    routeLog('Get All Tasks'),
    authenticateToken,
    asyncHandler(async (req, res) => {
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
    })
);

// Create task
app.post("/api/tasks",
    routeLog('Create Task'),
    authenticateToken,
    validateTask,
    asyncHandler(async (req, res) => {
        // Ensure userId is set from authenticated user
        const taskData = {
            title: req.body.title,
            description: req.body.description,
            status: req.body.status || 'pending',
            dueDate: req.body.dueDate || null,
            userId: req.user.id  // This should be set automatically
        };

        console.log('Creating task with data:', taskData); // Debug log
        console.log('Authenticated user:', req.user); // Debug log

        const newTask = await Task.create(taskData);

        // Fetch the created task with user information
        const createdTask = await Task.findByPk(newTask.id, {
            include: [
                { model: User, as: 'User', attributes: ['id', 'username', 'email'] }
            ]
        });

        res.status(201).json(createdTask);
    })
);

// Update task
app.put("/api/tasks/:id",
    routeLog('Update Task'),
    authenticateToken,
    validateTask,
    authorizeResourceOwnership(Task, 'id', 'userId'),
    asyncHandler(async (req, res) => {
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
    })
);

// Delete task
app.delete("/api/tasks/:id",
    routeLog('Delete Task'),
    authenticateToken,
    authorizeResourceOwnership(Task, 'id', 'userId'),
    asyncHandler(async (req, res) => {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId);

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        await task.destroy();
        res.json({ message: "Task deleted successfully" });
    })
);

// COMMENT ROUTES (Protected)

// Add comment to task
app.post("/api/tasks/:id/comments",
    routeLog('Create Comment'),
    authenticateToken,
    validateCommentWithParams,
    asyncHandler(async (req, res) => {
        const taskId = parseInt(req.params.id);
        const task = await Task.findByPk(taskId);

        if (!task) {
            return res.status(404).json({ error: "Task not found" });
        }

        const comment = await TaskComment.create({
            content: req.body.content,
            taskId: taskId,
            userId: req.user.id  // Set automatically from authenticated user
        });

        // Fetch comment with user information
        const createdComment = await TaskComment.findByPk(comment.id, {
            include: [
                { model: User, as: 'User', attributes: ['id', 'username'] }
            ]
        });

        res.status(201).json(createdComment);
    })
);

// Get task with all comments
app.get("/api/tasks/:id",
    routeLog('Get Task by ID'),
    authenticateToken,
    asyncHandler(async (req, res) => {
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
    })
);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Add error logging middleware here
app.use(errorLog);

// Global error handler (must be last)
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Enhanced Task Manager API with Security Features is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Security features: Basic rate limiting, JWT auth, Input validation, Logging enabled`);
});

module.exports = app;