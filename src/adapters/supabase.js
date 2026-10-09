/**
 * Supabase Adapter for Auth System
 * 
 * This adapter uses Supabase for user storage and authentication.
 * It requires the @supabase/supabase-js package.
 */


/**
 * Supabase Adapter
 */
export class SupabaseAdapter {
  /**
   * Create a new Supabase Adapter
   * @param {Object} options - Configuration options
   * @param {string} options.supabaseUrl - Supabase project URL
   * @param {string} options.supabaseKey - Supabase API key
   * @param {string} options.tableName - Name of the users table (default: 'users')
   * @param {string} options.tokensTableName - Name of the invalidated tokens table (default: 'invalidated_tokens')
   */
  constructor(options) {
    if (!options.supabaseUrl) {
      throw new Error('Supabase URL is required');
    }
    
    if (!options.supabaseKey) {
      throw new Error('Supabase API key is required');
    }
    
    // The driver is an optional peer, so it is loaded on first use: a static
    // import made `import ... from '@profullstack/auth-system'` throw for every
    // app without supabase-js, whichever adapter it actually used.
    this.options = options;
    this.supabase = options.client || null;
    
    // Set table names
    this.tableName = options.tableName || 'users';
    this.tokensTableName = options.tokensTableName || 'invalidated_tokens';
  }

  /** The Supabase client, created on first use. */
  async client() {
    if (this.supabase) return this.supabase;
    let mod;
    try {
      mod = await import('@supabase/supabase-js');
    } catch {
      throw new Error('SupabaseAdapter needs the `@supabase/supabase-js` package, or a `client` passed to its constructor.');
    }
    this.supabase = mod.createClient(this.options.supabaseUrl, this.options.supabaseKey);
    return this.supabase;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user
   */
  async createUser(userData) {
    try {
      // Format user data for Supabase
      const user = {
        id: userData.id,
        email: userData.email,
        password: userData.password, // Note: This is already hashed by the auth system
        profile: userData.profile || {},
        email_verified: userData.emailVerified || false,
        created_at: userData.createdAt || new Date().toISOString(),
        updated_at: userData.updatedAt || new Date().toISOString(),
        last_login_at: userData.lastLoginAt || null
      };
      
      // Insert user into Supabase
      const { data, error } = await (await this.client())
        .from(this.tableName)
        .insert(user)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }
      
      // Convert Supabase snake_case to camelCase for consistency
      return this._formatUserFromSupabase(data);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserById(userId) {
    try {
      const { data, error } = await (await this.client())
        .from(this.tableName)
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(`Failed to get user: ${error.message}`);
      }
      
      if (!data) {
        return null;
      }
      
      // Convert Supabase snake_case to camelCase for consistency
      return this._formatUserFromSupabase(data);
    } catch (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUserByEmail(email) {
    try {
      const { data, error } = await (await this.client())
        .from(this.tableName)
        .select('*')
        .eq('email', email.toLowerCase())
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(`Failed to get user: ${error.message}`);
      }
      
      if (!data) {
        return null;
      }
      
      // Convert Supabase snake_case to camelCase for consistency
      return this._formatUserFromSupabase(data);
    } catch (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
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
      // Format updates for Supabase (convert camelCase to snake_case)
      const formattedUpdates = {};
      
      if (updates.email) formattedUpdates.email = updates.email;
      if (updates.password) formattedUpdates.password = updates.password;
      if (updates.emailVerified !== undefined) formattedUpdates.email_verified = updates.emailVerified;
      if (updates.lastLoginAt) formattedUpdates.last_login_at = updates.lastLoginAt;
      if (updates.updatedAt) formattedUpdates.updated_at = updates.updatedAt;
      
      // Handle profile updates
      if (updates.profile) {
        // Get current user to merge profiles
        const currentUser = await this.getUserById(userId);
        if (!currentUser) {
          throw new Error('User not found');
        }
        
        formattedUpdates.profile = {
          ...currentUser.profile,
          ...updates.profile
        };
      }
      
      // Update user in Supabase
      const { data, error } = await (await this.client())
        .from(this.tableName)
        .update(formattedUpdates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to update user: ${error.message}`);
      }
      
      // Convert Supabase snake_case to camelCase for consistency
      return this._formatUserFromSupabase(data);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Whether the user was deleted
   */
  async deleteUser(userId) {
    try {
      const { error } = await (await this.client())
        .from(this.tableName)
        .delete()
        .eq('id', userId);
      
      if (error) {
        throw new Error(`Failed to delete user: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Invalidate a token
   * @param {string} token - Token to invalidate
   * @returns {Promise<void>}
   */
  async invalidateToken(token) {
    try {
      const { error } = await (await this.client())
        .from(this.tokensTableName)
        .insert({
          token,
          invalidated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`Failed to invalidate token: ${error.message}`);
      }
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
      const { data, error } = await (await this.client())
        .from(this.tokensTableName)
        .select('*')
        .eq('token', token)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return false;
        }
        console.error(`Failed to check token: ${error.message}`);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error(`Failed to check token: ${error.message}`);
      return false;
    }
  }

  /**
   * Format user data from Supabase (snake_case) to camelCase
   * @private
   * @param {Object} user - User data from Supabase
   * @returns {Object} - Formatted user data
   */
  _formatUserFromSupabase(user) {
    return {
      id: user.id,
      email: user.email,
      password: user.password,
      profile: user.profile || {},
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at
    };
  }
}

export default SupabaseAdapter;