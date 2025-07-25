# Inter-Repository Integration - RiggerBackend

## Integration Overview

RiggerBackend serves as the central API hub for the entire Rigger ecosystem, providing data and business logic services to all client applications and integrating with shared libraries and external services.

## Architecture Diagram Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rigger Ecosystem Architecture                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │ RiggerConnect │    │   RiggerHub   │    │  RiggerShared │   │
│  │   (Mobile)    │    │    (Web)      │    │  (Libraries)  │   │
│  │               │    │               │    │               │   │
│  │ ┌───────────┐ │    │ ┌───────────┐ │    │ ┌───────────┐ │   │
│  │ │ Android   │ │    │ │    Web    │ │    │ │ UI Comps  │ │   │
│  │ │    iOS    │ │    │ │ Components│ │    │ │ Utils     │ │   │
│  │ │Capacitor  │ │    │ │           │ │    │ │ Types     │ │   │
│  │ └───────────┘ │    │ └───────────┘ │    │ └───────────┘ │   │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘   │
│          │                    │                    │           │
│          └────────────────────┼────────────────────┘           │
│                               │                                │
│    ┌─────────────────────────┼─────────────────────────┐      │
│    │                         │                         │      │
│    │            ┌─────────────▼─────────────┐          │      │
│    │            │      RiggerBackend        │          │      │
│    │            │    (Node.js/TypeScript)   │          │      │
│    │            │                           │          │      │
│    │            │ ┌─────────────────────────┐ │          │      │
│    │            │ │    REST API Layer       │ │          │      │
│    │            │ │  - Authentication       │ │          │      │
│    │            │ │  - Job Management       │ │          │      │
│    │            │ │  - User Profiles        │ │          │      │
│    │            │ │  - Messaging            │ │          │      │
│    │            │ │  - Safety & Compliance  │ │          │      │
│    │            │ └─────────────────────────┘ │          │      │
│    │            │                           │          │      │
│    │            │ ┌─────────────────────────┐ │          │      │
│    │            │ │  Business Logic Layer   │ │          │      │
│    │            │ │  - Job Matching Engine  │ │          │      │
│    │            │ │  - Recommendation AI    │ │          │      │
│    │            │ │  - Skills Assessment    │ │          │      │
│    │            │ │  - Safety Protocols     │ │          │      │
│    │            │ └─────────────────────────┘ │          │      │
│    │            │                           │          │      │
│    │            │ ┌─────────────────────────┐ │          │      │
│    │            │ │    Data Access Layer    │ │          │      │
│    │            │ │  - PostgreSQL ORM       │ │          │      │
│    │            │ │  - Redis Caching        │ │          │      │
│    │            │ │  - File Storage         │ │          │      │
│    │            │ └─────────────────────────┘ │          │      │
│    │            └─────────────┬─────────────┘          │      │
│    │                          │                        │      │
│    └──────────────────────────┼────────────────────────┘      │
│                               │                               │
│         ┌─────────────────────┼─────────────────────┐         │
│         │                     │                     │         │
│    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐    ┌──▼──┐     │
│    │Supabase │     │PostgreSQL│     │  Redis  │    │ S3  │     │
│    │  Auth   │     │Database  │     │ Cache   │    │Files│     │
│    └─────────┘     └─────────┘     └─────────┘    └─────┘     │
│                                                               │
├─────────────────────────────────────────────────────────────────┤
│              External Services & Infrastructure                 │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   docker    │  │  supabase   │  │   grafana   │           │
│  │ .sxc.codes  │  │ .sxc.codes  │  │ .sxc.codes  │           │
│  │             │  │             │  │             │           │
│  │   CI/CD     │  │  Database   │  │ Monitoring  │           │
│  │ Container   │  │    Auth     │  │ Dashboards  │           │
│  │   Host      │  │             │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Client Application Integrations

### 1. RiggerConnect Mobile Apps

#### Android Integration
**Repository**: `RiggerConnect-android`
**Communication**: REST API over HTTPS

