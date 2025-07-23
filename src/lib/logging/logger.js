const pino = require('pino');

// Logger configuration based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Base logger configuration
const loggerConfig = {
  level: isDevelopment ? 'debug' : 'info',
  name: 'rigger-backend',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => ({
      ...object,
      environment: process.env.NODE_ENV,
      service: 'rigger-backend',
      version: process.env.npm_package_version || '1.0.0',
    }),
  },
  // Different transport configurations for dev vs prod
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  // Redact sensitive information
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'access_token',
      'refresh_token',
      'api_key',
      'secret',
      'private_key',
      'email',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
};

// Create the base logger
const baseLogger = pino(loggerConfig);

// Enhanced logger with additional methods and context
class EnterpriseLogger {
  constructor(context = {}) {
    this.context = context;
    this.logger = baseLogger.child(context);
  }

  // Create child logger with additional context
  child(additionalContext) {
    return new EnterpriseLogger({ ...this.context, ...additionalContext });
  }

  // Standard logging methods
  debug(message, extra) {
    this.logger.debug(extra, message);
  }

  info(message, extra) {
    this.logger.info(extra, message);
  }

  warn(message, extra) {
    this.logger.warn(extra, message);
  }

  error(message, error) {
    if (error instanceof Error) {
      this.logger.error(
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause,
          },
        },
        message
      );
    } else {
      this.logger.error(error, message);
    }
  }

  fatal(message, error) {
    if (error instanceof Error) {
      this.logger.fatal(
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause,
          },
        },
        message
      );
    } else {
      this.logger.fatal(error, message);
    }
  }

  // Business-specific logging methods
  userAction(action, userId, extra = {}) {
    this.logger.info(
      {
        type: 'USER_ACTION',
        action,
        userId,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      `User action: ${action}`
    );
  }

  apiRequest(req, res, duration, extra = {}) {
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 400 ? 'error' : 'info';
    
    this.logger[logLevel](
      {
        type: 'API_REQUEST',
        method: req.method,
        url: req.url,
        statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      `${req.method} ${req.url} - ${statusCode} (${duration}ms)`
    );
  }

  databaseQuery(query, duration, rowsAffected, extra = {}) {
    this.logger.info(
      {
        type: 'DATABASE_QUERY',
        query: query.substring(0, 100), // Truncate long queries
        duration,
        rowsAffected,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      `Database query executed (${duration}ms)`
    );
  }

  security(event, severity, userId, extra = {}) {
    this.logger.warn(
      {
        type: 'SECURITY',
        event,
        severity,
        userId,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      `Security event: ${event}`
    );
  }

  businessEvent(event, entity, entityId, extra = {}) {
    this.logger.info(
      {
        type: 'BUSINESS_EVENT',
        event,
        entity,
        entityId,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      `Business event: ${event} for ${entity}`
    );
  }

  // Performance monitoring
  performance(metric, value, unit = 'ms', extra = {}) {
    this.logger.info(
      {
        type: 'PERFORMANCE',
        metric,
        value,
        unit,
        timestamp: new Date().toISOString(),
        ...extra,
      },
      `Performance metric: ${metric} = ${value}${unit}`
    );
  }

  // Integration with external monitoring systems
  async sendToMonitoring(data) {
    // This would integrate with your monitoring infrastructure
    // Examples:
    // - Send to ElasticSearch
    // - Send to Grafana
    // - Send to custom monitoring API
    
    if (isProduction) {
      try {
        // Example: Send to ElasticSearch
        // await this.sendToElastic(data);
        
        // Example: Send to Grafana
        // await this.sendToGrafana(data);
        
        this.debug('Monitoring data sent', { dataSize: JSON.stringify(data).length });
      } catch (error) {
        this.error('Failed to send monitoring data', error);
      }
    }
  }
}

// Default logger instance
const logger = new EnterpriseLogger({
  service: 'rigger-backend',
  version: process.env.npm_package_version || '1.0.0',
});

module.exports = {
  logger,
  EnterpriseLogger,
};
