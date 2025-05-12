/**
 * Settings Page Example
 * 
 * This example shows how to use the AuthClient to implement a settings page
 * that includes profile management, password changes, and account deletion.
 */

import { AuthClient } from './auth-client.js';

/**
 * Initialize settings page
 */
export async function initSettingsPage() {
  try {
    // Create AuthClient instance
    const authClient = await createAuthClient();
    
    // Check authentication status
    const authStatus = await authClient.checkAuthStatus();
    
    if (!authStatus.authenticated) {
      console.log('Not authenticated, redirecting to login page:', authStatus.message);
      window.router.navigate('/login');
      return;
    }
    
    console.log('Authentication verified with server');
    
    // Load user profile data
    await loadUserProfile(authClient);
    
    // Initialize profile form
    initProfileForm(authClient);
    
    // Initialize password form
    initPasswordForm(authClient);
    
    // Initialize delete account button
    initDeleteAccountButton(authClient);
    
  } catch (error) {
    console.error('Error initializing settings page:', error);
    window.router.navigate('/login');
  }
}

/**
 * Load user profile data
 * @param {AuthClient} authClient - AuthClient instance
 */
async function loadUserProfile(authClient) {
  try {
    // Get user profile
    const profileResult = await authClient.getProfile();
    const user = profileResult.user;
    
    // Populate profile form fields
    const emailField = document.getElementById('profile-email');
    if (emailField) {
      emailField.value = user.email;
      emailField.disabled = true; // Email is typically not editable
    }
    
    // Populate other profile fields
    const firstNameField = document.getElementById('profile-first-name');
    if (firstNameField) {
      firstNameField.value = user.profile.firstName || '';
    }
    
    const lastNameField = document.getElementById('profile-last-name');
    if (lastNameField) {
      lastNameField.value = user.profile.lastName || '';
    }
    
    const phoneField = document.getElementById('profile-phone');
    if (phoneField) {
      phoneField.value = user.profile.phoneNumber || '';
    }
    
    // Display subscription information if available
    const subscriptionInfo = document.getElementById('subscription-info');
    if (subscriptionInfo && user.subscription) {
      const plan = user.subscription.plan || 'Unknown';
      const status = user.subscription.status || 'Unknown';
      const expiresAt = user.subscription.expiresAt 
        ? new Date(user.subscription.expiresAt).toLocaleDateString() 
        : 'N/A';
      
      subscriptionInfo.innerHTML = `
        <div class="subscription-details">
          <p><strong>Plan:</strong> ${plan}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p><strong>Expires:</strong> ${expiresAt}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
    // Import PfDialog component
    const { default: PfDialog } = await import('./components/pf-dialog.js');
    PfDialog.alert('Error loading profile data. Please try again later.');
  }
}

/**
 * Initialize profile form
 * @param {AuthClient} authClient - AuthClient instance
 */
function initProfileForm(authClient) {
  const profileForm = document.getElementById('profile-form');
  if (!profileForm) return;
  
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading state
    const submitButton = profileForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Updating...';
    submitButton.disabled = true;
    
    try {
      // Get profile data from form
      const firstName = document.getElementById('profile-first-name').value;
      const lastName = document.getElementById('profile-last-name').value;
      const phoneNumber = document.getElementById('profile-phone').value;
      
      // Update profile
      const result = await authClient.updateProfile({
        firstName,
        lastName,
        phoneNumber
      });
      
      console.log('Profile updated successfully:', result);
      
      // Reset button state
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Show success message
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      PfDialog.alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // Reset button state
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Show error message
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      PfDialog.alert('Error updating profile: ' + (error.message || 'Unknown error'));
    }
  });
}

/**
 * Initialize password form
 * @param {AuthClient} authClient - AuthClient instance
 */
function initPasswordForm(authClient) {
  const passwordForm = document.getElementById('password-form');
  if (!passwordForm) return;
  
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading state
    const submitButton = passwordForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Updating...';
    submitButton.disabled = true;
    
    try {
      // Get password data from form
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      
      // Validate passwords
      if (newPassword !== confirmPassword) {
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        PfDialog.alert('New passwords do not match');
        
        // Reset button state
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        return;
      }
      
      // Change password
      const result = await authClient.changePassword({
        currentPassword,
        newPassword
      });
      
      console.log('Password changed successfully:', result);
      
      // Reset form
      passwordForm.reset();
      
      // Reset button state
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Show success message
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      PfDialog.alert('Password changed successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      
      // Reset button state
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Show error message
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      PfDialog.alert('Error changing password: ' + (error.message || 'Unknown error'));
    }
  });
}

/**
 * Initialize delete account button
 * @param {AuthClient} authClient - AuthClient instance
 */
function initDeleteAccountButton(authClient) {
  const deleteButton = document.getElementById('delete-account-button');
  if (!deleteButton) return;
  
  deleteButton.addEventListener('click', async () => {
    try {
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      
      const confirmed = await PfDialog.confirm(
        'Are you sure you want to delete your account? This action cannot be undone.',
        'Delete Account',
        null,
        null,
        'Delete',
        'Cancel'
      );
      
      if (confirmed) {
        // Show loading state
        deleteButton.textContent = 'Deleting...';
        deleteButton.disabled = true;
        
        // Delete account
        const result = await authClient.deleteAccount();
        
        console.log('Account deleted successfully:', result);
        
        // Show success message
        await PfDialog.alert('Your account has been deleted successfully.');
        
        // Redirect to home page
        window.router.navigate('/');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      
      // Reset button state
      deleteButton.textContent = 'Delete Account';
      deleteButton.disabled = false;
      
      // Show error message
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      PfDialog.alert('Error deleting account: ' + (error.message || 'Unknown error'));
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