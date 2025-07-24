# Repository Enterprise CI/CD Configuration

## Overview
This directory contains enterprise-grade CI/CD configurations and deployment scripts for this specific repository, while leveraging shared templates and configurations from the master `.enterprise-cicd` directory.

## Structure

### Shared Resources (via symlinks)
- `templates/` → Links to shared workflow and deployment templates
- `environments/` → Links to environment-specific configurations (staging, production)
- `dockerfiles/` → Links to master Dockerfile templates
- `scripts/` → Links to shared deployment and utility scripts

### Repository-Specific Configuration
Place any repository-specific overrides or configurations in this directory:
- `repository-config.yml` - Repository-specific settings
- `custom-workflows/` - Repository-specific GitHub Actions or GitLab CI workflows
- `overrides/` - Environment-specific overrides for this repository

## Usage

### Deployment
Use the shared deployment script:
```bash
../../.enterprise-cicd/scripts/deploy-rigger-service.sh staging RiggerHub-web v1.0.0
```

### Environment Configuration
Environment configurations are managed centrally but can be overridden locally if needed.

### Docker Builds
Docker builds automatically use the appropriate Dockerfile template based on repository type:
- Web applications use `Dockerfile.web`
- Backend services use `Dockerfile.backend`

## ChaseWhiteRabbit NGO Standards
This repository follows the enterprise-grade DevOps standards established for the ChaseWhiteRabbit NGO Rigger ecosystem, ensuring:
- Consistent deployment practices
- Security best practices
- Monitoring and observability
- Scalable infrastructure patterns
