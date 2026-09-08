/**
 * @profullstack/auth-system
 * 
 * A flexible authentication system with user registration, login/logout, 
 * password reset, and session management
 */

import { MemoryAdapter } from './adapters/memory.js';
import { JwtAdapter } from './adapters/jwt.js';
import { createPasswordUtils } from './utils/password.js';
import { createTokenUtils } from './utils/token.js';
import { createValidationUtils } from './utils/validation.js';

/**
 * Authentication System
 */
class AuthSystem {
  /**
   * Create a new Authentication System
   * @param {Object} options - Configuration options
   * @param {Object} options.adapter - Storage adapter (defaults to in-memory)
   * @param {Object} options.tokenOptions - Token configuration
   * @param {number} options.tokenOptions.accessTokenExpiry - Access token expiry in seconds (default: 1 hour)
   * @param {number} options.tokenOptions.refreshTokenExpiry - Refresh token expiry in seconds (default: 7 days)
   * @param {string} options.tokenOptions.secret - Secret for signing tokens
   * @param {Object} options.passwordOptions - Password configuration
   * @param {number} options.passwordOptions.minLength - Minimum password length (default: 8)
   * @param {boolean} options.passwordOptions.requireUppercase - Require uppercase letters (default: true)
   * @param {boolean} options.passwordOptions.requireLowercase - Require lowercase letters (default: true)
   * @param {boolean} options.passwordOptions.requireNumbers - Require numbers (default: true)
   * @param {boolean} options.passwordOptions.requireSpecialChars - Require special characters (default: false)
   * @param {Object} options.emailOptions - Email configuration
   * @param {Function} options.emailOptions.sendEmail - Function to send emails
   * @param {string} options.emailOptions.fromEmail - From email address
   * @param {string} options.emailOptions.resetPasswordTemplate - Reset password email template
   * @param {string} options.emailOptions.verificationTemplate - Email verification template
   */
  constructor(options = {}) {
    // Set up adapter
    this.adapter = options.adapter || new MemoryAdapter();
    
    // Set up token utilities
    this.tokenUtils = createTokenUtils({
      accessTokenExpiry: options.tokenOptions?.accessTokenExpiry || 3600, // 1 hour
      refreshTokenExpiry: options.tokenOptions?.refreshTokenExpiry || 604800, // 7 days
      secret: options.tokenOptions?.secret || 'default-secret-change-me'
    });
    
    // Set up password utilities
    this.passwordUtils = createPasswordUtils({
      minLength: options.passwordOptions?.minLength || 8,
      requireUppercase: options.passwordOptions?.requireUppercase !== false,
      requireLowercase: options.passwordOptions?.requireLowercase !== false,
      requireNumbers: options.passwordOptions?.requireNumbers !== false,
      requireSpecialChars: options.passwordOptions?.requireSpecialChars || false
    });
    
    // Set up validation utilities
    this.validationUtils = createValidationUtils();
    
    // Set up email options
    this.emailOptions = {
      sendEmail: options.emailOptions?.sendEmail || null,
      fromEmail: options.emailOptions?.fromEmail || 'noreply@example.com',
      resetPasswordTemplate: options.emailOptions?.resetPasswordTemplate || null,
      verificationTemplate: options.emailOptions?.verificationTemplate || null
    };
    
    // Bind methods to ensure correct 'this' context
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.resetPasswordConfirm = this.resetPasswordConfirm.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.validateToken = this.validateToken.bind(this);
    this.logout = this.logout.bind(this);
    this.middleware = this.middleware.bind(this);
  }