**Integration Points**:
```typescript
// API Endpoints used by Android app
const ANDROID_ENDPOINTS = {
  // Authentication
  auth: {
    login: 'POST /api/auth/login',
    register: 'POST /api/auth/register',
    refresh: 'POST /api/auth/refresh',
    logout: 'POST /api/auth/logout'
  },
  
  // User Management
  users: {
    profile: 'GET /api/users/profile',
    updateProfile: 'PUT /api/users/profile',
    uploadAvatar: 'POST /api/users/avatar',
    deleteAccount: 'DELETE /api/users/account'
  },
  
  // Job Services
  jobs: {
    search: 'GET /api/jobs/search',
    details: 'GET /api/jobs/:id',
    apply: 'POST /api/jobs/:id/apply',
    recommendations: 'GET /api/jobs/recommendations',
    history: 'GET /api/jobs/applications'
  },
  
  // Real-time Features
  realtime: {
    notifications: 'WebSocket /ws/notifications',
    messages: 'WebSocket /ws/messages',
    location: 'WebSocket /ws/location'
  }
};
```

**Data Flow**:
```typescript
// Android app authentication flow
interface AndroidAuthFlow {
  1: 'User enters credentials in Android app',
  2: 'Android app sends POST /api/auth/login',
  3: 'RiggerBackend validates credentials',
  4: 'Backend returns JWT tokens',
  5: 'Android app stores tokens securely',
  6: 'Subsequent requests include Bearer token'
}
```

#### iOS Integration
**Repository**: `RiggerConnect-ios`
**Communication**: REST API over HTTPS

**Swift/Backend Integration**:
```typescript
// iOS-specific considerations
const IOS_INTEGRATION = {
  pushNotifications: {
    endpoint: 'POST /api/notifications/register-device',
    payload: {
      deviceToken: 'APNS_DEVICE_TOKEN',
      platform: 'ios',
      userId: 'user_id'
    }
  },
  
  backgroundSync: {
    endpoint: 'GET /api/sync/delta',
    syncInterval: '15_minutes',
    backgroundModes: ['background-app-refresh', 'remote-notification']
  },
  
  offlineSupport: {
    cacheEndpoints: [
      '/api/jobs/recent',
      '/api/users/profile',
      '/api/safety/protocols'
    ]
  }
};
```

#### Capacitor Integration
**Repository**: `RiggerConnect-capacitor`
**Communication**: REST API + Native Bridge

**Hybrid App Considerations**:
```typescript
// Capacitor-specific backend integration
const CAPACITOR_INTEGRATION = {
  nativeFeatures: {
    camera: 'POST /api/users/avatar/upload',
    geolocation: 'POST /api/users/location',
    pushNotifications: 'POST /api/notifications/register',
    fileSystem: 'GET /api/documents/download'
  },
  
  webViewBridge: {
    apiBase: 'https://api.rigger.sxc.codes',
    corsOrigins: ['capacitor://localhost', 'https://localhost'],
    headerInjection: 'Authorization: Bearer TOKEN'
  }
};
```

### 2. RiggerHub Web Applications

#### Web Client Integration
**Repository**: `RiggerHub-web`
**Communication**: REST API + WebSocket

**Web-specific Endpoints**:
```typescript
const WEB_ENDPOINTS = {
  // Admin Dashboard
  admin: {
    users: 'GET /api/admin/users',
    jobs: 'GET /api/admin/jobs',
    reports: 'GET /api/admin/reports',
    safety: 'GET /api/admin/safety-incidents'
  },
  
  // Advanced Analytics
  analytics: {
    userMetrics: 'GET /api/analytics/users',
    jobMetrics: 'GET /api/analytics/jobs',
    safetyMetrics: 'GET /api/analytics/safety',
    exportData: 'GET /api/analytics/export'
  },
  
  // Bulk Operations
  bulk: {
    uploadJobs: 'POST /api/jobs/bulk-import',
    updateUsers: 'PUT /api/users/bulk-update',
    sendNotifications: 'POST /api/notifications/broadcast'
  }
};
```

## Shared Library Integration

