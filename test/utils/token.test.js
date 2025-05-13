/**
 * Tests for token utilities
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createTokenUtils } from '../../src/utils/token.js';
import jwt from 'jsonwebtoken';

describe('Token Utils', () => {
  let tokenUtils;
  const testSecret = 'test-secret-key-for-jwt-tokens';
  const testUserId = 'user-123';
  
  beforeEach(() => {
    // Create token utils with test options
    tokenUtils = createTokenUtils({
      accessTokenExpiry: 300, // 5 minutes
      refreshTokenExpiry: 3600, // 1 hour
      secret: testSecret
    });
  });
  
  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', async () => {
      const token = await tokenUtils.generateAccessToken(testUserId);
      
      // Token should be a string
      expect(token).toBeTypeOf('string');
      
      // Token should be decodable
      const decoded = jwt.verify(token, testSecret);
      expect(decoded).toBeTypeOf('object');
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('access');
      expect(decoded.jti).toBeTypeOf('string'); // JWT ID
      expect(decoded.exp).toBeTypeOf('number'); // Expiration time
      expect(decoded.iat).toBeTypeOf('number'); // Issued at time
    });
    
    it('should set the correct expiration time', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await tokenUtils.generateAccessToken(testUserId);
      const decoded = jwt.verify(token, testSecret);
      
      // Expiration should be approximately 5 minutes (300 seconds) from now
      expect(decoded.exp).toBeGreaterThanOrEqual(now + 299);
      expect(decoded.exp).toBeLessThanOrEqual(now + 301);
    });
  });
  
  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', async () => {
      const token = await tokenUtils.generateRefreshToken(testUserId);
      
      // Token should be a string
      expect(token).toBeTypeOf('string');
      
      // Token should be decodable
      const decoded = jwt.verify(token, testSecret);
      expect(decoded).toBeTypeOf('object');
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('refresh');
      expect(decoded.jti).toBeTypeOf('string'); // JWT ID
      expect(decoded.exp).toBeTypeOf('number'); // Expiration time
      expect(decoded.iat).toBeTypeOf('number'); // Issued at time
    });
    
    it('should set the correct expiration time', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.verify(token, testSecret);
      
      // Expiration should be approximately 1 hour (3600 seconds) from now
      expect(decoded.exp).toBeGreaterThanOrEqual(now + 3599);
      expect(decoded.exp).toBeLessThanOrEqual(now + 3601);
    });
  });
  
  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', async () => {
      const tokens = await tokenUtils.generateTokens(testUserId);
      
      // Should return an object with both tokens
      expect(tokens).toBeTypeOf('object');
      expect(tokens.accessToken).toBeTypeOf('string');
      expect(tokens.refreshToken).toBeTypeOf('string');
      expect(tokens.expiresIn).toBe(300); // 5 minutes in seconds
      
      // Both tokens should be valid
      const decodedAccess = jwt.verify(tokens.accessToken, testSecret);
      const decodedRefresh = jwt.verify(tokens.refreshToken, testSecret);
      
      expect(decodedAccess.userId).toBe(testUserId);
      expect(decodedAccess.type).toBe('access');
      
      expect(decodedRefresh.userId).toBe(testUserId);
      expect(decodedRefresh.type).toBe('refresh');
    });
  });
  
  describe('verifyAccessToken', () => {
    it('should verify valid access tokens', async () => {
      const token = await tokenUtils.generateAccessToken(testUserId);
      const payload = await tokenUtils.verifyAccessToken(token);
      
      expect(payload).toBeTypeOf('object');
      expect(payload.userId).toBe(testUserId);
      expect(payload.type).toBe('access');
    });
    
    it('should reject expired access tokens', async () => {
      // Mock Date.now to simulate token expiration
      const realDateNow = Date.now;
      const mockDate = vi.fn(() => realDateNow() + 301 * 1000); // 301 seconds later (token expires at 300)
      
      try {
        // Generate token at current time
        const token = await tokenUtils.generateAccessToken(testUserId);
        
        // Verify token at future time
        global.Date.now = mockDate;
        const payload = await tokenUtils.verifyAccessToken(token);
        
        expect(payload).toBeNull();
      } finally {
        // Restore original Date.now
        global.Date.now = realDateNow;
      }
    });
    
    it('should reject tokens of the wrong type', async () => {
      // Generate a refresh token but try to verify as access token
      const token = await tokenUtils.generateRefreshToken(testUserId);
      const payload = await tokenUtils.verifyAccessToken(token);
      
      expect(payload).toBeNull();
    });
    
    it('should reject tampered tokens', async () => {
      const token = await tokenUtils.generateAccessToken(testUserId);
      const tamperedToken = token.substring(0, token.length - 5) + 'xxxxx';
      
      const payload = await tokenUtils.verifyAccessToken(tamperedToken);
      expect(payload).toBeNull();
    });
    
    it('should reject invalidated tokens', async () => {
      const token = await tokenUtils.generateAccessToken(testUserId);
      
      // First verification should succeed
      const payload1 = await tokenUtils.verifyAccessToken(token);
      expect(payload1).not.toBeNull();
      
      // Invalidate the token
      await tokenUtils.invalidateToken(token);
      
      // Second verification should fail
      const payload2 = await tokenUtils.verifyAccessToken(token);
      expect(payload2).toBeNull();
    });
  });
  
  describe('verifyRefreshToken', () => {
    it('should verify valid refresh tokens', async () => {
      const token = await tokenUtils.generateRefreshToken(testUserId);
      const payload = await tokenUtils.verifyRefreshToken(token);
      
      expect(payload).toBeTypeOf('object');
      expect(payload.userId).toBe(testUserId);
      expect(payload.type).toBe('refresh');
    });
    
    it('should reject expired refresh tokens', async () => {
      // Mock Date.now to simulate token expiration
      const realDateNow = Date.now;
      const mockDate = vi.fn(() => realDateNow() + 3601 * 1000); // 3601 seconds later (token expires at 3600)
      
      try {
        // Generate token at current time
        const token = await tokenUtils.generateRefreshToken(testUserId);
        
        // Verify token at future time
        global.Date.now = mockDate;
        const payload = await tokenUtils.verifyRefreshToken(token);
        
        expect(payload).toBeNull();
      } finally {
        // Restore original Date.now
        global.Date.now = realDateNow;
      }
    });
    
    it('should reject tokens of the wrong type', async () => {
      // Generate an access token but try to verify as refresh token
      const token = await tokenUtils.generateAccessToken(testUserId);
      const payload = await tokenUtils.verifyRefreshToken(token);
      
      expect(payload).toBeNull();
    });
  });
  
  describe('Password Reset Tokens', () => {
    it('should generate and verify password reset tokens', async () => {
      const token = await tokenUtils.generatePasswordResetToken(testUserId);
      
      // Token should be a string
      expect(token).toBeTypeOf('string');
      
      // Token should be verifiable
      const payload = await tokenUtils.verifyPasswordResetToken(token);
      expect(payload).toBeTypeOf('object');
      expect(payload.userId).toBe(testUserId);
      expect(payload.type).toBe('password_reset');
    });
    
    it('should set the correct expiration time (1 hour)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await tokenUtils.generatePasswordResetToken(testUserId);
      const decoded = jwt.verify(token, testSecret);
      
      // Expiration should be approximately 1 hour (3600 seconds) from now
      expect(decoded.exp).toBeGreaterThanOrEqual(now + 3599);
      expect(decoded.exp).toBeLessThanOrEqual(now + 3601);
    });
  });
  
  describe('Email Verification Tokens', () => {
    it('should generate and verify email verification tokens', async () => {
      const token = await tokenUtils.generateEmailVerificationToken(testUserId);
      
      // Token should be a string
      expect(token).toBeTypeOf('string');
      
      // Token should be verifiable
      const payload = await tokenUtils.verifyEmailVerificationToken(token);
      expect(payload).toBeTypeOf('object');
      expect(payload.userId).toBe(testUserId);
      expect(payload.type).toBe('email_verification');
    });
    
    it('should set the correct expiration time (24 hours)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = await tokenUtils.generateEmailVerificationToken(testUserId);
      const decoded = jwt.verify(token, testSecret);
      
      // Expiration should be approximately 24 hours (86400 seconds) from now
      expect(decoded.exp).toBeGreaterThanOrEqual(now + 86399);
      expect(decoded.exp).toBeLessThanOrEqual(now + 86401);
    });
  });
  
  describe('Token Invalidation', () => {
    it('should invalidate tokens', async () => {
      const token = await tokenUtils.generateAccessToken(testUserId);
      
      // Token should be valid initially
      expect(await tokenUtils.isTokenInvalidated(token)).toBe(false);
      
      // Invalidate the token
      await tokenUtils.invalidateToken(token);
      
      // Token should now be invalidated
      expect(await tokenUtils.isTokenInvalidated(token)).toBe(true);
    });
    
    it('should invalidate refresh tokens', async () => {
      const token = await tokenUtils.generateRefreshToken(testUserId);
      
      // Token should be valid initially
      expect(await tokenUtils.isTokenInvalidated(token)).toBe(false);
      
      // Invalidate the token
      await tokenUtils.invalidateRefreshToken(token);
      
      // Token should now be invalidated
      expect(await tokenUtils.isTokenInvalidated(token)).toBe(true);
    });
  });
  
  describe('decodeToken', () => {
    it('should decode tokens without verification', async () => {
      // Generate a real token to decode
      const token = await tokenUtils.generateAccessToken(testUserId);
      
      const decoded = tokenUtils.decodeToken(token);
      expect(decoded).toBeTypeOf('object');
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('access');
    });
    
    it('should return null for invalid tokens', () => {
      const invalidToken = 'not-a-valid-token';
      const decoded = tokenUtils.decodeToken(invalidToken);
      expect(decoded).toBeNull();
    });
  });
});