  /**
   * Register a new user
   * @param {Object} userData - User data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {Object} userData.profile - User profile data
   * @param {boolean} userData.autoVerify - Auto-verify email (default: false)
   * @returns {Promise<Object>} - Registration result
   */
  async register(userData) {
    try {
      const { email, password, profile = {}, autoVerify = false } = userData;
      
      // Validate email
      if (!email || !this.validationUtils.isValidEmail(email)) {
        throw new Error('Invalid email address');
      }
      
      // Validate password
      const passwordValidation = this.passwordUtils.validatePassword(password);
      if (!passwordValidation.valid) {
        throw new Error(`Invalid password: ${passwordValidation.message}`);
      }
      
      // Check if user already exists
      const existingUser = await this.adapter.getUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Hash password
      const hashedPassword = await this.passwordUtils.hashPassword(password);
      
      // Create user
      const user = await this.adapter.createUser({
        email,
        password: hashedPassword,
        profile,
        emailVerified: autoVerify,
        createdAt: new Date().toISOString()
      });
      
      // Generate verification token if not auto-verified
      if (!autoVerify && this.emailOptions.sendEmail) {
        const verificationToken = await this.tokenUtils.generateEmailVerificationToken(user.id);
        
        // Send verification email
        await this._sendVerificationEmail(email, verificationToken);
      }
      
      // Generate tokens if auto-verified
      let tokens = null;
      if (autoVerify) {
        tokens = await this.tokenUtils.generateTokens(user.id);
      }
      
      // Return user data (without password) and tokens if auto-verified
      return {
        success: true,
        message: autoVerify ? 'User registered successfully' : 'User registered successfully. Please verify your email.',
        user: this._sanitizeUser(user),
        ...(tokens && { tokens })
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login a user
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<Object>} - Login result
   */
  async login(credentials) {
    try {
      const { email, password } = credentials;
      
      // Validate email
      if (!email || !this.validationUtils.isValidEmail(email)) {
        throw new Error('Invalid email address');
      }
      
      // Get user by email
      const user = await this.adapter.getUserByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }
      
      // Verify password
      const passwordValid = await this.passwordUtils.verifyPassword(password, user.password);
      if (!passwordValid) {
        throw new Error('Invalid email or password');
      }
      
      // Check if email is verified
      if (!user.emailVerified) {
        throw new Error('Email not verified. Please verify your email before logging in.');
      }
      
      // Generate tokens
      const tokens = await this.tokenUtils.generateTokens(user.id);
      
      // Update last login timestamp
      await this.adapter.updateUser(user.id, {
        lastLoginAt: new Date().toISOString()
      });
      
      // Return user data (without password) and tokens
      return {
        success: true,
        message: 'Login successful',
        user: this._sanitizeUser(user),
        tokens
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh an access token using a refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - New tokens
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const payload = await this.tokenUtils.verifyRefreshToken(refreshToken);
      if (!payload) {
        throw new Error('Invalid refresh token');
      }
      
      // Get user by ID
      const user = await this.adapter.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate new tokens
      const tokens = await this.tokenUtils.generateTokens(user.id);
      
      // Return new tokens
      return {
        success: true,
        message: 'Token refreshed successfully',
        tokens
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Request a password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} - Password reset result
   */
  async resetPassword(email) {
    try {
      // Validate email
      if (!email || !this.validationUtils.isValidEmail(email)) {
        throw new Error('Invalid email address');
      }
      
      // Get user by email
      const user = await this.adapter.getUserByEmail(email);
      if (!user) {
        // Don't reveal that the user doesn't exist
        return {
          success: true,
          message: 'If your email is registered, you will receive a password reset link.'
        };
      }
      
      // Generate password reset token
      const resetToken = await this.tokenUtils.generatePasswordResetToken(user.id);
      
      // Send password reset email
      if (this.emailOptions.sendEmail) {
        await this._sendPasswordResetEmail(email, resetToken);
      }
      
      // Return success
      return {
        success: true,
        message: 'If your email is registered, you will receive a password reset link.',
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Confirm a password reset
   * @param {Object} resetData - Password reset data
   * @param {string} resetData.token - Password reset token
   * @param {string} resetData.password - New password
   * @returns {Promise<Object>} - Password reset result
   */
  async resetPasswordConfirm(resetData) {
    try {
      const { token, password } = resetData;
      
      // Verify reset token
      const payload = await this.tokenUtils.verifyPasswordResetToken(token);
      if (!payload) {
        throw new Error('Invalid or expired password reset token');
      }
      
      // Validate password
      const passwordValidation = this.passwordUtils.validatePassword(password);
      if (!passwordValidation.valid) {
        throw new Error(`Invalid password: ${passwordValidation.message}`);
      }
      
      // Get user by ID
      const user = await this.adapter.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Hash new password
      const hashedPassword = await this.passwordUtils.hashPassword(password);
      
      // Update user password. Stamp passwordChangedAt so that any access
      // tokens issued before this moment are rejected by validateToken()
      // (a password change / reset must revoke previously issued sessions).
      await this.adapter.updateUser(user.id, {
        password: hashedPassword,
        passwordChangedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Invalidate the reset token so it cannot be replayed. Reset tokens are
      // JWTs valid for a full hour; without this, the same token could be
      // submitted again (e.g. leaked via history/referer/logs) to set another
      // password within that window. Done after the DB update so a failed
      // write never burns a still-valid token.
      await this.tokenUtils.invalidateToken(token);

      // Return success
      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify a user's email
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} - Email verification result
   */
  async verifyEmail(token) {
    try {
      // Verify email verification token
      const payload = await this.tokenUtils.verifyEmailVerificationToken(token);
      if (!payload) {
        throw new Error('Invalid or expired email verification token');
      }
      
      // Get user by ID
      const user = await this.adapter.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update user email verification status
      await this.adapter.updateUser(user.id, {
        emailVerified: true,
        updatedAt: new Date().toISOString()
      });

      // Invalidate the verification token so it cannot be replayed. Like the
      // password reset token, this is a JWT valid for a long window (24h);
      // without this, the same token could be resubmitted (e.g. leaked via
      // browser history, referer, or mail server link-prefetching) to mint a
      // fresh set of live session tokens for the account at any time before
      // expiry, regardless of whether the email was already verified.
      await this.tokenUtils.invalidateToken(token);

      // Generate tokens
      const tokens = await this.tokenUtils.generateTokens(user.id);

      // Return success
      return {
        success: true,
        message: 'Email verified successfully',
        user: this._sanitizeUser(user),
        tokens
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Change a user's password
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.userId - User ID
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Promise<Object>} - Password change result
   */
  async changePassword(passwordData) {
    try {
      const { userId, currentPassword, newPassword } = passwordData;
      
      // Get user by ID
      const user = await this.adapter.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const passwordValid = await this.passwordUtils.verifyPassword(currentPassword, user.password);
      if (!passwordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Validate new password
      const passwordValidation = this.passwordUtils.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        throw new Error(`Invalid password: ${passwordValidation.message}`);
      }
      
      // Hash new password
      const hashedPassword = await this.passwordUtils.hashPassword(newPassword);
      
      // Update user password. Stamp passwordChangedAt so that any access
      // tokens issued before this moment are rejected by validateToken()
      // (a password change / reset must revoke previously issued sessions).
      await this.adapter.updateUser(user.id, {
        password: hashedPassword,
        passwordChangedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Return success
      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a user's profile
   * @param {Object} profileData - Profile update data
   * @param {string} profileData.userId - User ID
   * @param {Object} profileData.profile - Profile data
   * @returns {Promise<Object>} - Profile update result
   */
  async updateProfile(profileData) {
    try {
      const { userId, profile } = profileData;
      
      // Get user by ID
      const user = await this.adapter.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update user profile
      await this.adapter.updateUser(userId, {
        profile: { ...user.profile, ...profile },
        updatedAt: new Date().toISOString()
      });
      
      // Get updated user
      const updatedUser = await this.adapter.getUserById(userId);
      
      // Return success
      return {
        success: true,
        message: 'Profile updated successfully',
        user: this._sanitizeUser(updatedUser)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a user's profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User profile
   */
  async getProfile(userId) {
    try {
      // Get user by ID
      const user = await this.adapter.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Return user data (without password)
      return {
        success: true,
        user: this._sanitizeUser(user)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate an access token
   * @param {string} token - Access token
   * @returns {Promise<Object|null>} - Token payload if valid, null otherwise
   */
  async validateToken(token) {
    try {
      // Verify access token
      const payload = await this.tokenUtils.verifyAccessToken(token);
      if (!payload) {
        return null;
      }
      
      // Get user by ID
      const user = await this.adapter.getUserById(payload.userId);
      if (!user) {
        return null;
      }

      // Reject tokens issued before the user's most recent password change /
      // reset. JWT `iat` is in seconds; passwordChangedAt is an ISO string.
      // Guarded so users without the field (issued before this feature) are
      // unaffected.
      if (user.passwordChangedAt && payload.iat) {
        const changedAtMs = new Date(user.passwordChangedAt).getTime();
        if (!Number.isNaN(changedAtMs) && payload.iat * 1000 < changedAtMs) {
          return null;
        }
      }

      // Return user data (without password)
      return {
        userId: user.id,
        email: user.email,
        profile: user.profile,
        emailVerified: user.emailVerified
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout a user
   * @param {string} refreshToken - Refresh token
   * @param {string} [accessToken] - Access token to also revoke (recommended)
   * @returns {Promise<Object>} - Logout result
   */
  async logout(refreshToken, accessToken) {
    try {
      // Invalidate refresh token
      await this.tokenUtils.invalidateRefreshToken(refreshToken);

      // Also invalidate the access token if the caller supplies it, so a
      // stolen/leaked access token cannot be used until its natural expiry
      // after the user logs out. Optional and backward-compatible.
      if (accessToken) {
        await this.tokenUtils.invalidateToken(accessToken);
      }

      // Return success
      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Authentication middleware for Express/Connect/Hono
   * @returns {Function} - Middleware function
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.substring(7);
        
        // Validate token
        const user = await this.validateToken(token);
        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Set user in request
        req.user = user;
        
        // Continue to next middleware
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    };
  }

  /**
   * Send a password reset email
   * @private
   * @param {string} email - User email
   * @param {string} token - Password reset token
   * @returns {Promise<void>}
   */
  async _sendPasswordResetEmail(email, token) {
    if (!this.emailOptions.sendEmail) {
      return;
    }
    
    // Use custom template if provided, otherwise use default
    const template = this.emailOptions.resetPasswordTemplate || {
      subject: 'Password Reset',
      text: `Click the link below to reset your password:\n\n${token}`,
      html: `<p>Click the link below to reset your password:</p><p><a href="${token}">${token}</a></p>`
    };
    
    // Send email
    await this.emailOptions.sendEmail({
      to: email,
      from: this.emailOptions.fromEmail,
      subject: template.subject,
      text: template.text,
      html: template.html
    });
  }

  /**
   * Send an email verification email
   * @private
   * @param {string} email - User email
   * @param {string} token - Email verification token
   * @returns {Promise<void>}
   */
  async _sendVerificationEmail(email, token) {
    if (!this.emailOptions.sendEmail) {
      return;
    }
    
    // Use custom template if provided, otherwise use default
    const template = this.emailOptions.verificationTemplate || {
      subject: 'Email Verification',
      text: `Click the link below to verify your email:\n\n${token}`,
      html: `<p>Click the link below to verify your email:</p><p><a href="${token}">${token}</a></p>`
    };
    
    // Send email
    await this.emailOptions.sendEmail({
      to: email,
      from: this.emailOptions.fromEmail,
      subject: template.subject,
      text: template.text,
      html: template.html
    });
  }

  /**
   * Remove sensitive data from user object
   * @private
   * @param {Object} user - User object
   * @returns {Object} - Sanitized user object
   */
  _sanitizeUser(user) {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

// Create adapters
export { MemoryAdapter } from './adapters/memory.js';
export { JwtAdapter } from './adapters/jwt.js';
export { SupabaseAdapter } from './adapters/supabase.js';
export { MySQLAdapter } from './adapters/mysql.js';
export { PostgresAdapter } from './adapters/postgres.js';
export { MongoDBAdapter } from './adapters/mongodb.js';
export { PocketBaseAdapter } from './adapters/pocketbase.js';

// Create utilities
export { createPasswordUtils } from './utils/password.js';
export { createTokenUtils } from './utils/token.js';
export { createValidationUtils } from './utils/validation.js';

// Export the AuthSystem class
export { AuthSystem };

// Export a factory function for convenience
export function createAuthSystem(options = {}) {
  return new AuthSystem(options);
}

// Import and export AuthClient for browser integration
export { AuthClient } from './client/auth-client.js';

// Default export
export default createAuthSystem;