const pinoHttp = require('pino-http');
const { logger } = require('../lib/logging/logger');

// Request logging middleware using pino-http
const createRequestLogger = () => {
  return pinoHttp({
    logger: logger.logger,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      } else if (res.statusCode >= 500 || err) {
        return 'error';
      } else if (res.statusCode >= 300 && res.statusCode < 400) {
        return 'silent';
      }
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      if (res.statusCode === 404) {
        return 'Resource not found';
      }
      return `${req.method} ${req.url}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} failed with error: ${err.message}`;
    },
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'duration'
    },
    serializers: {
      request: (req) => ({
        method: req.method,
        url: req.url,
        path: req.path,
        parameters: req.params,
        query: req.query,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length'],
          authorization: req.headers.authorization ? '[REDACTED]' : undefined,
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      response: (res) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.get('content-type'),
          'content-length': res.get('content-length'),
        },
      }),
      error: (err) => ({
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
      }),
    },
  });
};

// Enhanced request logging middleware with business context
const enhancedRequestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Add request ID for tracing
  req.id = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create child logger with request context
  req.logger = logger.child({
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Log request start
  req.logger.info('Request started', {
    type: 'REQUEST_START',
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.method === 'POST' || req.method === 'PUT' ? '[BODY]' : undefined,
  });

  // Override res.end to log request completion
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log request completion
    logger.apiRequest(req, res, duration);
    
    // Log performance metrics
    logger.performance('request_duration', duration, 'ms', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
    });

    // Call original end function
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const requestLogger = req.logger || logger;
  
  requestLogger.error('Request error', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
    statusCode: err.statusCode || 500,
  });

  // Log security events for certain errors
  if (err.statusCode === 401 || err.statusCode === 403) {
    logger.security('unauthorized_access', 'medium', req.user?.id, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  next(err);
};

// Database query logging middleware (for use with database queries)
const queryLogger = (query, params) => {
  const startTime = Date.now();
  
  return {
    onComplete: (result) => {
      const duration = Date.now() - startTime;
      logger.databaseQuery(query, duration, result?.rowCount || result?.affectedRows, {
        params: params ? '[PARAMS]' : undefined,
      });
    },
    onError: (error) => {
      const duration = Date.now() - startTime;
      logger.error('Database query failed', {
        query: query.substring(0, 100),
        duration,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        params: params ? '[PARAMS]' : undefined,
      });
    },
  };
};

module.exports = {
  createRequestLogger,
  enhancedRequestLogger,
  errorLogger,
  queryLogger,
};
