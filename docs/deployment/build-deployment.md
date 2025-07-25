# Build & Deployment Guide - RiggerBackend

## Build Process Overview

### Development Build
```bash
# Install dependencies
npm install

# Type checking
npm run type-check

# Lint code
npm run lint

# Run tests
npm test

# Build TypeScript to JavaScript
npm run build

# Verify build
npm run build:verify
```

### Production Build
```bash
# Clean previous builds
npm run clean

# Install production dependencies only
npm ci --only=production

# Build with optimizations
NODE_ENV=production npm run build:prod

# Create Docker image
docker build -t rigger-backend:latest .
```

## Local Development Deployment

### Using npm Scripts
```bash
# Development server with hot reload
npm run dev

# Production-like local server
npm run start:prod

# Debug mode
npm run dev:debug
```

### Using Docker Compose
```bash
# Start all services (database, redis, api)
docker-compose up

# Background mode
docker-compose up -d

# Rebuild and start
docker-compose up --build

# View logs
docker-compose logs -f api
```

## Staging Deployment

### Automated CI/CD Pipeline (GitLab)
Location: `gitlab.sxc.codes` (145.223.22.10)

#### Pipeline Stages
1. **Build Stage**
   - Install dependencies
   - Run type checking
   - Execute linting
   - Run unit tests
   - Build TypeScript

2. **Test Stage**
   - Integration tests
   - Security scanning
   - Code coverage analysis
   - Performance testing

3. **Package Stage**
   - Build Docker image
   - Push to registry
   - Generate deployment artifacts

4. **Deploy Stage**
   - Deploy to staging environment
   - Run smoke tests
   - Update deployment status

#### GitLab CI Configuration
```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - package
  - deploy

variables:
  DOCKER_REGISTRY: docker.sxc.codes:5000
  STAGING_HOST: docker.tiation.net

build:
  stage: build
  image: node:18-alpine
  script:
    - npm ci
    - npm run type-check
    - npm run lint
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

test:
  stage: test
  image: node:18-alpine
  services:
    - postgres:15
    - redis:7-alpine
  script:
    - npm ci
    - npm run test:ci
    - npm run test:integration
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'

package:
  stage: package
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $DOCKER_REGISTRY/rigger-backend:$CI_COMMIT_SHA .
    - docker push $DOCKER_REGISTRY/rigger-backend:$CI_COMMIT_SHA

deploy_staging:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache openssh-client
    - ssh -o StrictHostKeyChecking=no root@$STAGING_HOST "
        docker pull $DOCKER_REGISTRY/rigger-backend:$CI_COMMIT_SHA &&
        docker stop rigger-backend-staging || true &&
        docker rm rigger-backend-staging || true &&
        docker run -d 
          --name rigger-backend-staging 
          --env-file /opt/rigger/.env.staging 
          -p 3001:3001 
          $DOCKER_REGISTRY/rigger-backend:$CI_COMMIT_SHA
      "
  environment:
    name: staging
    url: https://api-staging.rigger.sxc.codes
  only:
    - develop
```

### Manual Staging Deployment
```bash
# SSH to staging server
ssh root@145.223.22.9

# Pull latest code
cd /opt/rigger-backend
git pull origin develop

# Build and deploy
docker-compose -f docker-compose.staging.yml up --build -d

# Verify deployment
curl -f https://api-staging.rigger.sxc.codes/health
```

## Production Deployment

### Infrastructure Overview
- **Primary CI/CD**: docker.sxc.codes (145.223.22.7)
- **Database**: supabase.sxc.codes (93.127.167.157)
- **Monitoring**: grafana.sxc.codes (153.92.214.1)
- **Logging**: elastic.sxc.codes (145.223.22.14)

### Production Deployment Process

#### 1. Pre-deployment Checklist
- [ ] All tests passing
- [ ] Security audit clean
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Monitoring alerts configured
- [ ] Backup strategy verified

#### 2. Deployment Steps
```bash
# 1. Connect to production server
ssh root@145.223.22.7

# 2. Navigate to deployment directory
cd /opt/rigger-backend-production

# 3. Pull latest stable release
git fetch --tags
git checkout v$(cat VERSION)

# 4. Update environment configuration
cp .env.production.template .env.production
# Edit .env.production with production values

# 5. Build production image
docker build -t rigger-backend:production .

# 6. Run database migrations (if needed)
docker run --rm 
  --env-file .env.production 
  rigger-backend:production 
  npm run db:migrate:prod

# 7. Deploy with zero downtime
docker-compose -f docker-compose.production.yml up -d --no-deps api

# 8. Verify deployment
curl -f https://api.rigger.sxc.codes/health

# 9. Update load balancer (if using multiple instances)
# Update nginx configuration and reload
```

#### 3. Post-deployment Verification
```bash
# Check application logs
docker-compose -f docker-compose.production.yml logs -f api

# Verify database connectivity
docker exec rigger-backend-prod npm run db:status

# Check external service connections
curl https://api.rigger.sxc.codes/health/external

# Monitor key metrics
curl https://api.rigger.sxc.codes/metrics | grep -E "(http_requests|response_time)"
```

## Docker Configuration

### Development Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=development

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3001

# Start development server
CMD ["npm", "run", "dev"]
```

### Production Dockerfile
```dockerfile
# Multi-stage build for smaller production image
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=development

COPY . .
RUN npm run build && npm prune --production

FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S rigger -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=rigger:nodejs /app/dist ./dist
COPY --from=builder --chown=rigger:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=rigger:nodejs /app/package.json ./

