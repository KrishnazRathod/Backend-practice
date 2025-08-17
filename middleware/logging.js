const fs = require('fs');
const path = require('path');

/**
 * Custom logging middleware for Express application
 * Provides comprehensive request/response logging with file output
 * Built without external logging libraries like Morgan
 */

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Custom logging utility functions
const logUtils = {
    // Get current timestamp in ISO format
    getTimestamp: () => new Date().toISOString(),

    // Format request information
    formatRequest: (req) => {
        return {
            method: req.method,
            url: req.url,
            ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown',
            userAgent: req.get('User-Agent') || 'Unknown',
            referer: req.get('Referer') || 'Direct',
            timestamp: new Date().toISOString()
        };
    },

    // Format response information
    formatResponse: (res, duration) => {
        return {
            statusCode: res.statusCode,
            contentLength: res.get('Content-Length') || 0,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        };
    },

    // Sanitize sensitive data from request body
    sanitizeBody: (body) => {
        if (!body) return '';

        const sensitiveFields = ['password', 'token', 'secret', 'key', 'refreshToken'];
        const sanitized = { ...body };

        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '***REDACTED***';
            }
        });

        const bodyStr = JSON.stringify(sanitized);
        // Limit body logging to prevent log flooding
        return bodyStr.length > 500 ? bodyStr.substring(0, 500) + '...' : bodyStr;
    }
};

// Create write streams for different log levels
const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' } // Append mode
);

const errorLogStream = fs.createWriteStream(
    path.join(logsDir, 'error.log'),
    { flags: 'a' }
);

const securityLogStream = fs.createWriteStream(
    path.join(logsDir, 'security.log'),
    { flags: 'a' }
);

// Custom access logging middleware
const accessLog = (req, res, next) => {
    const startTime = Date.now();
    const requestInfo = logUtils.formatRequest(req);

    // Log request start
    const requestLog = {
        type: 'REQUEST',
        ...requestInfo,
        body: logUtils.sanitizeBody(req.body),
        headers: {
            'content-type': req.get('Content-Type'),
            'authorization': req.get('Authorization') ? '***PRESENT***' : 'None'
        }
    };

    // Write to access log file
    accessLogStream.write(JSON.stringify(requestLog) + '\n');

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.log(`[${requestInfo.timestamp}] ${requestInfo.method} ${requestInfo.url} - IP: ${requestInfo.ip}`);
    }

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - startTime;
        const responseInfo = logUtils.formatResponse(res, duration);

        // Log response
        const responseLog = {
            type: 'RESPONSE',
            requestId: startTime, // Simple request identifier
            ...requestInfo,
            ...responseInfo,
            duration: duration
        };

        // Write to access log file
        accessLogStream.write(JSON.stringify(responseLog) + '\n');

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${responseInfo.timestamp}] ${requestInfo.method} ${requestInfo.url} - ${responseInfo.statusCode} (${duration}ms)`);
        }

        // Call original res.end
        originalEnd.call(this, chunk, encoding);
    };

    next();
};

// Console logging middleware for development
const consoleLog = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        const timestamp = logUtils.getTimestamp();
        console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    }
    next();
};

// Error logging middleware
const errorLog = (err, req, res, next) => {
    const errorLogData = {
        type: 'ERROR',
        timestamp: logUtils.getTimestamp(),
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name,
            statusCode: err.statusCode || 500
        },
        requestBody: logUtils.sanitizeBody(req.body),
        requestHeaders: {
            'content-type': req.get('Content-Type'),
            'authorization': req.get('Authorization') ? '***PRESENT***' : 'None'
        }
    };

    // Write to error log file
    errorLogStream.write(JSON.stringify(errorLogData) + '\n');

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.error('Error Log:', errorLogData);
    }

    next(err);
};

// Security logging middleware
const securityLog = (event, details) => {
    const securityLogData = {
        type: 'SECURITY',
        event: event,
        timestamp: logUtils.getTimestamp(),
        details: details
    };

    // Write to security log file
    securityLogStream.write(JSON.stringify(securityLogData) + '\n');

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
        console.warn(`[SECURITY] ${event}:`, details);
    }
};

// Custom request logging for specific routes
const routeLog = (routeName) => {
    return (req, res, next) => {
        const start = Date.now();
        const timestamp = logUtils.getTimestamp();

        // Log request start
        console.log(`[${timestamp}] ${routeName} - ${req.method} ${req.url} started`);

        // Log response completion
        res.on('finish', () => {
            const duration = Date.now() - start;
            const endTimestamp = logUtils.getTimestamp();
            console.log(`[${endTimestamp}] ${routeName} - ${req.method} ${req.url} completed in ${duration}ms with status ${res.statusCode}`);
        });

        next();
    };
};

// Log rotation utility (basic implementation)
const rotateLogs = () => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const logFiles = ['access.log', 'error.log', 'security.log'];

    logFiles.forEach(filename => {
        const filePath = path.join(logsDir, filename);
        try {
            const stats = fs.statSync(filePath);
            if (stats.size > maxSize) {
                const backupPath = path.join(logsDir, `${filename}.${Date.now()}`);
                fs.renameSync(filePath, backupPath);
                console.log(`Log file ${filename} rotated to ${backupPath}`);
            }
        } catch (error) {
            // File doesn't exist or other error, ignore
        }
    });
};

// Schedule log rotation (every hour)
setInterval(rotateLogs, 60 * 60 * 1000);

module.exports = {
    // Logging middleware
    accessLog,
    consoleLog,
    errorLog,
    routeLog,

    // Security logging
    securityLog,

    // Utility functions
    logUtils,

    // Log rotation
    rotateLogs
};
