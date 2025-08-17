const helmet = require('helmet');
const cors = require('cors');

/**
 * Simplified Security Middleware Configuration
 * Implements basic security protection without complex rate limiting
 */

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // List of allowed origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8080'
        ];

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization'
    ]
};

// Basic rate limiting (simple in-memory implementation)
const createBasicRateLimit = () => {
    const requests = new Map();

    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        const windowMs = 15 * 60 * 1000; // 15 minutes
        const maxRequests = 100;

        if (!requests.has(ip)) {
            requests.set(ip, []);
        }

        const userRequests = requests.get(ip);

        // Remove old requests outside the window
        const validRequests = userRequests.filter(time => now - time < windowMs);

        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                error: 'Too many requests',
                message: 'Please try again later'
            });
        }

        validRequests.push(now);
        requests.set(ip, validRequests);

        next();
    };
};

// Export security middleware configuration
module.exports = {
    // Initialize basic security middleware
    initializeSecurity: (app) => {
        // Basic security headers
        app.use(helmet());

        // CORS protection
        app.use(cors(corsOptions));

        // Trust proxy (if behind reverse proxy)
        app.set('trust proxy', 1);

        console.log('Basic security middleware initialized successfully');
    },

    // Basic rate limiters
    rateLimiters: {
        general: createBasicRateLimit(),
        auth: createBasicRateLimit(), // Same for auth
        comment: createBasicRateLimit() // Same for comments
    },

    // Simple speed limiters (no delay)
    speedLimiters: {
        general: (req, res, next) => next(),
        upload: (req, res, next) => next()
    },

    // CORS options
    corsOptions
};