### RiggerShared Repository
**Repository**: `RiggerShared`
**Usage**: Shared TypeScript/JavaScript utilities

**Backend Integration with Shared Libraries**:
```typescript
// Import shared types and utilities
import { 
  UserProfile,
  JobListing,
  SafetyIncident,
  APIResponse
} from '@rigger/shared-types';

import {
  validateJobData,
  formatUserProfile,
  calculateDistance,
  sanitizeInput
} from '@rigger/shared-utils';

// Usage in backend controllers
export class JobController {
  async createJob(req: Request, res: Response) {
    // Use shared validation
    const validationResult = validateJobData(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid job data',
        details: validationResult.errors
      });
    }
    
    // Use shared types
    const jobListing: JobListing = {
      id: generateId(),
      title: sanitizeInput(req.body.title),
      description: sanitizeInput(req.body.description),
      location: req.body.location,
      requirements: req.body.requirements,
      createdAt: new Date()
    };
    
    // Save to database
    const savedJob = await this.jobService.create(jobListing);
    
    // Return standardized response
    const response: APIResponse<JobListing> = {
      success: true,
      data: savedJob,
      timestamp: new Date()
    };
    
    res.json(response);
  }
}
```

**Shared Components Used by Backend**:
```typescript
// Validation schemas
import { jobSchema, userSchema } from '@rigger/shared-validation';

// Constants and enums
import { 
  JobStatus,
  UserRole,
  SafetyLevel,
  API_ENDPOINTS 
} from '@rigger/shared-constants';

// Utility functions
import {
  calculateJobMatch,
  generateNotification,
  formatCurrency,
  parseLocation
} from '@rigger/shared-utils';
```

## Database Integration

### PostgreSQL Schema Integration
```sql
-- Database schema shared across environments
-- Tables used by all client applications

-- Users table (accessed by all apps)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  profile JSONB NOT NULL,
  role user_role DEFAULT 'worker',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Jobs table (primary data for all job-related features)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location_data JSONB,
  requirements JSONB,
  employer_id UUID REFERENCES users(id),
  status job_status DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Applications table (tracks job applications across platforms)
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  applicant_id UUID REFERENCES users(id),
  application_data JSONB,
  status application_status DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Redis Cache Integration
```typescript
// Cache strategies used across client applications
export class CacheService {
  // User profile caching (accessed by mobile and web)
  async cacheUserProfile(userId: string, profile: UserProfile): Promise<void> {
    await this.redis.setex(
      `user:profile:${userId}`,
      3600, // 1 hour
      JSON.stringify(profile)
    );
  }
  
  // Job recommendations caching (mobile apps)
  async cacheJobRecommendations(userId: string, jobs: JobListing[]): Promise<void> {
    await this.redis.setex(
      `jobs:recommendations:${userId}`,
      1800, // 30 minutes
      JSON.stringify(jobs)
    );
  }
  
  // Real-time session management (all platforms)
  async manageUserSession(userId: string, platform: string): Promise<void> {
    await this.redis.sadd(`user:sessions:${userId}`, platform);
    await this.redis.expire(`user:sessions:${userId}`, 86400); // 24 hours
  }
}
```

## External Service Integrations

### 1. Supabase Integration
**Service**: Authentication & Real-time Database
**URL**: `supabase.sxc.codes` (93.127.167.157)

```typescript
// Supabase integration for all client apps
export class SupabaseIntegration {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  // Authentication service (used by all apps)
  async authenticateUser(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw new AuthenticationError(error.message);
    
    // Sync with local user database
    await this.syncUserData(data.user);
    
    return data;
  }
  
  // Real-time subscriptions (mobile and web)
  setupRealtimeSubscriptions() {
    // Job updates
    this.supabase
      .channel('job-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => this.broadcastJobUpdate(payload)
      )
      .subscribe();
    
    // User status updates
    this.supabase
      .channel('user-status')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_status' },
        (payload) => this.broadcastUserStatus(payload)
      )
      .subscribe();
  }
}
```

### 2. File Storage Integration (AWS S3)
```typescript
// File upload/download for all client applications
export class FileStorageService {
  // Profile images (mobile and web)
  async uploadProfileImage(userId: string, file: Buffer): Promise<string> {
    const key = `profiles/${userId}/avatar-${Date.now()}.jpg`;
    
    await this.s3.upload({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: file,
      ContentType: 'image/jpeg',
      ACL: 'public-read'
    }).promise();
    
    return this.getPublicUrl(key);
  }
  
