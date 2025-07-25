# System Dependencies - RiggerBackend

## Core Runtime Dependencies

### Node.js Ecosystem
| Component | Version | Purpose | Installation |
|-----------|---------|---------|--------------|
| **Node.js** | 18.17.0+ | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| **npm** | 9.6.7+ | Package manager | Included with Node.js |
| **TypeScript** | 5.1.6 | Type-safe JavaScript | `npm install -g typescript` |

### Database Systems
| Component | Version | Purpose | Installation |
|-----------|---------|---------|--------------|
| **PostgreSQL** | 15.3+ | Primary database | [postgresql.org](https://postgresql.org) |
| **Redis** | 7.0.11+ | Caching & sessions | [redis.io](https://redis.io) |

### Container Orchestration
| Component | Version | Purpose | Installation |
|-----------|---------|---------|--------------|
| **Docker** | 24.0.2+ | Containerization | [docker.com](https://docker.com) |
| **Docker Compose** | 2.18.1+ | Multi-container management | Included with Docker Desktop |

## Production Infrastructure

### Cloud Services Integration
| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Supabase** | Backend-as-a-Service | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **AWS S3** | File storage | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| **Sentry** | Error monitoring | `SENTRY_DSN` |
| **Grafana** | Metrics dashboard | `GRAFANA_URL`, `GRAFANA_API_KEY` |

### VPS Infrastructure (Hostinger)
| Server | Role | Specs | Configuration |
|--------|------|-------|---------------|
| **docker.sxc.codes** | Primary CI/CD | Ubuntu 24.04, Docker | `145.223.22.7` |
| **supabase.sxc.codes** | Database & Auth | Ubuntu 24.04 | `93.127.167.157` |
| **grafana.sxc.codes** | Monitoring | Ubuntu 24.04 | `153.92.214.1` |
| **elastic.sxc.codes** | Log aggregation | Ubuntu 22.04 | `145.223.22.14` |

## Development Tools

### Code Quality & Testing
| Tool | Version | Purpose | Configuration |
|------|---------|---------|---------------|
| **ESLint** | 8.44.0 | Code linting | `.eslintrc.js` |
| **Prettier** | 3.0.0 | Code formatting | `.prettierrc` |
| **Jest** | 29.6.1 | Unit testing | `jest.config.js` |
| **Supertest** | 6.3.3 | API testing | Integrated with Jest |
| **Husky** | 8.0.3 | Git hooks | `.husky/` |

### Build & Deployment
| Tool | Version | Purpose | Configuration |
|------|---------|---------|---------------|
| **ts-node** | 10.9.1 | TypeScript execution | `tsconfig.json` |
| **nodemon** | 3.0.1 | Development server | `nodemon.json` |
| **PM2** | 5.3.0 | Process management | `ecosystem.config.js` |

## Platform-Specific Installation

### macOS (Homebrew)
```bash
# Core dependencies
brew install node@18 postgresql@15 redis

# Development tools
brew install --cask docker
brew install git

# Optional: Database GUI tools
brew install --cask pgadmin4
brew install --cask redis-insight
```

### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### CentOS/RHEL/Rocky Linux
```bash
# Enable EPEL repository
sudo dnf install epel-release

# Node.js
sudo dnf module install nodejs:18/common

# PostgreSQL
sudo dnf install postgresql postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Redis
sudo dnf install redis
sudo systemctl start redis
sudo systemctl enable redis

# Docker
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker
```

### Windows (with WSL2)
```powershell
# Install WSL2 and Ubuntu
wsl --install -d Ubuntu

# Install Docker Desktop
# Download from https://docker.com/products/docker-desktop

# Inside WSL2 Ubuntu, follow Ubuntu instructions above
```

## Environment-Specific Configurations

### Development Environment
```bash
# Minimum requirements
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_CORS=true
RATE_LIMIT_REQUESTS=1000

# Database connections
DATABASE_URL=postgresql://rigger:password@localhost:5432/rigger_dev
REDIS_URL=redis://localhost:6379

# External services (development keys)
SUPABASE_URL=https://dev-project.supabase.co
JWT_SECRET=dev-secret-key-not-for-production
```

### Staging Environment
```bash
# Production-like settings
NODE_ENV=staging
LOG_LEVEL=info
ENABLE_CORS=false
RATE_LIMIT_REQUESTS=500

# Staging database
DATABASE_URL=postgresql://rigger_staging:secure_password@supabase.sxc.codes:5432/rigger_staging
REDIS_URL=redis://docker.sxc.codes:6379/1

# Staging services
SUPABASE_URL=https://staging-project.supabase.co
JWT_SECRET=staging-secret-key-from-vault
```

### Production Environment
```bash
# Production settings
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_CORS=false
RATE_LIMIT_REQUESTS=100

# Production database (encrypted connections)
DATABASE_URL=postgresql://rigger_prod:super_secure_password@supabase.sxc.codes:5432/rigger_prod?sslmode=require
REDIS_URL=rediss://docker.sxc.codes:6380/0

# Production services
SUPABASE_URL=https://prod-project.supabase.co
JWT_SECRET=production-secret-from-vault
```

## Security Dependencies

### SSL/TLS Certificates
| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **Let's Encrypt** | SSL certificates | Automated via certbot |
| **OpenSSL** | Cryptographic functions | System package |
| **bcrypt** | Password hashing | npm dependency |

### Authentication & Authorization
| Component | Version | Purpose |
|-----------|---------|---------|
| **jsonwebtoken** | 9.0.1 | JWT token handling |
| **passport** | 0.6.0 | Authentication strategies |
| **helmet** | 7.0.0 | Security headers |
| **cors** | 2.8.5 | Cross-origin requests |

## Monitoring & Observability

### Metrics Collection
| Component | Purpose | Endpoint |
|-----------|---------|----------|
| **Prometheus** | Metrics collection | `/metrics` |
| **Grafana** | Metrics visualization | `grafana.sxc.codes` |
| **Node Exporter** | System metrics | Port 9100 |

### Logging & Tracing
| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **Winston** | Structured logging | `winston.config.js` |
| **ElasticSearch** | Log storage | `elastic.sxc.codes` |
| **Jaeger** | Distributed tracing | Optional |

## Network & Infrastructure

### Load Balancing & Reverse Proxy
| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **Nginx** | Reverse proxy | `/etc/nginx/sites-available/rigger-backend` |
| **HAProxy** | Load balancing | `/etc/haproxy/haproxy.cfg` |

### DNS & CDN
| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Cloudflare** | DNS & CDN | DNS records, SSL termination |
| **Route 53** | AWS DNS | Backup DNS provider |

## Version Compatibility Matrix

### Node.js Versions
| Node.js | npm | TypeScript | Status |
|---------|-----|------------|--------|
| 18.17.x | 9.6.x | 5.1.x | ✅ Recommended |
| 18.16.x | 9.5.x | 5.0.x | ✅ Supported |
| 16.20.x | 8.19.x | 4.9.x | ⚠️ Legacy support |
| 20.x.x | 9.8.x | 5.2.x | 🧪 Testing |

### Database Versions
| PostgreSQL | Redis | Compatibility |
|------------|-------|---------------|
| 15.3+ | 7.0+ | ✅ Full support |
| 14.x | 6.2+ | ✅ Supported |
| 13.x | 6.0+ | ⚠️ Limited support |

## Health Checks & Monitoring

### Service Health Endpoints
```bash
# Application health
curl http://localhost:3001/health

# Database connectivity
curl http://localhost:3001/health/database

# Redis connectivity
curl http://localhost:3001/health/cache

# External services
curl http://localhost:3001/health/external
```

### System Resource Monitoring
```bash
# CPU and memory usage
top -p $(pgrep -f "node.*rigger")

# Database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory usage
redis-cli info memory

# Disk usage
df -h /var/lib/postgresql/data
df -h /var/lib/redis
```

## Backup & Recovery Dependencies

### Database Backup Tools
| Tool | Purpose | Configuration |
|------|---------|---------------|
| **pg_dump** | PostgreSQL backup | Scheduled via cron |
| **redis-cli** | Redis backup | `BGSAVE` command |
| **AWS CLI** | S3 backup storage | Credentials in env |

### Backup Schedule
```bash
# Daily PostgreSQL backup
0 2 * * * pg_dump rigger_prod | gzip > /backups/rigger_$(date +\%Y\%m\%d).sql.gz

# Hourly Redis snapshot
0 * * * * redis-cli BGSAVE && cp /var/lib/redis/dump.rdb /backups/redis_$(date +\%Y\%m\%d\%H).rdb
```

## Development Dependencies Only

### Testing & Quality Assurance
| Tool | Version | Purpose |
|------|---------|---------|
| **@types/node** | 20.4.2 | Node.js type definitions |
| **@types/jest** | 29.5.3 | Jest type definitions |
| **ts-jest** | 29.1.1 | TypeScript Jest preset |
| **supertest** | 6.3.3 | HTTP testing |

### Development Utilities
| Tool | Version | Purpose |
|------|---------|---------|
| **concurrently** | 8.2.0 | Run multiple commands |
| **cross-env** | 7.0.3 | Cross-platform env vars |
| **rimraf** | 5.0.1 | Cross-platform rm -rf |

---

*For issues with dependencies, consult the [Troubleshooting Guide](../troubleshooting.md) or contact dev-support@chasewhiterabbit.org*
