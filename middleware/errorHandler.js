/**
 * Comprehensive Error Handling Middleware
 * Handles different types of errors and provides appropriate responses
 */

// Custom error classes for different error types
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

        // Capture stack trace for debugging
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400);
        this.details = details;
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}

// Global error handler middleware
const globalErrorHandler = (err, req, res, next) => {
    // Set default values
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;

    // Log error details
    console.error('Error Details:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // Handle Sequelize validation errors
    if (err.name === 'SequelizeValidationError') {
        const message = 'Validation Error';
        const details = err.errors.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        }));
        error = new ValidationError(message, details);
    }

    // Handle Sequelize unique constraint errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        const message = 'Duplicate field value';
        const details = err.errors.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        }));
        error = new ValidationError(message, details);
    }

    // Handle Sequelize foreign key constraint errors
    if (err.name === 'SequelizeForeignKeyConstraintError') {
        error = new ValidationError('Referenced resource does not exist');
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AuthenticationError('Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        error = new AuthenticationError('Token expired');
    }

    // Handle syntax errors (malformed JSON)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        error = new ValidationError('Invalid JSON format');
    }

    // Handle rate limiting errors
    if (err.status === 429) {
        error.statusCode = 429;
        error.message = 'Too many requests, please try again later';
    }

    // Development error response (with stack trace)
    if (process.env.NODE_ENV === 'development') {
        return res.status(error.statusCode).json({
            status: error.status,
            error: error.message,
            details: error.details,
            stack: error.stack,
            statusCode: error.statusCode
        });
    }

    // Production error response (no stack trace)
    if (error.isOperational) {
        // Operational errors - trusted errors that we know about
        return res.status(error.statusCode).json({
            status: error.status,
            message: error.message,
            details: error.details
        });
    } else {
        // Programming or unknown errors - don't leak error details
        console.error('Unexpected Error:', err);
        return res.status(500).json({
            status: 'error',
            message: 'Something went wrong'
        });
    }
};

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl}`);
    next(error);
};

// Async error wrapper to catch async errors
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Error boundary for unhandled promise rejections
const handleUnhandledRejection = (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // In production, you might want to gracefully shutdown the server
    process.exit(1);
};

// Error boundary for uncaught exceptions
const handleUncaughtException = (error) => {
    console.error('Uncaught Exception:', error);
    // In production, you might want to gracefully shutdown the server
    process.exit(1);
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    globalErrorHandler,
    notFoundHandler,
    asyncHandler,
    handleUnhandledRejection,
    handleUncaughtException
};
