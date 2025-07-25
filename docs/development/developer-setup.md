# Developer Setup Guide - RiggerBackend

## Prerequisites

### System Requirements
- **Node.js**: v18.x or higher (LTS recommended)
- **npm**: v9.x or higher
- **Docker**: v20.x or higher
- **Docker Compose**: v2.x or higher
- **Git**: v2.30 or higher
- **Python**: v3.9+ (for certain utilities)

### Platform Support
- ✅ **macOS**: 11.0+ (Big Sur and later)
- ✅ **Linux**: Ubuntu 20.04+, CentOS 8+, Arch Linux
- ✅ **Windows**: 10/11 with WSL2

## Environment Setup

### 1. Repository Clone
```bash
# Using SSH (recommended for contributors)
git clone git@github.com:chasewhiterabbit/RiggerBackend.git
cd RiggerBackend

# Or using HTTPS
git clone https://github.com/chasewhiterabbit/RiggerBackend.git
cd RiggerBackend
```

### 2. Node.js Environment
```bash
# Install dependencies
npm install

# Install global development tools
npm install -g nodemon typescript ts-node jest

# Verify installation
node --version
npm --version
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Edit configuration (use your preferred editor)
nano .env.local
```

#### Required Environment Variables
```bash
# Database Configuration
DATABASE_URL="postgresql://rigger:password@localhost:5432/rigger_dev"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-super-secure-jwt-secret-key-here"
JWT_EXPIRY="24h"
REFRESH_TOKEN_EXPIRY="7d"

# External Services
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_KEY="your-supabase-service-key"

# Email Service
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Cloud Storage
AWS_S3_BUCKET="rigger-uploads-dev"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"

# Monitoring & Logging
LOG_LEVEL="debug"
ENABLE_METRICS="true"
SENTRY_DSN="https://your-sentry-dsn"

# Development
NODE_ENV="development"
PORT=3001
API_BASE_URL="http://localhost:3001"
```

### 4. Database Setup

#### Using Docker (Recommended)
```bash
# Start PostgreSQL and Redis containers
docker-compose up -d db redis

# Verify containers are running
docker-compose ps
```

#### Local Installation (Alternative)
```bash
# PostgreSQL (macOS)
brew install postgresql
brew services start postgresql
createdb rigger_dev

# PostgreSQL (Ubuntu)
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb rigger_dev

# Redis (macOS)
brew install redis
brew services start redis

# Redis (Ubuntu)
sudo apt install redis-server
sudo systemctl start redis-server
```

### 5. Database Migration
```bash
# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Verify database setup
npm run db:status
```

## Development Workflow

### 1. Start Development Server
```bash
# Start all services (recommended)
npm run dev:full

# Or start API server only
npm run dev

# Server will be available at:
# http://localhost:3001
```

### 2. Code Quality Tools
```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Formatting
npm run format
npm run format:check

# Security audit
npm run security:audit
```

### 3. Testing
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

## IDE Configuration

### VS Code (Recommended)
Install these extensions:
- **ESLint**: `ms-vscode.vscode-eslint`
- **Prettier**: `esbenp.prettier-vscode`
- **TypeScript Hero**: `rbbit.typescript-hero`
- **Docker**: `ms-azuretools.vscode-docker`
- **Thunder Client**: `rangav.vscode-thunder-client`

#### Settings (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.quoteStyle": "single",
  "prettier.singleQuote": true,
  "prettier.trailingComma": "es5"
}
```

### IntelliJ IDEA / WebStorm
1. Install Node.js plugin
2. Configure TypeScript service
3. Set up ESLint integration
4. Configure Prettier formatting

## Docker Development

### Development with Docker
```bash
# Build development image
docker-compose build api

# Start full development stack
docker-compose up

# Rebuild and restart
docker-compose up --build

# Stop services
docker-compose down
```

### Production-like Testing
```bash
# Build production image
docker build -t rigger-backend:local .

# Run production container
docker run -p 3001:3001 --env-file .env.local rigger-backend:local
```

## API Testing

### Using Thunder Client (VS Code)
1. Install Thunder Client extension
2. Import collection from `docs/api/thunder-client-collection.json`
3. Set environment variables in Thunder Client

### Using Postman
1. Import collection from `docs/api/postman-collection.json`
2. Import environment from `docs/api/postman-environment.json`
3. Configure authentication tokens

### Using curl
```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "password": "devpassword"}'

# Protected endpoint (replace TOKEN)
curl -X GET http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Performance Monitoring

### Local Metrics Dashboard
```bash
# Start Grafana dashboard
docker-compose up grafana

# Access dashboard at:
# http://localhost:3000
# Username: admin
# Password: admin
```

### Application Performance
```bash
# Performance profiling
npm run profile

# Memory leak detection
npm run profile:memory

# CPU profiling
npm run profile:cpu
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill process (replace PID)
kill -9 PID

# Or use different port
PORT=3002 npm run dev
```

#### Database Connection Issues
```bash
# Check database status
docker-compose ps db

# View database logs
docker-compose logs db

# Reset database
docker-compose down -v
docker-compose up -d db
npm run db:migrate
```

#### Node.js Version Issues
```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Verify version
node --version
```

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max_old_space_size=4096" npm run dev

# Monitor memory usage
npm run profile:memory
```

### Getting Help

#### Internal Resources
1. Check [Troubleshooting Guide](../troubleshooting.md)
2. Review [Common Issues](../common-issues.md)
3. Search existing GitHub issues

#### External Support
- **Technical Questions**: dev-support@chasewhiterabbit.org
- **Bug Reports**: Create GitHub issue with template
- **Feature Requests**: Use GitHub Discussions

## Contributing

### Before You Start
1. Read [Contributing Guidelines](../../CONTRIBUTING.md)
2. Review [Code of Conduct](../ethics/code-of-conduct.md)
3. Check [Development Standards](./coding-standards.md)

### Development Process
1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Develop** following our coding standards
4. **Test** thoroughly: `npm test`
5. **Commit** with conventional commits
6. **Push** and create Pull Request

### Code Review Process
- All code requires review from 2+ maintainers
- Automated checks must pass (CI/CD)
- Security scan must be clean
- Documentation must be updated

---

*ChaseWhiteRabbit NGO - Empowering Blue-Collar Excellence Through Ethical Technology*
