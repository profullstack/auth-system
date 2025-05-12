/**
 * Auth Client for Browser Integration
 * 
 * This client provides a browser-friendly wrapper around the auth-system module,
 * with localStorage integration for token storage and event handling.
 */

import { createAuthSystem, SupabaseAdapter } from '../../src/index.js';

export class AuthClient {
  /**
   * Create a new AuthClient
   * @param {Object} options - Configuration options
   * @param {string} options.supabaseUrl - Supabase project URL
   * @param {string} options.supabaseKey - Supabase API key
   * @param {string} options.jwtSecret - Secret for signing JWT tokens
   * @param {Function} options.onAuthChanged - Callback for auth state changes
   * @param {Function} options.sendEmail - Function to send emails
   * @param {Object} options.subscriptionApi - API for subscription management
   */
  constructor(options) {
    this.options = options;
    
    // Create Supabase adapter
    this.adapter = new SupabaseAdapter({
      supabaseUrl: options.supabaseUrl,
      supabaseKey: options.supabaseKey,
      tableName: options.tableName || 'users',
      tokensTableName: options.tokensTableName || 'invalidated_tokens'
    });
    
    // Create auth system
    this.auth = createAuthSystem({
      adapter: this.adapter,
      tokenOptions: {
        secret: options.jwtSecret,
        accessTokenExpiry: options.accessTokenExpiry || 3600, // 1 hour
        refreshTokenExpiry: options.refreshTokenExpiry || 604800 // 7 days
      },
      passwordOptions: {
        minLength: options.minPasswordLength || 8,
        requireUppercase: options.requireUppercase !== false,
        requireLowercase: options.requireLowercase !== false,
        requireNumbers: options.requireNumbers !== false,
        requireSpecialChars: options.requireSpecialChars || false
      },
      emailOptions: {
        sendEmail: options.sendEmail || this._defaultSendEmail.bind(this),
        fromEmail: options.fromEmail || 'noreply@example.com',
        resetPasswordTemplate: options.resetPasswordTemplate || {
          subject: 'Reset Your Password',
          text: 'Click the link to reset your password: {token}',
          html: '<p>Click the link to reset your password: <a href="{token}">{token}</a></p>'
        },
        verificationTemplate: options.verificationTemplate || {
          subject: 'Verify Your Email',
          text: 'Click the link to verify your email: {token}',
          html: '<p>Click the link to verify your email: <a href="{token}">{token}</a></p>'
        }
      }
    });
    
    // Subscription API integration
    this.subscriptionApi = options.subscriptionApi;
    
    // Set up auth state change handler
    this.onAuthChanged = options.onAuthChanged || (() => {});
    
    // Initialize from localStorage
    this._initFromLocalStorage();
  }
  
  /**
   * Initialize from localStorage
   * @private
   */
  _initFromLocalStorage() {
    // Check for existing token
    this.accessToken = localStorage.getItem('jwt_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    
    // If we have a token, validate it
    if (this.accessToken) {
      this.validateToken(this.accessToken)
        .then(user => {
          if (user) {
            this.user = user;
            this._saveUserToLocalStorage(user);
          } else {
            // Token is invalid, try to refresh
            if (this.refreshToken) {
              this.refreshToken(this.refreshToken)
                .catch(() => {
                  // If refresh fails, clear auth state
                  this._clearAuthState();
                });
            } else {
              // No refresh token, clear auth state
              this._clearAuthState();
            }
          }
        })
        .catch(() => {
          // Error validating token, clear auth state
          this._clearAuthState();
        });
    }
  }
  
  /**
   * Default send email function (console log only)
   * @private
   * @param {Object} emailData - Email data
   */
  async _defaultSendEmail(emailData) {
    console.log('Sending email:', emailData);
    // In a real implementation, this would send an email
  }
  
  /**
   * Save tokens to localStorage
   * @private
   * @param {Object} tokens - Tokens object
   */
  _saveTokensToLocalStorage(tokens) {
    if (tokens.accessToken) {
      localStorage.setItem('jwt_token', tokens.accessToken);
      this.accessToken = tokens.accessToken;
    }
    
    if (tokens.refreshToken) {
      localStorage.setItem('refresh_token', tokens.refreshToken);
      this.refreshToken = tokens.refreshToken;
    }
  }
  
  /**
   * Save user to localStorage
   * @private
   * @param {Object} user - User object
   */
  _saveUserToLocalStorage(user) {
    // Create a sanitized user object without sensitive data
    const sanitizedUser = {
      id: user.id,
      email: user.email,
      username: user.email ? user.email.split('@')[0] : null,
      profile: user.profile || {},
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      subscription: user.subscription || { status: 'unknown' }
    };
    
    localStorage.setItem('user', JSON.stringify(sanitizedUser));
    localStorage.setItem('username', user.email);
    this.user = sanitizedUser;
  }
  
  /**
   * Clear auth state
   * @private
   */
  _clearAuthState() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    localStorage.removeItem('subscription_data');
    
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    
    // Trigger auth changed event
    this._triggerAuthChanged();
  }
  
