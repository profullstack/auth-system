/**
 * Browser Integration Example
 * 
 * This is the main entry point for the browser integration example.
 * It exports all the page initializers and utilities.
 */

// Import page initializers
import { initLoginPage } from './login-page.js';
import { initRegisterPage } from './register-page.js';
import { initApiKeysPage } from './api-keys-page.js';
import { initSettingsPage } from './settings-page.js';
import { initResetPasswordPage } from './reset-password-page.js';

// Import utilities
import { checkAuthStatus, logAuthStatus } from './utils/auth-status.js';

// Import AuthClient
import { AuthClient } from './auth-client.js';

/**
 * Initialize the application
 * @param {Object} options - Configuration options
 */
export async function initApp(options = {}) {
  console.log('Initializing application...');
  
  // Create global AuthClient instance if needed
  if (options.createGlobalAuthClient) {
    try {
      window.authClient = await createGlobalAuthClient();
      console.log('Global AuthClient created successfully');
    } catch (error) {
      console.error('Error creating global AuthClient:', error);
    }
  }
  
  // Set up auth state change listener
  window.addEventListener('auth-changed', handleAuthChanged);
  
  // Update auth state UI
  updateAuthStateUI();
  
  console.log('Application initialized successfully');
}

/**
 * Create global AuthClient instance
 * @returns {Promise<AuthClient>} - AuthClient instance
 */
async function createGlobalAuthClient() {
  try {
    // Fetch Supabase configuration from the server
    const configResponse = await fetch('/api/1/config/supabase');
    if (!configResponse.ok) {
      throw new Error('Failed to fetch Supabase configuration');
    }
    
    const { supabaseUrl, supabaseAnonKey, jwtSecret } = await configResponse.json();
    
    // Create subscription API
    const subscriptionApi = {
      /**
       * Check subscription status
       * @param {string} email - User email
       * @returns {Promise<Object>} - Subscription status
       */
      async checkSubscriptionStatus(email) {
        const response = await fetch(`/api/1/subscriptions/status?email=${encodeURIComponent(email)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to check subscription status');
        }
        
        return await response.json();
      },
      
      /**
       * Create subscription
       * @param {string} email - User email
       * @param {string} plan - Subscription plan
       * @param {string} paymentMethod - Payment method
       * @returns {Promise<Object>} - Subscription result
       */
      async createSubscription(email, plan, paymentMethod) {
        const response = await fetch('/api/1/subscriptions/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
          },
          body: JSON.stringify({
            email,
            plan,
            payment_method: paymentMethod
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to create subscription');
        }
        
        return await response.json();
      }
    };
    
    // Create AuthClient
    return new AuthClient({
      supabaseUrl,
      supabaseKey: supabaseAnonKey,
      jwtSecret,
      subscriptionApi,
      onAuthChanged: (authenticated, user) => {
        console.log('Auth state changed:', authenticated, user);
        updateAuthStateUI();
      }
    });
  } catch (error) {
    console.error('Error creating global AuthClient:', error);
    throw error;
  }
}

/**
 * Handle auth state change event
 * @param {CustomEvent} event - Auth state change event
 */
function handleAuthChanged(event) {
  console.log('Auth state changed event:', event.detail);
  updateAuthStateUI();
}

/**
 * Update auth state UI
 */
function updateAuthStateUI() {
  // Get auth state
  const isAuthenticated = !!localStorage.getItem('jwt_token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  // Update login/logout buttons
  const loginButtons = document.querySelectorAll('.login-button');
  const logoutButtons = document.querySelectorAll('.logout-button');
  const profileButtons = document.querySelectorAll('.profile-button');
  const userDisplays = document.querySelectorAll('.user-display');
  
  // Update login/logout buttons visibility
  loginButtons.forEach(button => {
    button.style.display = isAuthenticated ? 'none' : 'block';
  });
  
  logoutButtons.forEach(button => {
    button.style.display = isAuthenticated ? 'block' : 'none';
    
    // Add logout event listener if not already added
    if (isAuthenticated && !button.dataset.hasLogoutListener) {
      button.addEventListener('click', handleLogout);
      button.dataset.hasLogoutListener = 'true';
    }
  });
  
  // Update profile buttons
  profileButtons.forEach(button => {
    button.style.display = isAuthenticated ? 'block' : 'none';
  });
  
  // Update user displays
  userDisplays.forEach(display => {
    if (isAuthenticated && user) {
      display.style.display = 'block';
      display.textContent = user.username || user.email || 'User';
    } else {
      display.style.display = 'none';
    }
  });
  
  // Update navigation menu items
  const authRequiredItems = document.querySelectorAll('.auth-required');
  authRequiredItems.forEach(item => {
    item.style.display = isAuthenticated ? 'block' : 'none';
  });
  
  const noAuthItems = document.querySelectorAll('.no-auth-required');
  noAuthItems.forEach(item => {
    item.style.display = isAuthenticated ? 'none' : 'block';
  });
}

/**
 * Handle logout button click
 * @param {Event} event - Click event
 */
async function handleLogout(event) {
  event.preventDefault();
  
  try {
    // Use global AuthClient if available
    if (window.authClient) {
      await window.authClient.logout();
    } else {
      // Clear auth state manually
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('username');
      localStorage.removeItem('subscription_data');
      
      // Dispatch auth changed event
      window.dispatchEvent(new CustomEvent('auth-changed'));
    }
    
    // Redirect to home page
    window.router.navigate('/');
  } catch (error) {
    console.error('Error logging out:', error);
    
    // Show error message
    alert('Error logging out: ' + (error.message || 'Unknown error'));
  }
}

// Export page initializers
export {
  initLoginPage,
  initRegisterPage,
  initApiKeysPage,
  initSettingsPage,
  initResetPasswordPage
};

// Export utilities
export {
  checkAuthStatus,
  logAuthStatus
};

// Export AuthClient
export {
  AuthClient
};

// Default export
export default {
  initApp,
  initLoginPage,
  initRegisterPage,
  initApiKeysPage,
  initSettingsPage,
  initResetPasswordPage,
  checkAuthStatus,
  logAuthStatus,
  AuthClient
};