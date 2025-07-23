/**
 * RiggerBackend - Main Server Entry Point
 * ChaseWhiteRabbit NGO Technology Initiative
 * 
 * Enterprise-grade backend services for the Rigger ecosystem
 * Supporting ethical technology for blue-collar excellence
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

// Initialize Express application
const app = express();
const server = createServer(app);

// Environment configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_VERSION = process.env.API_VERSION || 'v1';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration for ChaseWhiteRabbit NGO platforms
app.use(cors({
  origin: [
    'http://localhost:3000', // RiggerConnect-web dev
    'http://localhost:3002', // RiggerHub-web dev
    'https://riggerconnect.chasewhiterabbit.org',
    'https://riggerhub.chasewhiterabbit.org',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    service: 'RiggerBackend',
    organization: 'ChaseWhiteRabbit NGO',
    mission: 'Ethical Technology for Blue-Collar Excellence'
  });
});

// API versioning
app.use(`/api/${API_VERSION}`, (req, res, next) => {
  res.header('X-API-Version', API_VERSION);
  res.header('X-Service', 'RiggerBackend');
  res.header('X-Organization', 'ChaseWhiteRabbit NGO');
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'RiggerBackend API',
    version: API_VERSION,
    organization: 'ChaseWhiteRabbit NGO',
    mission: 'Ethical Technology for Blue-Collar Excellence',
    description: 'Enterprise-grade backend services for the Rigger ecosystem',
    documentation: '/api/v1/docs',
    health: '/health',
    endpoints: {
      auth: `/api/${API_VERSION}/auth`,
      users: `/api/${API_VERSION}/users`,
      jobs: `/api/${API_VERSION}/jobs`,
      applications: `/api/${API_VERSION}/applications`,
      analytics: `/api/${API_VERSION}/analytics`,
    }
  });
});

// API Documentation placeholder
app.get(`/api/${API_VERSION}/docs`, (req, res) => {
  res.json({
    title: 'RiggerBackend API Documentation',
    version: API_VERSION,
    organization: 'ChaseWhiteRabbit NGO',
    description: 'Comprehensive API documentation for Rigger ecosystem services',
    endpoints: {
      authentication: 'JWT-based authentication system',
      users: 'User management and profiles',
      jobs: 'Job posting and management',
      applications: 'Job application processing',
      analytics: 'Performance metrics and insights'
    },
    schemas: 'OpenAPI 3.0 specifications available',
    examples: 'Complete request/response examples provided'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    service: 'RiggerBackend',
    organization: 'ChaseWhiteRabbit NGO',
    documentation: `/api/${API_VERSION}/docs`
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server Error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    service: 'RiggerBackend',
    organization: 'ChaseWhiteRabbit NGO',
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                    RIGGERBACKEND                         ║
║            ChaseWhiteRabbit NGO Initiative               ║
║        Ethical Technology for Blue-Collar Excellence     ║
╚══════════════════════════════════════════════════════════╝

🚀 Server Status: RUNNING
📍 Environment: ${NODE_ENV.toUpperCase()}
🌐 Port: ${PORT}
📊 API Version: ${API_VERSION}
🏥 Health Check: http://localhost:${PORT}/health
📚 Documentation: http://localhost:${PORT}/api/${API_VERSION}/docs

🏗️ Ready to serve Rigger ecosystem applications:
   • RiggerConnect-web
   • RiggerConnect-android  
   • RiggerConnect-ios
   • RiggerHub-web
   • RiggerHub-android
   • RiggerHub-ios

⚖️ Committed to ethical technology and worker empowerment
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

export default app;