  // Document storage (all platforms)
  async uploadDocument(userId: string, document: Buffer, type: string): Promise<string> {
    const key = `documents/${userId}/${type}-${Date.now()}.pdf`;
    
    await this.s3.upload({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: document,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256'
    }).promise();
    
    return this.getSignedUrl(key);
  }
}
```

## API Integration Patterns

### 1. RESTful API Design
```typescript
// Consistent API patterns used by all client applications
export const API_PATTERNS = {
  // Resource-based URLs
  endpoints: {
    users: '/api/users',
    jobs: '/api/jobs',
    applications: '/api/applications',
    safety: '/api/safety'
  },
  
  // HTTP method conventions
  methods: {
    GET: 'Retrieve resources',
    POST: 'Create new resources',
    PUT: 'Update entire resources',
    PATCH: 'Partial resource updates',
    DELETE: 'Remove resources'
  },
  
  // Response format standardization
  responseFormat: {
    success: {
      data: 'Resource data',
      meta: 'Pagination and metadata',
      timestamp: 'Response timestamp'
    },
    error: {
      error: 'Error message',
      code: 'Error code',
      details: 'Detailed error information'
    }
  }
};
```

### 2. Real-time Communication
```typescript
// WebSocket integration for real-time features
export class RealtimeService {
  // Push notifications to all connected clients
  broadcastNotification(userId: string, notification: Notification) {
    // Send to mobile apps
    this.mobileNotificationService.send(userId, notification);
    
    // Send to active web sessions
    this.webSocketService.sendToUser(userId, {
      type: 'NOTIFICATION',
      payload: notification
    });
    
    // Update notification history
    this.notificationService.saveNotification(userId, notification);
  }
  
  // Real-time job updates
  broadcastJobUpdate(jobId: string, update: JobUpdate) {
    // Notify interested users (mobile and web)
    this.webSocketService.broadcast(`job:${jobId}`, {
      type: 'JOB_UPDATE',
      payload: update
    });
  }
}
```

## Security Integration

### 1. Authentication Flow
```typescript
// JWT-based authentication used across all platforms
export class AuthenticationService {
  async generateTokens(user: UserProfile): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { 
        userId: user.id,
        role: user.role,
        permissions: user.permissions 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
    
    // Store refresh token securely
    await this.cacheService.storeRefreshToken(user.id, refreshToken);
    
    return { accessToken, refreshToken };
  }
  
