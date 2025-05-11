/**
 * In-Memory Storage Adapter for Auth System
 * 
 * This adapter stores user data in memory, suitable for development or testing.
 * For production use, consider using the Database or Supabase adapters.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * In-Memory Storage Adapter
 */
export class MemoryAdapter {
  /**
   * Create a new Memory Adapter
   */
  constructor() {
    // Initialize storage
    this.users = new Map();
    this.usersByEmail = new Map();
    this.invalidatedTokens = new Set();
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user
   */
  async createUser(userData) {
    // Generate ID if not provided
    const id = userData.id || uuidv4();
    
    // Create user object
    const user = {
      id,
      email: userData.email,
      password: userData.password,
      profile: userData.profile || {},
      emailVerified: userData.emailVerified || false,
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: userData.updatedAt || new Date().toISOString(),
      lastLoginAt: null
    };
    
    // Store user
    this.users.set(id, user);
    this.usersByEmail.set(userData.email.toLowerCase(), id);
    
    return { ...user };
  }

  /**
   * Get a user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserById(userId) {
    const user = this.users.get(userId);
    return user ? { ...user } : null;
  }

  /**
   * Get a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserByEmail(email) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      return null;
    }
    
    return this.getUserById(userId);
  }

  /**
   * Update a user
   * @param {string} userId - User ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - Updated user
   */
  async updateUser(userId, updates) {
    const user = this.users.get(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Apply updates
    const updatedUser = {
      ...user,
      ...updates,
      // Merge profile if provided
      profile: updates.profile ? { ...user.profile, ...updates.profile } : user.profile,
      // Always update updatedAt
      updatedAt: new Date().toISOString()
    };
    
    // Update email index if email changed
    if (updates.email && updates.email !== user.email) {
      this.usersByEmail.delete(user.email.toLowerCase());
      this.usersByEmail.set(updates.email.toLowerCase(), userId);
    }
    
    // Store updated user
    this.users.set(userId, updatedUser);
    
    return { ...updatedUser };
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Whether the user was deleted
   */
  async deleteUser(userId) {
    const user = this.users.get(userId);
    
    if (!user) {
      return false;
    }
    
    // Remove from indexes
    this.usersByEmail.delete(user.email.toLowerCase());
    this.users.delete(userId);
    
    return true;
  }

  /**
   * Invalidate a refresh token
   * @param {string} token - Refresh token
   * @returns {Promise<void>}
   */
  async invalidateToken(token) {
    this.invalidatedTokens.add(token);
  }

  /**
   * Check if a token is invalidated
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} - Whether the token is invalidated
   */
  async isTokenInvalidated(token) {
    return this.invalidatedTokens.has(token);
  }

  /**
   * Clear all data (for testing)
   * @returns {Promise<void>}
   */
  async clear() {
    this.users.clear();
    this.usersByEmail.clear();
    this.invalidatedTokens.clear();
  }
}

export default MemoryAdapter;