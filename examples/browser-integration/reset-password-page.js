/**
 * Reset Password Page Example
 * 
 * This example shows how to use the AuthClient to implement a reset password page
 * that allows users to reset their password when logged in or request a password
 * reset when not logged in.
 */

import { AuthClient } from './auth-client.js';

/**
 * Initialize reset password page
 */
export async function initResetPasswordPage() {
  // Create AuthClient instance
  const authClient = await createAuthClient();
  
  // Check if we're in "request reset" mode or "confirm reset" mode
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');
  
  if (resetToken) {
    // We have a reset token, so we're in "confirm reset" mode
    initConfirmResetMode(authClient, resetToken);
  } else {
    // Check if user is logged in
    const authStatus = await authClient.checkAuthStatus();
    
    if (authStatus.authenticated) {
      // User is logged in, show change password form
      initLoggedInResetMode(authClient);
    } else {
      // User is not logged in, show request reset form
      initRequestResetMode(authClient);
    }
  }
}

/**
 * Initialize "confirm reset" mode
 * @param {AuthClient} authClient - AuthClient instance
 * @param {string} resetToken - Password reset token
 */
function initConfirmResetMode(authClient, resetToken) {
  // Show confirm reset form, hide other forms
  const confirmResetForm = document.getElementById('confirm-reset-form');
  const requestResetForm = document.getElementById('request-reset-form');
  const changePasswordForm = document.getElementById('change-password-form');
  
  if (confirmResetForm) confirmResetForm.style.display = 'block';
  if (requestResetForm) requestResetForm.style.display = 'none';
  if (changePasswordForm) changePasswordForm.style.display = 'none';
  
  // Update page title and description
  const pageTitle = document.querySelector('.page-title');
  const pageDescription = document.querySelector('.page-description');
  
  if (pageTitle) pageTitle.textContent = 'Reset Your Password';
  if (pageDescription) pageDescription.textContent = 'Enter your new password below to reset your password.';
  
  // Initialize confirm reset form
  if (confirmResetForm) {
    confirmResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Show loading state
      const submitButton = confirmResetForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.textContent = 'Resetting...';
      submitButton.disabled = true;
      
      try {
        // Get password data from form
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validate passwords
        if (password !== confirmPassword) {
          const { default: PfDialog } = await import('./components/pf-dialog.js');
          PfDialog.alert('Passwords do not match');
          
          // Reset button state
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
          return;
        }
        
        // Confirm password reset
        const result = await authClient.resetPasswordConfirm({
          token: resetToken,
          password
        });
        
        console.log('Password reset confirmed successfully:', result);
        
        // Show success message
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        await PfDialog.alert('Your password has been reset successfully. You can now log in with your new password.');
        
        // Redirect to login page
        window.router.navigate('/login');
      } catch (error) {
        console.error('Error confirming password reset:', error);
        
        // Reset button state
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        
        // Show error message
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        PfDialog.alert('Error resetting password: ' + (error.message || 'Unknown error'));
      }
    });
  }
}

/**
 * Initialize "logged in reset" mode (change password)
 * @param {AuthClient} authClient - AuthClient instance
 */
function initLoggedInResetMode(authClient) {
  // Show change password form, hide other forms
  const confirmResetForm = document.getElementById('confirm-reset-form');
  const requestResetForm = document.getElementById('request-reset-form');
  const changePasswordForm = document.getElementById('change-password-form');
  
  if (confirmResetForm) confirmResetForm.style.display = 'none';
  if (requestResetForm) requestResetForm.style.display = 'none';
  if (changePasswordForm) changePasswordForm.style.display = 'block';
  
  // Update page title and description
  const pageTitle = document.querySelector('.page-title');
  const pageDescription = document.querySelector('.page-description');
  
  if (pageTitle) pageTitle.textContent = 'Change Your Password';
  if (pageDescription) pageDescription.textContent = 'Enter your current password and a new password below.';
  
  // Initialize change password form
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Show loading state
      const submitButton = changePasswordForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.textContent = 'Changing...';
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
        changePasswordForm.reset();
        
        // Reset button state
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        
        // Show success message
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        await PfDialog.alert('Your password has been changed successfully.');
        
        // Redirect to settings page
        window.router.navigate('/settings');
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
}

/**
 * Initialize "request reset" mode
 * @param {AuthClient} authClient - AuthClient instance
 */
function initRequestResetMode(authClient) {
  // Show request reset form, hide other forms
  const confirmResetForm = document.getElementById('confirm-reset-form');
  const requestResetForm = document.getElementById('request-reset-form');
  const changePasswordForm = document.getElementById('change-password-form');
  
  if (confirmResetForm) confirmResetForm.style.display = 'none';
  if (requestResetForm) requestResetForm.style.display = 'block';
  if (changePasswordForm) changePasswordForm.style.display = 'none';
  
  // Update page title and description
  const pageTitle = document.querySelector('.page-title');
  const pageDescription = document.querySelector('.page-description');
  
  if (pageTitle) pageTitle.textContent = 'Reset Your Password';
  if (pageDescription) pageDescription.textContent = 'Enter your email address below to receive a password reset link.';
  
  // Initialize request reset form
  if (requestResetForm) {
    requestResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Show loading state
      const submitButton = requestResetForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.textContent = 'Sending...';
      submitButton.disabled = true;
      
      try {
        // Get email from form
        const email = document.getElementById('email').value;
        
        // Request password reset
        const result = await authClient.resetPassword(email);
        
        console.log('Password reset requested successfully:', result);
        
        // Reset form
        requestResetForm.reset();
        
        // Reset button state
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        
        // Show success message
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        await PfDialog.alert('If your email is registered, you will receive a password reset link. Please check your email.');
      } catch (error) {
        console.error('Error requesting password reset:', error);
        
        // Reset button state
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        
        // Show error message
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        PfDialog.alert('Error requesting password reset: ' + (error.message || 'Unknown error'));
      }
    });
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
        // You can update UI elements here based on auth state
      }
    });
  } catch (error) {
    console.error('Error creating AuthClient:', error);
    throw error;
  }
}