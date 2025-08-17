const Joi = require('joi');

// Validation schemas
const taskSchema = Joi.object({
    title: Joi.string().min(1).max(100).required()
        .messages({
            'string.empty': 'Title cannot be empty',
            'string.min': 'Title must be at least 1 character long',
            'string.max': 'Title cannot exceed 100 characters'
        }),
    description: Joi.string().max(1000).optional(),
    status: Joi.string().valid('pending', 'in_progress', 'done').optional(),
    dueDate: Joi.date().min('now').optional()
        .messages({
            'date.min': 'Due date cannot be in the past'
        })
    // Remove userId requirement - it's set automatically from req.user.id
});

const userSchema = Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(3).max(50).required()
        .messages({
            'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens',
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username cannot exceed 50 characters'
        }),
    email: Joi.string().email().max(100).required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'string.max': 'Email cannot exceed 100 characters'
        }),
    password: Joi.string().min(8).max(255).required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password cannot exceed 255 characters'
        }),
    role: Joi.string().valid('user', 'admin', 'manager').optional()
        .messages({
            'any.only': 'Role must be one of: user, admin, manager'
        })
});

const commentSchema = Joi.object({
    content: Joi.string().min(1).max(1000).required()
        .messages({
            'string.empty': 'Comment content cannot be empty',
            'string.min': 'Comment must be at least 1 character long',
            'string.max': 'Comment cannot exceed 1000 characters'
        })
    // Remove userId requirement - it's set automatically from req.user.id
});

// Validation middleware functions
const validateTask = (req, res, next) => {
    const { error } = taskSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(detail => detail.message)
        });
    }
    next();
};

const validateUser = (req, res, next) => {
    const { error } = userSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(detail => detail.message)
        });
    }
    next();
};

const validateCommentWithParams = (req, res, next) => {
    // Validate the request body (content only)
    const { error } = commentSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(detail => detail.message)
        });
    }

    // Validate that taskId exists in params
    const taskId = parseInt(req.params.id);
    if (!taskId || isNaN(taskId) || taskId <= 0) {
        return res.status(400).json({
            error: 'Validation failed',
            details: ['Invalid task ID in URL parameters']
        });
    }

    next();
};

module.exports = {
    validateTask,
    validateUser,
    validateCommentWithParams
};
