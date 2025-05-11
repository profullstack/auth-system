/**
 * Token Utilities for Auth System
 * 
 * Provides functions for generating and verifying tokens.
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create token utilities
 * @param {Object} options - Configuration options
 * @param {number} options.accessTokenExpiry - Access token expiry in seconds (default: 1 hour)
 * @param {number} options.refreshTokenExpiry - Refresh token expiry in seconds (default: 7 days)
 * @param {string} options.secret - Secret for signing tokens
 * @returns {Object} - Token utilities
 */
export function createTokenUtils(options = {}) {
  // Default options
  const config = {
    accessTokenExpiry: options.accessTokenExpiry || 3600, // 1 hour
    refreshTokenExpiry: options.refreshTokenExpiry || 604800, // 7 days
    secret: options.secret || 'default-secret-change-me'
  };
  
  // Store invalidated tokens
  const invalidatedTokens = new Set();
  
  /**
   * Generate an access token
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Access token
   */
  async function generateAccessToken(userId) {
    const payload = {
      userId,
      type: 'access',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, config.secret, {
      expiresIn: config.accessTokenExpiry
    });
  }
  
  /**
   * Generate a refresh token
   * @param {string} userId - User ID
   * @returns {Promise<string>} - Refresh token
   */
  async function generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, config.secret, {
      expiresIn: config.refreshTokenExpiry
    });
  }
  
  /**
   * Generate access and refresh tokens
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Tokens
   */
  async function generateTokens(userId) {
    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(userId),
      generateRefreshToken(userId)
    ]);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: config.accessTokenExpiry
    };
  }
  
  /**
   * Verify an access token
   * @param {string} token - Access token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async function verifyAccessToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, config.secret);
      
      // Check token type
      if (payload.type !== 'access') {
        return null;
      }
      
      // Check if token is invalidated
      if (await isTokenInvalidated(token)) {
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
  async function verifyRefreshToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, config.secret);
      
      // Check token type
      if (payload.type !== 'refresh') {
        return null;
      }
      
      // Check if token is invalidated
      if (await isTokenInvalidated(token)) {
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
  async function generatePasswordResetToken(userId) {
    const payload = {
      userId,
      type: 'password_reset',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, config.secret, {
      expiresIn: 3600 // 1 hour
    });
  }
  
  /**
   * Verify a password reset token
   * @param {string} token - Password reset token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async function verifyPasswordResetToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, config.secret);
      
      // Check token type
      if (payload.type !== 'password_reset') {
        return null;
      }
      
      // Check if token is invalidated
      if (await isTokenInvalidated(token)) {
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
  async function generateEmailVerificationToken(userId) {
    const payload = {
      userId,
      type: 'email_verification',
      jti: uuidv4() // JWT ID for token revocation
    };
    
    return jwt.sign(payload, config.secret, {
      expiresIn: 86400 // 24 hours
    });
  }
  
  /**
   * Verify an email verification token
   * @param {string} token - Email verification token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async function verifyEmailVerificationToken(token) {
    try {
      // Verify token
      const payload = jwt.verify(token, config.secret);
      
      // Check token type
      if (payload.type !== 'email_verification') {
        return null;
      }
      
      // Check if token is invalidated
      if (await isTokenInvalidated(token)) {
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
  async function invalidateToken(token) {
    invalidatedTokens.add(token);
  }
  
  /**
   * Invalidate a refresh token
   * @param {string} token - Refresh token to invalidate
   * @returns {Promise<void>}
   */
  async function invalidateRefreshToken(token) {
    invalidateToken(token);
  }
  
  /**
   * Check if a token is invalidated
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} - Whether the token is invalidated
   */
  async function isTokenInvalidated(token) {
    return invalidatedTokens.has(token);
  }
  
  /**
   * Decode a token without verification
   * @param {string} token - Token to decode
   * @returns {Object|null} - Decoded token payload or null if invalid
   */
  function decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }
  
  // Return token utilities
  return {
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    generatePasswordResetToken,
    verifyPasswordResetToken,
    generateEmailVerificationToken,
    verifyEmailVerificationToken,
    invalidateToken,
    invalidateRefreshToken,
    isTokenInvalidated,
    decodeToken
  };
}

export default createTokenUtils;