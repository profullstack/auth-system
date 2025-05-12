/**
 * Auth Status Utility
 * 
 * This utility provides functions to check authentication status
 * and log authentication information.
 */

import { AuthClient } from '../auth-client.js';

/**
 * Check authentication status
 * @returns {Promise<Object>} - Authentication status
 */
export async function checkAuthStatus() {
  try {
    // Create AuthClient instance
    const authClient = await createAuthClient();
    
    // Check authentication status
    const status = await authClient.checkAuthStatus();
    
    return {
      authenticated: status.authenticated,
      user: status.user,
      message: status.message,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking authentication status:', error);
    
    return {
      authenticated: false,
      user: null,
      message: 'Error checking authentication status: ' + (error.message || 'Unknown error'),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Log authentication status
 * @returns {Promise<Object>} - Authentication status
 */
export async function logAuthStatus() {
  try {
    // Check authentication status
    const status = await checkAuthStatus();
    
    // Log status
    console.log('Auth Status:', status);
    
    // Get token information
    const tokenInfo = await getTokenInfo();
    
    // Combine status and token info
    const result = {
      ...status,
      token: tokenInfo
    };
    
    // Log combined result
    console.log('Auth Status with Token Info:', result);
    
    return result;
  } catch (error) {
    console.error('Error logging authentication status:', error);
    
    return {
      authenticated: false,
      user: null,
      message: 'Error logging authentication status: ' + (error.message || 'Unknown error'),
      timestamp: new Date().toISOString(),
      token: null
    };
  }
}

/**
 * Get token information
 * @returns {Promise<Object|null>} - Token information
 */
async function getTokenInfo() {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('jwt_token');
    
    if (!token) {
      return null;
    }
    
    // Parse token parts
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return {
        valid: false,
        message: 'Invalid token format'
      };
    }
    
    // Decode payload
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const expired = payload.exp && payload.exp < now;
    
    return {
      valid: !expired,
      expired,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
      userId: payload.userId || payload.sub,
      tokenType: payload.type || 'unknown'
    };
  } catch (error) {
    console.error('Error getting token information:', error);
    
    return {
      valid: false,
      message: 'Error parsing token: ' + (error.message || 'Unknown error')
    };
  }
}

/**
 * Create AuthClient instance
 * @returns {Promise<AuthClient>} - AuthClient instance
 */
async function createAuthClient() {
  try {
    // Fetch Supabase configuration from the server
    const configResponse = await fetch('/api/1/config/supabase');
    if (!configResponse.ok) {
      throw new Error('Failed to fetch Supabase configuration');
    }
    
    const { supabaseUrl, supabaseAnonKey, jwtSecret } = await configResponse.json();
    
    // Create AuthClient
    return new AuthClient({
      supabaseUrl,
      supabaseKey: supabaseAnonKey,
      jwtSecret,
      onAuthChanged: (authenticated, user) => {
        console.log('Auth state changed:', authenticated, user);
      }
    });
  } catch (error) {
    console.error('Error creating AuthClient:', error);
    throw error;
  }
}