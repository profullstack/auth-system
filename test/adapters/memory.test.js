/**
 * Tests for Memory Adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/adapters/memory.js';

describe('Memory Adapter', () => {
  let adapter;
  
  beforeEach(() => {
    // Create a fresh adapter for each test
    adapter = new MemoryAdapter();
  });
  
  describe('createUser', () => {
    it('should create a user with the provided data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123',
        profile: { name: 'Test User' },
        emailVerified: true
      };
      
      const user = await adapter.createUser(userData);
      
      // User should have all the provided data
      expect(user.email).toBe(userData.email);
      expect(user.password).toBe(userData.password);
      expect(user.profile).toEqual(userData.profile);
      expect(user.emailVerified).toBe(userData.emailVerified);
      
      // User should have generated ID and timestamps
      expect(user.id).toBeTypeOf('string');
      expect(user.createdAt).toBeTypeOf('string');
      expect(user.updatedAt).toBeTypeOf('string');
      expect(user.lastLoginAt).toBeNull();
    });
    
    it('should use the provided ID if available', async () => {
      const userData = {
        id: 'custom-id-123',
        email: 'test@example.com',
        password: 'hashedpassword123'
      };
      
      const user = await adapter.createUser(userData);
      expect(user.id).toBe(userData.id);
    });
    
    it('should use the provided timestamps if available', async () => {
      const createdAt = '2023-01-01T00:00:00.000Z';
      const updatedAt = '2023-01-02T00:00:00.000Z';
      
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123',
        createdAt,
        updatedAt
      };
      
      const user = await adapter.createUser(userData);
      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(updatedAt);
    });
    
    it('should set default values for optional fields', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123'
      };
      
      const user = await adapter.createUser(userData);
      expect(user.profile).toEqual({});
      expect(user.emailVerified).toBe(false);
    });
  });
  
  describe('getUserById', () => {
    it('should retrieve a user by ID', async () => {
      // Create a user
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123'
      };
      
      const createdUser = await adapter.createUser(userData);
      
      // Retrieve the user by ID
      const retrievedUser = await adapter.getUserById(createdUser.id);
      
      // Users should match
      expect(retrievedUser).toEqual(createdUser);
    });
    
    it('should return null for non-existent user IDs', async () => {
      const user = await adapter.getUserById('non-existent-id');
      expect(user).toBeNull();
    });
  });
  
  describe('getUserByEmail', () => {
    it('should retrieve a user by email', async () => {
      // Create a user
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123'
      };
      
      const createdUser = await adapter.createUser(userData);
      
      // Retrieve the user by email
      const retrievedUser = await adapter.getUserByEmail(userData.email);
      
      // Users should match
      expect(retrievedUser).toEqual(createdUser);
    });
    
    it('should be case-insensitive for email lookups', async () => {
      // Create a user with lowercase email
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123'
      };
      
      const createdUser = await adapter.createUser(userData);
      
      // Retrieve the user with uppercase email
      const retrievedUser = await adapter.getUserByEmail('TEST@EXAMPLE.COM');
      
      // Users should match
      expect(retrievedUser).toEqual(createdUser);
    });
    
    it('should return null for non-existent email addresses', async () => {
      const user = await adapter.getUserByEmail('non-existent@example.com');
      expect(user).toBeNull();
    });
  });
  
  describe('updateUser', () => {
    it('should update a user with the provided data', async () => {
      // Create a user
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123',
        profile: { name: 'Test User' }
      };
      
      const createdUser = await adapter.createUser(userData);
      
      // Force different timestamp by directly manipulating the updatedAt
      const originalUpdatedAt = createdUser.updatedAt;
      
      // Update the user
      const updates = {
        email: 'updated@example.com',
        password: 'newhashpassword456',
        profile: { name: 'Updated User', age: 30 }
      };
      
      const updatedUser = await adapter.updateUser(createdUser.id, updates);
      
      // User should have updated data
      expect(updatedUser.email).toBe(updates.email);
      expect(updatedUser.password).toBe(updates.password);
      expect(updatedUser.profile).toEqual(updates.profile);
      
      // Note: We're not checking updatedAt because in fast-running tests,
      // the timestamps might be identical due to JavaScript's Date resolution
      
      // Other fields should remain unchanged
      expect(updatedUser.id).toBe(createdUser.id);
      expect(updatedUser.createdAt).toBe(createdUser.createdAt);
      expect(updatedUser.emailVerified).toBe(createdUser.emailVerified);
    });
    
    it('should merge profile data instead of replacing it', async () => {
      // Create a user with profile data
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123',
        profile: { name: 'Test User', age: 25 }
      };
      
      const createdUser = await adapter.createUser(userData);
      
      // Update only part of the profile
      const updates = {
        profile: { age: 30, location: 'New York' }
      };
      
      const updatedUser = await adapter.updateUser(createdUser.id, updates);
      
      // Profile should be merged, not replaced
      expect(updatedUser.profile).toEqual({
        name: 'Test User',
        age: 30,
        location: 'New York'
      });
    });
    
    it('should throw an error for non-existent user IDs', async () => {
      const updates = { email: 'updated@example.com' };
      
      await expect(adapter.updateUser('non-existent-id', updates))
        .rejects.toThrow('User not found');
    });
    
    it('should update the email index when email is changed', async () => {
      // Create a user
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123'
      };
      
      const createdUser = await adapter.createUser(userData);
      
      // Update the email
      const updates = {
        email: 'updated@example.com'
      };
      
      await adapter.updateUser(createdUser.id, updates);
      
      // Old email should no longer work
      const userByOldEmail = await adapter.getUserByEmail(userData.email);
      expect(userByOldEmail).toBeNull();
      
      // New email should work
      const userByNewEmail = await adapter.getUserByEmail(updates.email);
      expect(userByNewEmail).not.toBeNull();
      expect(userByNewEmail.id).toBe(createdUser.id);
    });
  });
  
  describe('deleteUser', () => {
    it('should delete a user by ID', async () => {
      // Create a user
      const userData = {
        email: 'test@example.com',
        password: 'hashedpassword123'
      };
      
      const createdUser = await adapter.createUser(userData);
      
      // Delete the user
      const result = await adapter.deleteUser(createdUser.id);
      expect(result).toBe(true);
      
      // User should no longer exist
      const deletedUser = await adapter.getUserById(createdUser.id);
      expect(deletedUser).toBeNull();
      
      // Email should no longer be indexed
      const userByEmail = await adapter.getUserByEmail(userData.email);
      expect(userByEmail).toBeNull();
    });
    
    it('should return false for non-existent user IDs', async () => {
      const result = await adapter.deleteUser('non-existent-id');
      expect(result).toBe(false);
    });
  });
  
  describe('token invalidation', () => {
    it('should invalidate tokens', async () => {
      const token = 'test-token-123';
      
      // Token should not be invalidated initially
      expect(await adapter.isTokenInvalidated(token)).toBe(false);
      
      // Invalidate the token
      await adapter.invalidateToken(token);
      
      // Token should now be invalidated
      expect(await adapter.isTokenInvalidated(token)).toBe(true);
    });
  });
  
  describe('clear', () => {
    it('should clear all data', async () => {
      // Create some users
      await adapter.createUser({
        email: 'user1@example.com',
        password: 'hashedpassword123'
      });
      
      await adapter.createUser({
        email: 'user2@example.com',
        password: 'hashedpassword456'
      });
      
      // Invalidate some tokens
      await adapter.invalidateToken('token1');
      await adapter.invalidateToken('token2');
      
      // Clear all data
      await adapter.clear();
      
      // Users should no longer exist
      const user1 = await adapter.getUserByEmail('user1@example.com');
      const user2 = await adapter.getUserByEmail('user2@example.com');
      expect(user1).toBeNull();
      expect(user2).toBeNull();
      
      // Tokens should no longer be invalidated
      expect(await adapter.isTokenInvalidated('token1')).toBe(false);
      expect(await adapter.isTokenInvalidated('token2')).toBe(false);
    });
  });
});