  /**
   * Trigger auth changed event
   * @private
   */
  _triggerAuthChanged() {
    // Call the onAuthChanged callback
    this.onAuthChanged(this.isAuthenticated(), this.user);
    
    // Dispatch a custom event
    window.dispatchEvent(new CustomEvent('auth-changed', {
      detail: {
        authenticated: this.isAuthenticated(),
        user: this.user
      }
    }));
  }
  
  /**
   * Check if user is authenticated
   * @returns {boolean} - Whether the user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken && !!this.user;
  }
  
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {Object} userData.profile - User profile data
   * @param {boolean} userData.autoVerify - Auto-verify email (default: false)
   * @returns {Promise<Object>} - Registration result
   */
  async register(userData) {
    try {
      // Register user with auth system
      const result = await this.auth.register(userData);
      
      // If auto-verified, save tokens and user data
      if (result.tokens) {
        this._saveTokensToLocalStorage(result.tokens);
        this._saveUserToLocalStorage(result.user);
        
        // Trigger auth changed event
        this._triggerAuthChanged();
      }
      
      return result;
    } catch (error) {
      console.error('Registration error:', error);
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
      // Login user with auth system
      const result = await this.auth.login(credentials);
      
      // Save tokens and user data
      this._saveTokensToLocalStorage(result.tokens);
      this._saveUserToLocalStorage(result.user);
      
      // Check subscription status if subscription API is provided
      if (this.subscriptionApi && typeof this.subscriptionApi.checkSubscriptionStatus === 'function') {
        try {
          const subscriptionStatus = await this.subscriptionApi.checkSubscriptionStatus(credentials.email);
          
          // Update user with subscription data
          if (subscriptionStatus) {
            const updatedUser = {
              ...this.user,
              subscription: {
                plan: subscriptionStatus.plan || 'monthly',
                status: subscriptionStatus.status || 'active',
                expiresAt: subscriptionStatus.expires_at || null
              }
            };
            
            this._saveUserToLocalStorage(updatedUser);
            localStorage.setItem('subscription_data', JSON.stringify(subscriptionStatus));
          }
        } catch (subscriptionError) {
          console.warn('Error checking subscription status:', subscriptionError);
          // Continue even if subscription check fails
        }
      }
      
      // Trigger auth changed event
      this._triggerAuthChanged();
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  
  /**
   * Logout a user
   * @returns {Promise<Object>} - Logout result
   */
  async logout() {
    try {
      // Logout user with auth system if we have a refresh token
      if (this.refreshToken) {
        await this.auth.logout(this.refreshToken);
      }
      
      // Clear auth state
      this._clearAuthState();
      
      return { success: true, message: 'Logout successful' };
    } catch (error) {
      console.error('Logout error:', error);
      
      // Clear auth state even if logout fails
      this._clearAuthState();
      
      throw error;
    }
  }
  
  /**
   * Refresh an access token
   * @returns {Promise<Object>} - Refresh result
   */
  async refreshToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      // Refresh token with auth system
      const result = await this.auth.refreshToken(this.refreshToken);
      
      // Save new tokens
      this._saveTokensToLocalStorage(result.tokens);
      
      return result;
    } catch (error) {
      console.error('Token refresh error:', error);
      
      // Clear auth state if refresh fails
      this._clearAuthState();
      
      throw error;
    }
  }
  
