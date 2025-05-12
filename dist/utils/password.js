/**
 * Password Utilities for Auth System
 * 
 * Provides functions for password hashing, verification, and validation.
 */

import bcrypt from 'bcryptjs';

/**
 * Create password utilities
 * @param {Object} options - Configuration options
 * @param {number} options.minLength - Minimum password length (default: 8)
 * @param {boolean} options.requireUppercase - Require uppercase letters (default: true)
 * @param {boolean} options.requireLowercase - Require lowercase letters (default: true)
 * @param {boolean} options.requireNumbers - Require numbers (default: true)
 * @param {boolean} options.requireSpecialChars - Require special characters (default: false)
 * @param {number} options.saltRounds - Number of salt rounds for bcrypt (default: 10)
 * @returns {Object} - Password utilities
 */
export function createPasswordUtils(options = {}) {
  // Default options
  const config = {
    minLength: options.minLength || 8,
    requireUppercase: options.requireUppercase !== false,
    requireLowercase: options.requireLowercase !== false,
    requireNumbers: options.requireNumbers !== false,
    requireSpecialChars: options.requireSpecialChars || false,
    saltRounds: options.saltRounds || 10
  };
  
  /**
   * Hash a password
   * @param {string} password - Password to hash
   * @returns {Promise<string>} - Hashed password
   */
  async function hashPassword(password) {
    return bcrypt.hash(password, config.saltRounds);
  }
  
  /**
   * Verify a password against a hash
   * @param {string} password - Password to verify
   * @param {string} hash - Hash to verify against
   * @returns {Promise<boolean>} - Whether the password is valid
   */
  async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
  
  /**
   * Validate a password against requirements
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result
   * @returns {boolean} result.valid - Whether the password is valid
   * @returns {string} result.message - Error message if invalid
   */
  function validatePassword(password) {
    // Check if password is provided
    if (!password) {
      return {
        valid: false,
        message: 'Password is required'
      };
    }
    
    // Check minimum length
    if (password.length < config.minLength) {
      return {
        valid: false,
        message: `Password must be at least ${config.minLength} characters long`
      };
    }
    
    // Check for uppercase letters
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one uppercase letter'
      };
    }
    
    // Check for lowercase letters
    if (config.requireLowercase && !/[a-z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one lowercase letter'
      };
    }
    
    // Check for numbers
    if (config.requireNumbers && !/[0-9]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one number'
      };
    }
    
    // Check for special characters
    if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one special character'
      };
    }
    
    // Password is valid
    return {
      valid: true,
      message: 'Password is valid'
    };
  }
  
  /**
   * Generate a random password
   * @param {number} length - Password length (default: config.minLength)
   * @returns {string} - Random password
   */
  function generateRandomPassword(length = config.minLength) {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // Create character pool based on requirements
    let charPool = '';
    if (config.requireUppercase) charPool += uppercaseChars;
    if (config.requireLowercase) charPool += lowercaseChars;
    if (config.requireNumbers) charPool += numberChars;
    if (config.requireSpecialChars) charPool += specialChars;
    
    // If no requirements, use all character types
    if (charPool === '') {
      charPool = uppercaseChars + lowercaseChars + numberChars;
    }
    
    // Generate password
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charPool.length);
      password += charPool[randomIndex];
    }
    
    // Ensure password meets requirements
    let passwordValid = validatePassword(password).valid;
    
    // If not valid, add required character types
    if (!passwordValid) {
      if (config.requireUppercase && !/[A-Z]/.test(password)) {
        const randomIndex = Math.floor(Math.random() * uppercaseChars.length);
        password = password.substring(0, password.length - 1) + uppercaseChars[randomIndex];
      }
      
      if (config.requireLowercase && !/[a-z]/.test(password)) {
        const randomIndex = Math.floor(Math.random() * lowercaseChars.length);
        password = password.substring(0, password.length - 1) + lowercaseChars[randomIndex];
      }
      
      if (config.requireNumbers && !/[0-9]/.test(password)) {
        const randomIndex = Math.floor(Math.random() * numberChars.length);
        password = password.substring(0, password.length - 1) + numberChars[randomIndex];
      }
      
      if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
        const randomIndex = Math.floor(Math.random() * specialChars.length);
        password = password.substring(0, password.length - 1) + specialChars[randomIndex];
      }
    }
    
    return password;
  }
  
  // Return password utilities
  return {
    hashPassword,
    verifyPassword,
    validatePassword,
    generateRandomPassword
  };
}

export default createPasswordUtils;