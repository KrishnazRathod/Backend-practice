const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { AuthenticationError, AuthorizationError } = require('./errorHandler');

/**
 * Comprehensive Authentication and Authorization Middleware
 * Implements JWT-based authentication with role-based access control
 */

// JWT configuration
const JWT_CONFIG = {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'task-manager-api',
    audience: process.env.JWT_AUDIENCE || 'task-manager-users'
};

// Password hashing configuration
const PASSWORD_CONFIG = {
    saltRounds: 12, // Higher number = more secure but slower
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
};

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(PASSWORD_CONFIG.saltRounds);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        throw new Error('Password hashing failed');
    }
};

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match
 */
const comparePassword = async (password, hashedPassword) => {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid and errors
 */
const validatePasswordStrength = (password) => {
    const errors = [];

    if (password.length < PASSWORD_CONFIG.minLength) {
        errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters long`);
    }

    if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (PASSWORD_CONFIG.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (PASSWORD_CONFIG.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Generate JWT token for user
 * @param {object} user - User object
 * @param {string} type - Token type ('access' or 'refresh')
 * @returns {string} JWT token
 */
const generateToken = (user, type = 'access') => {
    const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        type: type,
        iat: Math.floor(Date.now() / 1000),
        iss: JWT_CONFIG.issuer,
        aud: JWT_CONFIG.audience
    };

    const expiresIn = type === 'refresh' ? JWT_CONFIG.refreshExpiresIn : JWT_CONFIG.expiresIn;

    return jwt.sign(payload, JWT_CONFIG.secret, { expiresIn });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_CONFIG.secret, {
            issuer: JWT_CONFIG.issuer,
            audience: JWT_CONFIG.audience
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AuthenticationError('Token has expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new AuthenticationError('Invalid token');
        } else {
            throw new AuthenticationError('Token verification failed');
        }
    }
};

/**
 * Extract token from request headers
 * @param {object} req - Express request object
 * @returns {string|null} JWT token or null
 */
const extractToken = (req) => {
    // Check Authorization header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.substring(7);
    }

    // Check custom header
    if (req.headers['x-access-token']) {
        return req.headers['x-access-token'];
    }

    // Check query parameter (for GET requests)
    if (req.query.token) {
        return req.query.token;
    }

    return null;
};

/**
 * Authentication middleware - verifies JWT token
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            throw new AuthenticationError('Access token is required');
        }

        const decoded = verifyToken(token);

        // Check if token type is access token
        if (decoded.type !== 'access') {
            throw new AuthenticationError('Invalid token type');
        }

        // Add user info to request object
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 * @returns {function} Middleware function
 */
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AuthenticationError('User not authenticated'));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AuthorizationError(`Role ${req.user.role} is not authorized`));
        }

        next();
    };
};

/**
 * Resource ownership middleware - checks if user owns the resource
 * @param {string} resourceModel - Sequelize model name
 * @param {string} resourceIdParam - Parameter name for resource ID
 * @param {string} userIdField - Field name for user ID in resource model
 * @returns {function} Middleware function
 */
const authorizeResourceOwnership = (resourceModel, resourceIdParam = 'id', userIdField = 'userId') => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new AuthenticationError('User not authenticated'));
            }

            const resourceId = req.params[resourceIdParam];
            const resource = await resourceModel.findByPk(resourceId);

            if (!resource) {
                return next(new Error('Resource not found'));
            }

            // Admin can access all resources
            if (req.user.role === 'admin') {
                return next();
            }

            // Check if user owns the resource
            if (resource[userIdField] !== req.user.id) {
                return next(new AuthorizationError('Access denied to this resource'));
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Optional authentication middleware - doesn't fail if no token
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (token) {
            const decoded = verifyToken(token);
            if (decoded.type === 'access') {
                req.user = {
                    id: decoded.userId,
                    username: decoded.username,
                    email: decoded.email,
                    role: decoded.role
                };
            }
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

module.exports = {
    // Configuration
    JWT_CONFIG,
    PASSWORD_CONFIG,

    // Password utilities
    hashPassword,
    comparePassword,
    validatePasswordStrength,

    // Token utilities
    generateToken,
    verifyToken,
    extractToken,

    // Middleware
    authenticateToken,
    authorizeRoles,
    authorizeResourceOwnership,
    optionalAuth,

    // Constants
    ROLES: {
        USER: 'user',
        ADMIN: 'admin',
        MODERATOR: 'moderator'
    }
};