  // Token validation middleware (used by all endpoints)
  validateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = this.extractToken(req);
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      req.user = await this.userService.findById(payload.userId);
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
```

### 2. CORS Configuration
```typescript
// CORS setup for cross-origin requests from client apps
export const CORS_CONFIG = {
  origin: [
    'https://rigger.sxc.codes',              // Production web app
    'https://hub.rigger.sxc.codes',          // Hub web app
    'http://localhost:3000',                 // Local web development
    'http://localhost:8100',                 // Capacitor dev server
    'capacitor://localhost',                 // Capacitor mobile apps
    'https://localhost'                      // iOS local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
```

## Deployment Pipeline Integration

### 1. CI/CD Integration
**GitLab CI**: `gitlab.sxc.codes` (145.223.22.10)

```yaml
# Backend deployment triggers client app updates
stages:
  - backend-test
  - backend-deploy
  - integration-test
  - client-notify

backend-deploy:
  script:
    - docker build -t rigger-backend:$CI_COMMIT_SHA .
    - docker push registry.sxc.codes/rigger-backend:$CI_COMMIT_SHA
    - ./deploy-to-production.sh
  after_script:
    # Notify client app repositories of API changes
    - curl -X POST "$GITLAB_API/projects/android-app/trigger/pipeline" \
           -F token="$ANDROID_TRIGGER_TOKEN" \
           -F ref="main" \
           -F "variables[BACKEND_VERSION]=$CI_COMMIT_SHA"
    - curl -X POST "$GITLAB_API/projects/web-app/trigger/pipeline" \
           -F token="$WEB_TRIGGER_TOKEN" \
           -F ref="main" \
           -F "variables[BACKEND_VERSION]=$CI_COMMIT_SHA"
```

### 2. Environment Synchronization
```typescript
// Environment configuration shared across repositories
export const ENVIRONMENT_CONFIG = {
  development: {
    backend: 'http://localhost:3001',
    websocket: 'ws://localhost:3001',
    supabase: 'https://dev-project.supabase.co'
  },
  staging: {
    backend: 'https://api-staging.rigger.sxc.codes',
    websocket: 'wss://api-staging.rigger.sxc.codes',
    supabase: 'https://staging-project.supabase.co'
  },
  production: {
    backend: 'https://api.rigger.sxc.codes',
    websocket: 'wss://api.rigger.sxc.codes',
    supabase: 'https://prod-project.supabase.co'
  }
};
```

## Monitoring & Analytics Integration

### 1. Centralized Logging
**Service**: `elastic.sxc.codes` (145.223.22.14)

```typescript
// Structured logging for debugging across all platforms
export class LoggingService {
  logAPIRequest(req: Request, res: Response, platform: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      platform,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      responseTime: Date.now() - req.startTime,
      statusCode: res.statusCode
    };
    
    // Send to Elasticsearch for analysis
    this.elasticsearch.index({
      index: 'rigger-api-logs',
      body: logEntry
    });
  }
}
```

### 2. Performance Monitoring
**Service**: `grafana.sxc.codes` (153.92.214.1)

```typescript
// Metrics collected for all client integrations
export class MetricsService {
  trackAPIUsage(endpoint: string, platform: string, responseTime: number) {
    // Prometheus metrics
    this.prometheusClient.histogram.observe(
      {
        endpoint,
        platform,
        method: 'api_request_duration_seconds'
      },
      responseTime / 1000
    );
  }
  
  trackUserActivity(userId: string, platform: string, action: string) {
    // Custom analytics
    this.analytics.track({
      userId,
      platform,
      action,
      timestamp: new Date()
    });
  }
}
```

## Error Handling & Recovery

### 1. Circuit Breaker Pattern
```typescript
// Resilient integration with external services
export class CircuitBreaker {
  private failures = new Map<string, number>();
  private readonly threshold = 5;
  private readonly timeout = 30000; // 30 seconds
  
  async executeWithBreaker<T>(
    serviceId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const failures = this.failures.get(serviceId) || 0;
    
    if (failures >= this.threshold) {
      throw new ServiceUnavailableError(`${serviceId} is currently unavailable`);
    }
    
    try {
      const result = await operation();
      this.failures.set(serviceId, 0); // Reset on success
      return result;
    } catch (error) {
      this.failures.set(serviceId, failures + 1);
      throw error;
    }
  }
}
```

### 2. Graceful Degradation
```typescript
// Fallback strategies when services are unavailable
export class FallbackService {
  async getJobRecommendations(userId: string): Promise<JobListing[]> {
    try {
      // Primary: AI-powered recommendations
      return await this.aiService.getRecommendations(userId);
    } catch (error) {
      this.logger.warn('AI recommendations unavailable, using fallback');
      
      try {
        // Fallback 1: Basic matching algorithm
        return await this.basicMatchingService.getMatches(userId);
      } catch (fallbackError) {
        this.logger.warn('Basic matching unavailable, using cached data');
        
        // Fallback 2: Cached recommendations
        return await this.cacheService.getCachedRecommendations(userId) || [];
      }
    }
  }
}
```

---

*This integration documentation ensures seamless communication between RiggerBackend and all client applications, shared libraries, and external services in the ChaseWhiteRabbit NGO ecosystem.*
