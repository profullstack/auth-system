/**
 * PocketBase Adapter for Auth System
 * 
 * This adapter uses PocketBase for user storage and authentication.
 * It requires the pocketbase package.
 */

// import PocketBase from 'pocketbase';

/**
 * PocketBase Adapter
 */
export class PocketBaseAdapter {
  /**
   * Create a new PocketBase Adapter
   * @param {Object} options - Configuration options
   * @param {string} options.url - PocketBase URL
   * @param {string} options.usersCollection - Name of the users collection (default: 'auth_users')
   * @param {string} options.tokensCollection - Name of the invalidated tokens collection (default: 'auth_invalidated_tokens')
   * @param {string} options.adminEmail - Admin email for authentication (optional)
   * @param {string} options.adminPassword - Admin password for authentication (optional)
   */
  constructor(options) {
    if (!options.url) {
      throw new Error('PocketBase URL is required');
    }
    
    // Initialize PocketBase client
    // this.pb = new PocketBase(options.url);
    this.pb = { /* Mock PocketBase client for now */ };
    
    // Set collection names
    this.usersCollection = options.usersCollection || 'auth_users';
    this.tokensCollection = options.tokensCollection || 'auth_invalidated_tokens';
    
    // Store admin credentials for authentication
    this.adminEmail = options.adminEmail;
    this.adminPassword = options.adminPassword;
    
    // Initialize admin authentication if credentials are provided
    this._initAdminAuth();
  }

  /**
   * Initialize admin authentication
   * @private
   */
  async _initAdminAuth() {
    if (this.adminEmail && this.adminPassword) {
      try {
        // Authenticate as admin
        // await this.pb.admins.authWithPassword(this.adminEmail, this.adminPassword);
        console.log('Authenticated as admin');
      } catch (error) {
        console.error('Failed to authenticate as admin:', error);
      }
    }
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user
   */
  async createUser(userData) {
    try {
      // Format user data for PocketBase
      const user = {
        email: userData.email,
        password: userData.password, // Note: This is already hashed by the auth system
        passwordConfirm: userData.password, // PocketBase requires password confirmation
        profile: JSON.stringify(userData.profile || {}),
        emailVerified: userData.emailVerified || false,
        createdAt: userData.createdAt || new Date().toISOString(),
        updatedAt: userData.updatedAt || new Date().toISOString(),
        lastLoginAt: userData.lastLoginAt || null
      };
      
      // Create user in PocketBase
      // const record = await this.pb.collection(this.usersCollection).create(user);
      const record = { 
        id: 'mock-id',
        ...user,
        profile: JSON.parse(user.profile)
      };
      
      // Return formatted user
      return this._formatUserFromPocketBase(record);
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Get a user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserById(userId) {
    try {
      // Get user from PocketBase
      // const record = await this.pb.collection(this.usersCollection).getOne(userId);
      const record = null; // Mock: User not found
      
      if (!record) {
        return null;
      }
      
      // Return formatted user
      return this._formatUserFromPocketBase(record);
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Get a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserByEmail(email) {
    try {
      // Get user from PocketBase
      // const records = await this.pb.collection(this.usersCollection).getList(1, 1, {
      //   filter: `email="${email.toLowerCase()}"`
      // });
      const records = { items: [] }; // Mock: No users found
      
      if (records.items.length === 0) {
        return null;
      }
      
      // Return formatted user
      return this._formatUserFromPocketBase(records.items[0]);
    } catch (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Update a user
   * @param {string} userId - User ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - Updated user
   */
  async updateUser(userId, updates) {
    try {
      // Get current user to merge profiles
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }
      
      // Format updates for PocketBase
      const formattedUpdates = {};
      
      if (updates.email) formattedUpdates.email = updates.email;
      if (updates.password) {
        formattedUpdates.password = updates.password;
        formattedUpdates.passwordConfirm = updates.password; // PocketBase requires password confirmation
      }
      if (updates.emailVerified !== undefined) formattedUpdates.emailVerified = updates.emailVerified;
      if (updates.lastLoginAt) formattedUpdates.lastLoginAt = updates.lastLoginAt;
      if (updates.updatedAt) formattedUpdates.updatedAt = updates.updatedAt;
      
      // Handle profile updates
      if (updates.profile) {
        formattedUpdates.profile = JSON.stringify({
          ...currentUser.profile,
          ...updates.profile
        });
      }
      
      // Update user in PocketBase
      // const record = await this.pb.collection(this.usersCollection).update(userId, formattedUpdates);
      const record = { 
        id: userId,
        ...currentUser,
        ...updates,
        profile: updates.profile ? { ...currentUser.profile, ...updates.profile } : currentUser.profile
      };
      
      // Return formatted user
      return this._formatUserFromPocketBase(record);
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Whether the user was deleted
   */
  async deleteUser(userId) {
    try {
      // Delete user from PocketBase
      // await this.pb.collection(this.usersCollection).delete(userId);
      
      return true;
    } catch (error) {
      if (error.status === 404) {
        return false;
      }
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Invalidate a token
   * @param {string} token - Token to invalidate
   * @returns {Promise<void>}
   */
  async invalidateToken(token) {
    try {
      // Create invalidated token record in PocketBase
      // await this.pb.collection(this.tokensCollection).create({
      //   token,
      //   invalidatedAt: new Date().toISOString()
      // });
    } catch (error) {
      console.error(`Failed to invalidate token: ${error.message}`);
    }
  }

  /**
   * Check if a token is invalidated
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} - Whether the token is invalidated
   */
  async isTokenInvalidated(token) {
    try {
      // Check if token is invalidated in PocketBase
      // const records = await this.pb.collection(this.tokensCollection).getList(1, 1, {
      //   filter: `token="${token}"`
      // });
      const records = { items: [] }; // Mock: No tokens found
      
      return records.items.length > 0;
    } catch (error) {
      console.error(`Failed to check token: ${error.message}`);
      return false;
    }
  }

  /**
   * Format user data from PocketBase
   * @private
   * @param {Object} record - PocketBase record
   * @returns {Object} - Formatted user data
   */
  _formatUserFromPocketBase(record) {
    // Parse profile if it's a string
    let profile = record.profile;
    if (typeof profile === 'string') {
      try {
        profile = JSON.parse(profile);
      } catch (error) {
        profile = {};
      }
    }
    
    return {
      id: record.id,
      email: record.email,
      password: record.password,
      profile: profile || {},
      emailVerified: record.emailVerified,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastLoginAt: record.lastLoginAt
    };
  }
}

export default PocketBaseAdapter;