  /**
   * Validate an access token
   * @returns {Promise<Object|null>} - User data if token is valid, null otherwise
   */
  async validateToken() {
    try {
      if (!this.accessToken) {
        return null;
      }
      
      // Validate token with auth system
      return await this.auth.validateToken(this.accessToken);
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }
  
  /**
   * Check authentication status
   * @returns {Promise<Object>} - Auth status
   */
  async checkAuthStatus() {
    try {
      // Validate current token
      const user = await this.validateToken();
      
      if (user) {
        return {
          authenticated: true,
          user,
          message: 'Authenticated'
        };
      } else {
        // Try to refresh token
        if (this.refreshToken) {
          try {
            await this.refreshToken();
            
            // Validate again after refresh
            const refreshedUser = await this.validateToken();
            
            if (refreshedUser) {
              return {
                authenticated: true,
                user: refreshedUser,
                message: 'Authenticated after token refresh'
              };
            }
          } catch (refreshError) {
            console.error('Error refreshing token:', refreshError);
          }
        }
        
        // If we get here, authentication failed
        this._clearAuthState();
        
        return {
          authenticated: false,
          user: null,
          message: 'Not authenticated'
        };
      }
    } catch (error) {
      console.error('Auth status check error:', error);
      
      // Clear auth state if check fails
      this._clearAuthState();
      
      return {
        authenticated: false,
        user: null,
        message: 'Error checking authentication status'
      };
    }
  }
  
  /**
   * Request a password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} - Password reset result
   */
  async resetPassword(email) {
    try {
      return await this.auth.resetPassword(email);
    } catch (error) {
      console.error('Password reset error:', error);
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
      return await this.auth.resetPasswordConfirm(resetData);
    } catch (error) {
      console.error('Password reset confirmation error:', error);
      throw error;
    }
  }
  
  /**
   * Change a user's password
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Promise<Object>} - Password change result
   */
  async changePassword(passwordData) {
    try {
      if (!this.user || !this.user.id) {
        throw new Error('User not authenticated');
      }
      
      return await this.auth.changePassword({
        userId: this.user.id,
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  }
  
  /**
   * Update a user's profile
   * @param {Object} profileData - Profile update data
   * @returns {Promise<Object>} - Profile update result
   */
  async updateProfile(profileData) {
    try {
      if (!this.user || !this.user.id) {
        throw new Error('User not authenticated');
      }
      
      const result = await this.auth.updateProfile({
        userId: this.user.id,
        profile: profileData
      });
      
      // Update user in localStorage
      this._saveUserToLocalStorage(result.user);
      
      return result;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }
  
  /**
   * Get a user's profile
   * @returns {Promise<Object>} - User profile
   */
  async getProfile() {
    try {
      if (!this.user || !this.user.id) {
        throw new Error('User not authenticated');
      }
      
      const result = await this.auth.getProfile(this.user.id);
      
      // Update user in localStorage
      this._saveUserToLocalStorage(result.user);
      
      return result;
    } catch (error) {
      console.error('Get profile error:', error);
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
      const result = await this.auth.verifyEmail(token);
      
      // If verification successful, save tokens and user data
      if (result.tokens) {
        this._saveTokensToLocalStorage(result.tokens);
        this._saveUserToLocalStorage(result.user);
        
        // Trigger auth changed event
        this._triggerAuthChanged();
      }
      
      return result;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }
  
  /**
   * Delete a user's account
   * @returns {Promise<boolean>} - Whether the account was deleted
   */
  async deleteAccount() {
    try {
      if (!this.user || !this.user.id) {
        throw new Error('User not authenticated');
      }
      
      // Delete user with auth system
      const result = await this.auth.adapter.deleteUser(this.user.id);
      
      // Clear auth state
      this._clearAuthState();
      
      return result;
    } catch (error) {
      console.error('Account deletion error:', error);
      throw error;
    }
  }
  
  /**
   * Create a subscription for a user
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} - Subscription result
   */
  async createSubscription(subscriptionData) {
    try {
      if (!this.subscriptionApi || typeof this.subscriptionApi.createSubscription !== 'function') {
        throw new Error('Subscription API not available');
      }
      
      if (!this.user || !this.user.email) {
        throw new Error('User not authenticated');
      }
      
      // Create subscription with subscription API
      const result = await this.subscriptionApi.createSubscription(
        this.user.email,
        subscriptionData.plan,
        subscriptionData.paymentMethod
      );
      
      // Update user with subscription data
      if (result && result.subscription) {
        const updatedUser = {
          ...this.user,
          subscription: {
            plan: result.subscription.plan || subscriptionData.plan,
            status: result.subscription.status || 'pending',
            expiresAt: result.subscription.expires_at || null
          }
        };
        
        this._saveUserToLocalStorage(updatedUser);
        localStorage.setItem('subscription_data', JSON.stringify(result));
      }
      
      return result;
    } catch (error) {
      console.error('Subscription creation error:', error);
      throw error;
    }
  }
  
  /**
   * Check subscription status
   * @returns {Promise<Object>} - Subscription status
   */
  async checkSubscriptionStatus() {
    try {
      if (!this.subscriptionApi || typeof this.subscriptionApi.checkSubscriptionStatus !== 'function') {
        throw new Error('Subscription API not available');
      }
      
      if (!this.user || !this.user.email) {
        throw new Error('User not authenticated');
      }
      
      // Check subscription status with subscription API
      const result = await this.subscriptionApi.checkSubscriptionStatus(this.user.email);
      
      // Update user with subscription data
      if (result) {
        const updatedUser = {
          ...this.user,
          subscription: {
            plan: result.plan || 'unknown',
            status: result.status || 'unknown',
            expiresAt: result.expires_at || null
          }
        };
        
        this._saveUserToLocalStorage(updatedUser);
        localStorage.setItem('subscription_data', JSON.stringify(result));
      }
      
      return result;
    } catch (error) {
      console.error('Subscription status check error:', error);
      throw error;
    }
  }
}

export default AuthClient;