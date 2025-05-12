/**
 * Login Page Example
 * 
 * This example shows how to use the AuthClient to implement a login page
 * that replaces the existing login functionality in your application.
 */

import { AuthClient } from './auth-client.js';

/**
 * Initialize login page
 */
export async function initLoginPage() {
  // Get form element
  const form = document.getElementById('login-form');
  if (!form) return;
  
  // Initialize auth status check button
  const checkAuthStatusButton = document.getElementById('check-auth-status');
  const authStatusResult = document.getElementById('auth-status-result');
  
  // Create AuthClient instance
  const authClient = await createAuthClient();
  
  // Check if already authenticated and redirect if needed
  const authStatus = await authClient.checkAuthStatus();
  if (authStatus.authenticated) {
    console.log('User already authenticated, redirecting to API keys page');
    window.router.navigate('/api-keys');
    return;
  }
  
  // Set up auth status check button
  if (checkAuthStatusButton && authStatusResult) {
    checkAuthStatusButton.addEventListener('click', async () => {
      try {
        // Show loading state
        authStatusResult.textContent = 'Checking auth status...';
        
        // Check auth status
        const status = await authClient.checkAuthStatus();
        
        // Display result
        authStatusResult.textContent = JSON.stringify(status, null, 2);
      } catch (error) {
        console.error('Error checking auth status:', error);
        authStatusResult.textContent = `Error: ${error.message}`;
      }
    });
  }
  
  // Set up form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Logging in...';
    submitButton.disabled = true;
    
    try {
      // Login with AuthClient
      const loginResult = await authClient.login({
        email,
        password
      });
      
      console.log('Login successful:', loginResult);
      
      // Check if the user is using the default password
      if (password === 'ChangeMe123!') {
        // Redirect to the reset password page
        console.log('User is using default password, redirecting to reset password page');
        alert('For security reasons, please change your default password before continuing.');
        window.router.navigate('/reset-password');
      } else {
        // Redirect to the API keys page
        console.log('Login successful, redirecting to API keys page');
        window.router.navigate('/api-keys');
      }
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error stack:', error.stack);
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Login failed: ';
      
      if (error.message && error.message.includes('Invalid email or password')) {
        errorMessage += 'Invalid credentials. Please check your email and password.';
      } else if (error.message && error.message.includes('Email not verified')) {
        errorMessage += 'Please verify your email before logging in.';
      } else {
        errorMessage += (error.message || 'Unable to complete login process');
      }
      
      console.error('Showing error message to user:', errorMessage);
      alert(errorMessage);
    }
  });
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
        // You can update UI elements here based on auth state
      }
    });
  } catch (error) {
    console.error('Error creating AuthClient:', error);
    throw error;
  }
}