# Switch to non-root user
USER rigger

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Docker Compose Configuration

#### Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
    env_file:
      - .env.local
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - db
      - redis
    networks:
      - rigger-network

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: rigger_dev
      POSTGRES_USER: rigger
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - rigger-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - rigger-network

volumes:
  postgres_data:

networks:
  rigger-network:
    driver: bridge
```

#### Production
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  api:
    image: rigger-backend:production
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - db
      - redis
    networks:
      - rigger-production
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - rigger-production

  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: rigger_prod
      POSTGRES_USER: rigger
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - rigger-production

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass $(cat /run/secrets/redis_password)
    secrets:
      - redis_password
    volumes:
      - redis_prod_data:/data
    networks:
      - rigger-production

secrets:
  db_password:
    file: ./secrets/db_password.txt
  redis_password:
    file: ./secrets/redis_password.txt

volumes:
  postgres_prod_data:
  redis_prod_data:

networks:
  rigger-production:
    driver: bridge
```

## Environment Configuration

### Development Environment
```bash
# .env.local
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://rigger:password@localhost:5432/rigger_dev
REDIS_URL=redis://localhost:6379

# External Services
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=dev-anon-key
JWT_SECRET=dev-jwt-secret-not-for-production

# Monitoring (optional in dev)
ENABLE_METRICS=false
SENTRY_DSN=
```

### Staging Environment
```bash
# .env.staging
NODE_ENV=staging
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://rigger_staging:staging_password@supabase.sxc.codes:5432/rigger_staging
REDIS_URL=redis://docker.tiation.net:6379/1

# External Services
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=staging-anon-key
JWT_SECRET=staging-jwt-secret-from-vault

# Monitoring
ENABLE_METRICS=true
SENTRY_DSN=https://staging-sentry-dsn
GRAFANA_API_KEY=staging-grafana-key
```

### Production Environment
```bash
# .env.production
NODE_ENV=production
PORT=3001
LOG_LEVEL=warn

# Database (encrypted connection)
DATABASE_URL=postgresql://rigger_prod:super_secure_password@supabase.sxc.codes:5432/rigger_prod?sslmode=require
REDIS_URL=rediss://docker.sxc.codes:6380/0

# External Services
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=prod-anon-key
JWT_SECRET=production-jwt-secret-from-vault

# Security
RATE_LIMIT_REQUESTS=100
CORS_ORIGIN=https://rigger.sxc.codes
TRUST_PROXY=1

# Monitoring
ENABLE_METRICS=true
SENTRY_DSN=https://production-sentry-dsn
GRAFANA_API_KEY=production-grafana-key
```

## Load Balancing & High Availability

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/rigger-backend
upstream rigger_backend {
    least_conn;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 80;
    server_name api.rigger.sxc.codes;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.rigger.sxc.codes;

    ssl_certificate /etc/letsencrypt/live/api.rigger.sxc.codes/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rigger.sxc.codes/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://rigger_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check endpoint (bypass rate limiting)
    location /health {
        limit_req off;
        proxy_pass http://rigger_backend;
        access_log off;
    }
}
```

## Monitoring & Alerting

### Health Checks
```bash
# Application health
curl -f https://api.rigger.sxc.codes/health

# Detailed health with dependencies
curl -f https://api.rigger.sxc.codes/health/detailed

# Metrics endpoint
curl https://api.rigger.sxc.codes/metrics
```

### Deployment Monitoring Script
```bash
#!/bin/bash
# deploy-monitor.sh

HEALTH_URL="https://api.rigger.sxc.codes/health"
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "Monitoring deployment health..."

for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s $HEALTH_URL > /dev/null; then
        echo "✅ Deployment healthy after $((i * RETRY_INTERVAL)) seconds"
        exit 0
    else
        echo "⏳ Attempt $i/$MAX_RETRIES failed, retrying in $RETRY_INTERVAL seconds..."
        sleep $RETRY_INTERVAL
    fi
done

echo "❌ Deployment failed to become healthy after $((MAX_RETRIES * RETRY_INTERVAL)) seconds"
exit 1
```

## Rollback Procedures

### Automated Rollback
```bash
#!/bin/bash
# rollback.sh

PREVIOUS_VERSION=$(git describe --tags --abbrev=0 HEAD~1)

echo "Rolling back to version: $PREVIOUS_VERSION"

# Checkout previous version
git checkout $PREVIOUS_VERSION

# Build and deploy
docker build -t rigger-backend:rollback .
docker-compose -f docker-compose.production.yml up -d --no-deps api

# Verify rollback
if curl -f https://api.rigger.sxc.codes/health; then
    echo "✅ Rollback successful"
else
    echo "❌ Rollback failed"
    exit 1
fi
```

### Database Rollback
```bash
# Rollback database migration
npm run db:migrate:down

# Restore from backup
pg_restore -d rigger_prod /backups/rigger_$(date -d '1 hour ago' +%Y%m%d%H).sql
```

## Security Considerations

### Secrets Management
- Use environment files that are not committed to version control
- Store sensitive data in secure secret management systems
- Rotate secrets regularly
- Use separate secrets for each environment

### Network Security
- All external communications use HTTPS/TLS
- Database connections encrypted
- VPC/firewall rules restrict access
- Regular security audits and penetration testing

### Container Security
- Use minimal base images (Alpine Linux)
- Run as non-root user
- Regular security scanning of images
- Keep base images updated

---

*For deployment issues, consult the [Troubleshooting Guide](../troubleshooting.md) or contact devops@chasewhiterabbit.org*
