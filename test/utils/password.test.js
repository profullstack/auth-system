/**
 * Tests for password utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPasswordUtils } from '../../src/utils/password.js';

describe('Password Utils', () => {
  let passwordUtils;
  
  beforeEach(() => {
    // Create password utils with default options
    passwordUtils = createPasswordUtils();
  });
  
  describe('validatePassword', () => {
    it('should reject empty passwords', () => {
      const result = passwordUtils.validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('required');
    });
    
    it('should reject passwords that are too short', () => {
      const result = passwordUtils.validatePassword('Abc123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });
    
    it('should reject passwords without uppercase letters when required', () => {
      const result = passwordUtils.validatePassword('abcdefgh123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('uppercase letter');
    });
    
    it('should reject passwords without lowercase letters when required', () => {
      const result = passwordUtils.validatePassword('ABCDEFGH123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('lowercase letter');
    });
    
    it('should reject passwords without numbers when required', () => {
      const result = passwordUtils.validatePassword('AbcdEfgh');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('number');
    });
    
    it('should reject passwords without special characters when required', () => {
      const utils = createPasswordUtils({ requireSpecialChars: true });
      const result = utils.validatePassword('Abcdefgh123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('special character');
    });
    
    it('should accept valid passwords', () => {
      const result = passwordUtils.validatePassword('Abcdefgh123');
      expect(result.valid).toBe(true);
    });
    
    it('should accept valid passwords with special characters', () => {
      const result = passwordUtils.validatePassword('Abcdefgh123!@#');
      expect(result.valid).toBe(true);
    });
    
    it('should respect custom password requirements', () => {
      const customUtils = createPasswordUtils({
        minLength: 6,
        requireUppercase: false,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false
      });
      
      // Should pass with lowercase and numbers only
      const result1 = customUtils.validatePassword('abcdef123');
      expect(result1.valid).toBe(true);
      
      // Should fail without lowercase
      const result2 = customUtils.validatePassword('ABCDEF123');
      expect(result2.valid).toBe(false);
    });
  });
  
  describe('hashPassword and verifyPassword', () => {
    it('should hash passwords securely', async () => {
      const password = 'SecurePassword123!';
      const hash = await passwordUtils.hashPassword(password);
      
      // Hash should be a string and not equal to the original password
      expect(hash).toBeTypeOf('string');
      expect(hash).not.toBe(password);
      
      // Hash should be long enough to be secure
      expect(hash.length).toBeGreaterThan(20);
    });
    
    it('should verify correct passwords', async () => {
      const password = 'SecurePassword123!';
      const hash = await passwordUtils.hashPassword(password);
      
      const isValid = await passwordUtils.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
    
    it('should reject incorrect passwords', async () => {
      const password = 'SecurePassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await passwordUtils.hashPassword(password);
      
      const isValid = await passwordUtils.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });
  
  describe('generateRandomPassword', () => {
    it('should generate passwords of the specified length', () => {
      const password = passwordUtils.generateRandomPassword(12);
      expect(password.length).toBe(12);
    });
    
    it('should generate valid passwords', () => {
      const password = passwordUtils.generateRandomPassword();
      const result = passwordUtils.validatePassword(password);
      expect(result.valid).toBe(true);
    });
    
    it('should respect custom requirements', () => {
      const customUtils = createPasswordUtils({
        minLength: 10,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      });
      
      const password = customUtils.generateRandomPassword(15);
      expect(password.length).toBe(15);
      
      const result = customUtils.validatePassword(password);
      expect(result.valid).toBe(true);
      
      // Check that it contains all required character types
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/);
    });
  });
});