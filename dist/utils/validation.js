/**
 * Validation Utilities for Auth System
 * 
 * Provides functions for validating user input.
 */

/**
 * Create validation utilities
 * @returns {Object} - Validation utilities
 */
export function createValidationUtils() {
  /**
   * Validate an email address
   * @param {string} email - Email address to validate
   * @returns {boolean} - Whether the email is valid
   */
  function isValidEmail(email) {
    if (!email) {
      return false;
    }
    
    // Basic email validation regex
    // This is a simple regex that checks for the basic format of an email address
    // For production use, consider using a more comprehensive validation library
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Validate a username
   * @param {string} username - Username to validate
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum username length (default: 3)
   * @param {number} options.maxLength - Maximum username length (default: 30)
   * @param {RegExp} options.allowedChars - Allowed characters regex (default: alphanumeric, underscore, hyphen)
   * @returns {Object} - Validation result
   * @returns {boolean} result.valid - Whether the username is valid
   * @returns {string} result.message - Error message if invalid
   */
  function validateUsername(username, options = {}) {
    // Default options
    const config = {
      minLength: options.minLength || 3,
      maxLength: options.maxLength || 30,
      allowedChars: options.allowedChars || /^[a-zA-Z0-9_-]+$/
    };
    
    // Check if username is provided
    if (!username) {
      return {
        valid: false,
        message: 'Username is required'
      };
    }
    
    // Check minimum length
    if (username.length < config.minLength) {
      return {
        valid: false,
        message: `Username must be at least ${config.minLength} characters long`
      };
    }
    
    // Check maximum length
    if (username.length > config.maxLength) {
      return {
        valid: false,
        message: `Username must be at most ${config.maxLength} characters long`
      };
    }
    
    // Check allowed characters
    if (!config.allowedChars.test(username)) {
      return {
        valid: false,
        message: 'Username contains invalid characters'
      };
    }
    
    // Username is valid
    return {
      valid: true,
      message: 'Username is valid'
    };
  }
  
  /**
   * Validate a name (first name, last name, etc.)
   * @param {string} name - Name to validate
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum name length (default: 1)
   * @param {number} options.maxLength - Maximum name length (default: 50)
   * @param {boolean} options.allowSpaces - Allow spaces in name (default: true)
   * @returns {Object} - Validation result
   * @returns {boolean} result.valid - Whether the name is valid
   * @returns {string} result.message - Error message if invalid
   */
  function validateName(name, options = {}) {
    // Default options
    const config = {
      minLength: options.minLength || 1,
      maxLength: options.maxLength || 50,
      allowSpaces: options.allowSpaces !== false
    };
    
    // Check if name is provided
    if (!name) {
      return {
        valid: false,
        message: 'Name is required'
      };
    }
    
    // Check minimum length
    if (name.length < config.minLength) {
      return {
        valid: false,
        message: `Name must be at least ${config.minLength} characters long`
      };
    }
    
    // Check maximum length
    if (name.length > config.maxLength) {
      return {
        valid: false,
        message: `Name must be at most ${config.maxLength} characters long`
      };
    }
    
    // Check for spaces if not allowed
    if (!config.allowSpaces && /\s/.test(name)) {
      return {
        valid: false,
        message: 'Name cannot contain spaces'
      };
    }
    
    // Name is valid
    return {
      valid: true,
      message: 'Name is valid'
    };
  }
  
  /**
   * Validate a phone number
   * @param {string} phone - Phone number to validate
   * @returns {Object} - Validation result
   * @returns {boolean} result.valid - Whether the phone number is valid
   * @returns {string} result.message - Error message if invalid
   */
  function validatePhone(phone) {
    // Check if phone is provided
    if (!phone) {
      return {
        valid: false,
        message: 'Phone number is required'
      };
    }
    
    // Remove non-digit characters for validation
    const digits = phone.replace(/\D/g, '');
    
    // Check if phone number has a reasonable number of digits
    // This is a simple check that ensures the phone number has at least 7 digits
    // For production use, consider using a more comprehensive validation library
    if (digits.length < 7) {
      return {
        valid: false,
        message: 'Phone number is too short'
      };
    }
    
    // Phone number is valid
    return {
      valid: true,
      message: 'Phone number is valid'
    };
  }
  
  /**
   * Validate a URL
   * @param {string} url - URL to validate
   * @returns {Object} - Validation result
   * @returns {boolean} result.valid - Whether the URL is valid
   * @returns {string} result.message - Error message if invalid
   */
  function validateUrl(url) {
    // Check if URL is provided
    if (!url) {
      return {
        valid: false,
        message: 'URL is required'
      };
    }
    
    try {
      // Use the URL constructor to validate the URL
      new URL(url);
      
      // URL is valid
      return {
        valid: true,
        message: 'URL is valid'
      };
    } catch (error) {
      // URL is invalid
      return {
        valid: false,
        message: 'URL is invalid'
      };
    }
  }
  
  /**
   * Validate a date
   * @param {string|Date} date - Date to validate
   * @param {Object} options - Validation options
   * @param {Date} options.minDate - Minimum date (default: null)
   * @param {Date} options.maxDate - Maximum date (default: null)
   * @returns {Object} - Validation result
   * @returns {boolean} result.valid - Whether the date is valid
   * @returns {string} result.message - Error message if invalid
   */
  function validateDate(date, options = {}) {
    // Default options
    const config = {
      minDate: options.minDate || null,
      maxDate: options.maxDate || null
    };
    
    // Check if date is provided
    if (!date) {
      return {
        valid: false,
        message: 'Date is required'
      };
    }
    
    // Convert to Date object if string
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return {
        valid: false,
        message: 'Date is invalid'
      };
    }
    
    // Check minimum date
    if (config.minDate && dateObj < config.minDate) {
      return {
        valid: false,
        message: `Date must be on or after ${config.minDate.toISOString().split('T')[0]}`
      };
    }
    
    // Check maximum date
    if (config.maxDate && dateObj > config.maxDate) {
      return {
        valid: false,
        message: `Date must be on or before ${config.maxDate.toISOString().split('T')[0]}`
      };
    }
    
    // Date is valid
    return {
      valid: true,
      message: 'Date is valid'
    };
  }
  
  // Return validation utilities
  return {
    isValidEmail,
    validateUsername,
    validateName,
    validatePhone,
    validateUrl,
    validateDate
  };
}

export default createValidationUtils;