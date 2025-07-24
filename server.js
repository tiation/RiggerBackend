const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sessionConfig } = require('./config/session');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const session = require('express-session');
require('dotenv').config();

// Import enterprise logging and monitoring
const { logger } = require('./src/lib/logging/logger');
const { createRequestLogger, enhancedRequestLogger, errorLogger } = require('./src/middleware/requestLogger');
const { metrics } = require('./src/lib/monitoring/metrics');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const paymentRoutes = require('./routes/payments');
const agentRoutes = require('./routes/agents');
const worksafeRoutes = require('./routes/worksafe');
// const contactRoutes = require('./routes/contact');

// Import billing routes
const employerBillingRoutes = require('./routes/billing/employer');
const workerBillingRoutes = require('./routes/billing/worker');
const ngoTransparencyRoutes = require('./routes/billing/ngo-transparency');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const oldLogger = require('./middleware/logger'); // Keep for backwards compatibility
const setupSecurity = require('./middleware/security');
const { protect } = require('./middleware/auth');
const { verifyEmail } = require('./middleware/emailVerification');
const { forgotPassword, resetPassword } = require('./middleware/passwordReset');
const { setup2FA, verify2FASetup, verify2FAToken, disable2FA } = require('./middleware/twoFactor');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize application
logger.info('Starting RiggerBackend server', {
  port: PORT,
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
  timestamp: new Date().toISOString(),
});

// Apply security middleware
setupSecurity(app);

// Enterprise request logging (must be early in middleware stack)
app.use(createRequestLogger());
app.use(enhancedRequestLogger);

// Apply session management
app.use(session(sessionConfig));

// Data sanitization
app.use(mongoSanitize()); // Against NoSQL query injection
app.use(xss()); // Against XSS
app.use(hpp()); // Prevent parameter pollution

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Legacy logging middleware (keeping for backwards compatibility)
// app.use(oldLogger); // Commented out as we're using enterprise logging now

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Serve static files
app.use(express.static('.'));
app.use('/assets', express.static('assets'));

// Health check endpoint with detailed metrics
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: require('./package.json').version,
    memory: process.memoryUsage(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };
  
  logger.info('Health check requested', { healthData });
  metrics.recordApiRequest('GET', '/health', 200, 0);
  
  res.status(200).json(healthData);
});

// Metrics endpoint (for Prometheus/Grafana)
app.get('/metrics', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.headers.authorization) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const prometheusMetrics = metrics.exportPrometheusMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

// API routes
// Auth routes - no protection needed
app.use('/api/auth', authRoutes);

// Email verification routes
app.get('/api/verify-email/:token', verifyEmail);
app.post('/api/forgot-password', forgotPassword);
app.patch('/api/reset-password/:token', resetPassword);

// 2FA routes
app.post('/api/2fa/setup', protect, setup2FA);
app.post('/api/2fa/verify-setup', protect, verify2FASetup);
app.post('/api/2fa/verify', protect, verify2FAToken);
app.delete('/api/2fa/disable', protect, disable2FA);

// Protected routes
app.use('/api/users', protect, userRoutes);
app.use('/api/jobs', protect, jobRoutes);
app.use('/api/applications', protect, applicationRoutes);
app.use('/api/payments', protect, paymentRoutes);
app.use('/api/agents', protect, agentRoutes);
app.use('/api/worksafe', protect, worksafeRoutes);
// app.use('/api/contact', contactRoutes);

// Billing routes (protected)
app.use('/api/billing/employer', protect, employerBillingRoutes);
app.use('/api/billing/worker', protect, workerBillingRoutes);

// NGO Transparency routes (public access)
app.use('/api/transparency', ngoTransparencyRoutes);

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to RiggerHire API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      jobs: '/api/jobs',
      applications: '/api/applications',
      payments: '/api/payments',
      contact: '/api/contact',
      worksafe: '/api/worksafe',
      health: '/health'
    }
  });
});

// Default route - serve website
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
});

// Enterprise error logging middleware
app.use(errorLogger);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler - moved after other routes
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({
      error: 'Route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`
    });
  } else {
    // Serve index.html for frontend routes
    res.sendFile('index.html', { root: __dirname });
  }
});

// Database connection with enhanced logging
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/riggerhire')
.then(() => {
  logger.info('Connected to MongoDB', {
    uri: process.env.MONGODB_URI ? '[REDACTED]' : 'mongodb://localhost:27017/riggerhire',
    readyState: mongoose.connection.readyState,
  });
  
  // Record database connection metric
  metrics.setGauge('database_connected', 1);
  
  // Start server
  const server = app.listen(PORT, () => {
    logger.info('RiggerBackend server started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV,
      healthCheck: `http://localhost:${PORT}/health`,
      metricsEndpoint: `http://localhost:${PORT}/metrics`,
    });
    
    // Record server start metric
    metrics.recordBusinessEvent('server_started', 'application');
  });
  
  // Track active connections
  let activeConnections = 0;
  server.on('connection', (socket) => {
    activeConnections++;
    metrics.recordActiveConnections(activeConnections);
    
    socket.on('close', () => {
      activeConnections--;
      metrics.recordActiveConnections(activeConnections);
    });
  });
})
.catch((error) => {
  logger.fatal('Database connection failed', error);
  metrics.setGauge('database_connected', 0);
  process.exit(1);
});

// Graceful shutdown with enhanced logging
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Graceful shutdown initiated...');
  
  try {
    // Flush metrics before shutdown
    await metrics.flushNow();
    logger.info('Metrics flushed successfully');
    
    // Close database connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed successfully');
    
    // Record shutdown event
    metrics.recordBusinessEvent('server_shutdown', 'application');
    await metrics.flushNow();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.fatal('Error during graceful shutdown', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Graceful shutdown initiated...');
  
  try {
    await metrics.flushNow();
    await mongoose.connection.close();
    metrics.recordBusinessEvent('server_shutdown', 'application');
    await metrics.flushNow();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.fatal('Error during graceful shutdown', error);
    process.exit(1);
  }
});

module.exports = app;
