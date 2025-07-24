/**
 * Authentication Service
 * RiggerBackend - ChaseWhiteRabbit NGO Initiative
 * 
 * Provides comprehensive authentication and authorization services
 * for the Rigger ecosystem with RiggerShared integration
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { logger } from '../lib/logging/logger';
import { UserRoles, ValidationUtils, ErrorUtils } from '@rigger/shared';

// Types
interface UserRegistration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRoles;
  phone?: string;
  company?: string;
  licenseNumber?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: UserProfile;
  message?: string;
  expiresIn?: number;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRoles;
  isEmailVerified: boolean;
  phone?: string;
  company?: string;
  licenseNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RefreshTokenPayload {
  userId: string;
  email: string;
  role: UserRoles;
  tokenId: string;
}

/**
 * Authentication Service Class
 * Handles all authentication and authorization operations
 */
export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;
  private readonly SALT_ROUNDS: number;

  constructor() {
    // Environment configuration
    this.JWT_SECRET = process.env.JWT_SECRET || this.generateFallbackSecret();
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || this.generateFallbackSecret();
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
    this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');

    // Validate configuration
    this.validateConfiguration();
  }

  /**
   * Register a new user
   */
  async register(userData: UserRegistration): Promise<AuthResult> {
    try {
      logger.info('User registration attempt', { email: userData.email, role: userData.role });

      // Validate input data using RiggerShared
      const validationResult = this.validateRegistrationData(userData);
      if (!validationResult.isValid) {
        logger.warn('Registration validation failed', { 
          email: userData.email, 
          errors: validationResult.errors 
        });
        return {
          success: false,
          message: `Validation failed: ${validationResult.errors.join(', ')}`
        };
      }

      // Check if user already exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        logger.warn('Registration attempt with existing email', { email: userData.email });
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user profile
      const userProfile: UserProfile = {
        id: this.generateUserId(),
        email: userData.email.toLowerCase().trim(),
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        role: userData.role,
        isEmailVerified: false,
        phone: userData.phone?.trim(),
        company: userData.company?.trim(),
        licenseNumber: userData.licenseNumber?.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save user to database (placeholder - implement with actual DB)
      await this.saveUser(userProfile, hashedPassword);

      // Generate tokens
      const { token, refreshToken, expiresIn } = await this.generateTokens(userProfile);

      // Log successful registration
      logger.info('User registered successfully', { 
        userId: userProfile.id, 
        email: userProfile.email, 
        role: userProfile.role 
      });

      // Send verification email (placeholder)
      await this.sendVerificationEmail(userProfile);

      return {
        success: true,
        token,
        refreshToken,
        user: this.sanitizeUserProfile(userProfile),
        expiresIn
      };

    } catch (error) {
      logger.error('Registration failed', error);
      return {
        success: false,
        message: 'Registration failed due to server error'
      };
    }
  }

  /**
   * Authenticate user login
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      logger.info('Login attempt', { email: credentials.email });

      // Validate credentials
      if (!ValidationUtils.isValidEmail(credentials.email)) {
        logger.warn('Login attempt with invalid email format', { email: credentials.email });
        return {
          success: false,
          message: 'Invalid email format'
        };
      }

      if (!credentials.password || credentials.password.length < 1) {
        logger.warn('Login attempt with empty password', { email: credentials.email });
        return {
          success: false,
          message: 'Password is required'
        };
      }

      // Get user from database
      const { user, hashedPassword } = await this.getUserWithPassword(credentials.email);
      if (!user || !hashedPassword) {
        logger.warn('Login attempt with non-existent user', { email: credentials.email });
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(credentials.password, hashedPassword);
      if (!isPasswordValid) {
        logger.warn('Login attempt with invalid password', { 
          userId: user.id, 
          email: credentials.email 
        });
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }

      // Check if account is active (placeholder for additional checks)
      if (!this.isAccountActive(user)) {
        logger.warn('Login attempt with inactive account', { 
          userId: user.id, 
          email: credentials.email 
        });
        return {
          success: false,
          message: 'Account is not active'
        };
      }

      // Generate tokens
      const { token, refreshToken, expiresIn } = await this.generateTokens(user);

      // Update last login (placeholder)
      await this.updateLastLogin(user.id);

      // Log successful login
      logger.info('User logged in successfully', { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      });

      return {
        success: true,
        token,
        refreshToken,
        user: this.sanitizeUserProfile(user),
        expiresIn
      };

    } catch (error) {
      logger.error('Login failed', error);
      return {
        success: false,
        message: 'Login failed due to server error'
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      logger.info('Token refresh attempt');

      if (!refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required'
        };
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as RefreshTokenPayload;

      // Get current user data
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        logger.warn('Token refresh with non-existent user', { userId: decoded.userId });
        return {
          success: false,
          message: 'Invalid refresh token'
        };
      }

      // Check if refresh token is blacklisted (placeholder)
      const isTokenValid = await this.isRefreshTokenValid(decoded.tokenId);
      if (!isTokenValid) {
        logger.warn('Token refresh with blacklisted token', { 
          userId: decoded.userId, 
          tokenId: decoded.tokenId 
        });
        return {
          success: false,
          message: 'Invalid refresh token'
        };
      }

      // Generate new tokens
      const { token, refreshToken: newRefreshToken, expiresIn } = await this.generateTokens(user);

      // Invalidate old refresh token (placeholder)
      await this.invalidateRefreshToken(decoded.tokenId);

      logger.info('Token refreshed successfully', { userId: user.id });

      return {
        success: true,
        token,
        refreshToken: newRefreshToken,
        user: this.sanitizeUserProfile(user),
        expiresIn
      };

    } catch (error) {
      logger.error('Token refresh failed', error);
      return {
        success: false,
        message: 'Invalid refresh token'
      };
    }
  }

  /**
   * Logout user (invalidate tokens)
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      logger.info('User logout', { userId });

      if (refreshToken) {
        // Decode and invalidate refresh token
        const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as RefreshTokenPayload;
        await this.invalidateRefreshToken(decoded.tokenId);
      }

      // Additional logout logic (clear sessions, etc.)
      await this.clearUserSessions(userId);

      logger.info('User logged out successfully', { userId });
    } catch (error) {
      logger.error('Logout failed', error);
      throw error;
    }
  }

  /**
   * Verify JWT token and return user data
   */
  async verifyToken(token: string): Promise<UserProfile | null> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      const user = await this.getUserById(decoded.userId);
      return user;
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      return null;
    }
  }

  // Private helper methods

  private validateRegistrationData(userData: UserRegistration) {
    const errors: string[] = [];

    // Email validation
    if (!ValidationUtils.isValidEmail(userData.email)) {
      errors.push('Invalid email format');
    }

    // Password validation
    if (!userData.password || userData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Name validation
    if (!userData.firstName || userData.firstName.trim().length < 1) {
      errors.push('First name is required');
    }

    if (!userData.lastName || userData.lastName.trim().length < 1) {
      errors.push('Last name is required');
    }

    // Role validation
    if (!Object.values(UserRoles).includes(userData.role)) {
      errors.push('Invalid user role');
    }

    // Phone validation (if provided)
    if (userData.phone && !ValidationUtils.isValidPhone(userData.phone)) {
      errors.push('Invalid phone number format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  private async generateTokens(user: UserProfile) {
    const tokenId = randomBytes(16).toString('hex');
    
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenId
    };

    const token = jwt.sign(tokenPayload, this.JWT_SECRET, { 
      expiresIn: this.JWT_EXPIRES_IN 
    });

    const refreshToken = jwt.sign(tokenPayload, this.JWT_REFRESH_SECRET, { 
      expiresIn: this.JWT_REFRESH_EXPIRES_IN 
    });

    // Convert expiration to seconds
    const expiresIn = this.parseExpirationToSeconds(this.JWT_EXPIRES_IN);

    return { token, refreshToken, expiresIn };
  }

  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 900;
    }
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private sanitizeUserProfile(user: UserProfile): UserProfile {
    // Remove sensitive information before sending to client
    const sanitized = { ...user };
    return sanitized;
  }

  private generateFallbackSecret(): string {
    logger.warn('JWT secret not configured, generating fallback (NOT FOR PRODUCTION)');
    return randomBytes(32).toString('hex');
  }

  private validateConfiguration(): void {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT secrets must be configured for production');
      }
    }
  }

  private isAccountActive(user: UserProfile): boolean {
    // Placeholder for account status checks
    // Could check for suspended accounts, email verification requirements, etc.
    return true;
  }

  // Database operation placeholders (implement with actual database)
  
  private async getUserByEmail(email: string): Promise<UserProfile | null> {
    // TODO: Implement database query
    logger.debug('Getting user by email', { email });
    return null;
  }

  private async getUserById(id: string): Promise<UserProfile | null> {
    // TODO: Implement database query
    logger.debug('Getting user by ID', { userId: id });
    return null;
  }

  private async getUserWithPassword(email: string): Promise<{ user: UserProfile | null, hashedPassword: string | null }> {
    // TODO: Implement database query that returns user with password hash
    logger.debug('Getting user with password', { email });
    return { user: null, hashedPassword: null };
  }

  private async saveUser(user: UserProfile, hashedPassword: string): Promise<void> {
    // TODO: Implement database save
    logger.debug('Saving user to database', { userId: user.id, email: user.email });
  }

  private async updateLastLogin(userId: string): Promise<void> {
    // TODO: Implement database update
    logger.debug('Updating last login', { userId });
  }

  private async isRefreshTokenValid(tokenId: string): Promise<boolean> {
    // TODO: Implement token blacklist check
    logger.debug('Checking refresh token validity', { tokenId });
    return true;
  }

  private async invalidateRefreshToken(tokenId: string): Promise<void> {
    // TODO: Implement token blacklisting
    logger.debug('Invalidating refresh token', { tokenId });
  }

  private async clearUserSessions(userId: string): Promise<void> {
    // TODO: Implement session clearing
    logger.debug('Clearing user sessions', { userId });
  }

  private async sendVerificationEmail(user: UserProfile): Promise<void> {
    // TODO: Implement email verification
    logger.debug('Sending verification email', { userId: user.id, email: user.email });
  }
}

// Export singleton instance
export const authService = new AuthService();
