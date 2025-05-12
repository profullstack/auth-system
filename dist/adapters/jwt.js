/**
 * JWT Adapter for Auth System
 * 
 * This adapter uses JSON Web Tokens (JWT) for authentication.
 * It requires a database adapter for user storage.
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * JWT Adapter
 */
export class JwtAdapter {
  /**
   * Create a new JWT Adapter
   * @param {Object} options - Configuration options
   * @param {Object} options.dbAdapter - Database adapter for user storage
   * @param {string} options.secret - Secret for signing tokens
   * @param {number} options.accessTokenExpiry - Access token expiry in seconds (default: 1 hour)
   * @param {number} options.refreshTokenExpiry - Refresh token expiry in seconds (default: 7 days)
   */
  constructor(options) {
    if (!options.dbAdapter) {
      throw new Error('Database adapter is required');
    }
    
    this.dbAdapter = options.dbAdapter;
    this.secret = options.secret || 'default-secret-change-me';
    this.accessTokenExpiry = options.accessTokenExpiry || 3600; // 1 hour
    this.refreshTokenExpiry = options.refreshTokenExpiry || 604800; // 7 days
    this.invalidatedTokens = new Set();
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user
   */
  async createUser(userData) {
    return this.dbAdapter.createUser(userData);
  }

  /**
   * Get a user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserById(userId) {
    return this.dbAdapter.getUserById(userId);
  }

  /**
   * Get a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserByEmail(email) {
    return this.dbAdapter.getUserByEmail(email);
  }

  /**
   * Update a user
   * @param {string} userId - User ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - Updated user
   */
  async updateUser(userId, updates) {
    return this.dbAdapter.updateUser(userId, updates);
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Whether the user was deleted
   */
  async deleteUser(userId) {
    return this.dbAdapter.deleteUser(userId);
  }

  /**
   * Generate an access token
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Access token
   */
  async generateAccessToken(userId) {
    const payload = {
      userId,
      type: 'access',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, this.secret, {
      expiresIn: this.accessTokenExpiry
    });
  }

  /**
   * Generate a refresh token
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Refresh token
   */
  async generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, this.secret, {
      expiresIn: this.refreshTokenExpiry
    });
  }

  /**
   * Generate access and refresh tokens
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Tokens
   */
  async generateTokens(userId) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId),
      this.generateRefreshToken(userId)
    ]);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiry
    };
  }

  /**
   * Verify an access token
   * @param {string} token - Access token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async verifyAccessToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, this.secret);
      
      // Check token type
      if (payload.type !== 'access') {
        return null;
      }
      
      // Check if token is invalidated
      if (await this.isTokenInvalidated(token)) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify a refresh token
   * @param {string} token - Refresh token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async verifyRefreshToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, this.secret);
      
      // Check token type
      if (payload.type !== 'refresh') {
        return null;
      }
      
      // Check if token is invalidated
      if (await this.isTokenInvalidated(token)) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a password reset token
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Password reset token
   */
  async generatePasswordResetToken(userId) {
    const payload = {
      userId,
      type: 'password_reset',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, this.secret, {
      expiresIn: 3600 // 1 hour
    });
  }

  /**
   * Verify a password reset token
   * @param {string} token - Password reset token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async verifyPasswordResetToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, this.secret);
      
      // Check token type
      if (payload.type !== 'password_reset') {
        return null;
      }
      
      // Check if token is invalidated
      if (await this.isTokenInvalidated(token)) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate an email verification token
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Email verification token
   */
  async generateEmailVerificationToken(userId) {
    const payload = {
      userId,
      type: 'email_verification',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, this.secret, {
      expiresIn: 86400 // 24 hours
    });
  }

  /**
   * Verify an email verification token
   * @param {string} token - Email verification token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async verifyEmailVerificationToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, this.secret);
      
      // Check token type
      if (payload.type !== 'email_verification') {
        return null;
      }
      
      // Check if token is invalidated
      if (await this.isTokenInvalidated(token)) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Invalidate a token
   * @param {string} token - Token to invalidate
   * @returns {Promise<void>}
   */
  async invalidateToken(token) {
    try {
      // Add to invalidated tokens set
      this.invalidatedTokens.add(token);
      
      // Also add to database adapter if it supports token invalidation
      if (typeof this.dbAdapter.invalidateToken === 'function') {
        await this.dbAdapter.invalidateToken(token);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Check if a token is invalidated
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} - Whether the token is invalidated
   */
  async isTokenInvalidated(token) {
    // Check in-memory set
    if (this.invalidatedTokens.has(token)) {
      return true;
    }
    
    // Check database adapter if it supports token invalidation
    if (typeof this.dbAdapter.isTokenInvalidated === 'function') {
      return await this.dbAdapter.isTokenInvalidated(token);
    }
    
    return false;
  }
}

export default JwtAdapter;