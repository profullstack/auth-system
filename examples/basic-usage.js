/**
 * Basic usage examples for @profullstack/auth-system
 */

import { createAuthSystem, MemoryAdapter } from '../src/index.js';

// Create an auth system with default options (in-memory storage)
const authSystem = createAuthSystem({
  tokenOptions: {
    secret: 'your-secret-key-here',
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800 // 7 days
  },
  passwordOptions: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  }
});

// Sample email sending function (mock implementation)
const sendEmail = async (emailData) => {
  console.log('Sending email:');
  console.log(`To: ${emailData.to}`);
  console.log(`From: ${emailData.from}`);
  console.log(`Subject: ${emailData.subject}`);
  console.log(`Text: ${emailData.text}`);
  console.log('---');
};

/**
 * Run the examples
 */
async function runExamples() {
  try {
    console.log('Running authentication system examples...\n');
    
    // Example 1: Register a new user
    console.log('Example 1: Registering a new user');
    
    const registrationResult = await authSystem.register({
      email: 'user@example.com',
      password: 'Password123',
      profile: {
        firstName: 'John',
        lastName: 'Doe'
      },
      autoVerify: true // Skip email verification for this example
    });
    
    console.log('Registration result:', registrationResult);
    console.log();
    
    // Store tokens for later use
    const { tokens } = registrationResult;
    
    // Example 2: Login
    console.log('Example 2: Logging in');
    
    const loginResult = await authSystem.login({
      email: 'user@example.com',
      password: 'Password123'
    });
    
    console.log('Login result:', loginResult);
    console.log();
    
    // Example 3: Get user profile
    console.log('Example 3: Getting user profile');
    
    const profileResult = await authSystem.getProfile(loginResult.user.id);
    
    console.log('Profile result:', profileResult);
    console.log();
    
    // Example 4: Update user profile
    console.log('Example 4: Updating user profile');
    
    const updateProfileResult = await authSystem.updateProfile({
      userId: loginResult.user.id,
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '555-123-4567',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        }
      }
    });
    
    console.log('Update profile result:', updateProfileResult);
    console.log();
    
    // Example 5: Change password
    console.log('Example 5: Changing password');
    
    const changePasswordResult = await authSystem.changePassword({
      userId: loginResult.user.id,
      currentPassword: 'Password123',
      newPassword: 'NewPassword123'
    });
    
    console.log('Change password result:', changePasswordResult);
    console.log();
    
    // Example 6: Login with new password
    console.log('Example 6: Logging in with new password');
    
    const newLoginResult = await authSystem.login({
      email: 'user@example.com',
      password: 'NewPassword123'
    });
    
    console.log('New login result:', newLoginResult);
    console.log();
    
    // Example 7: Validate token
    console.log('Example 7: Validating token');
    
    const tokenValidationResult = await authSystem.validateToken(newLoginResult.tokens.accessToken);
    
    console.log('Token validation result:', tokenValidationResult);
    console.log();
    
    // Example 8: Refresh token
    console.log('Example 8: Refreshing token');
    
    const refreshTokenResult = await authSystem.refreshToken(newLoginResult.tokens.refreshToken);
    
    console.log('Refresh token result:', refreshTokenResult);
    console.log();
    
    // Example 9: Request password reset
    console.log('Example 9: Requesting password reset');
    
    // Set up email sending function for password reset
    authSystem.emailOptions.sendEmail = sendEmail;
    authSystem.emailOptions.fromEmail = 'noreply@example.com';
    
    const resetPasswordResult = await authSystem.resetPassword('user@example.com');
    
    console.log('Reset password result:', resetPasswordResult);
    console.log();
    
    // In a real application, the user would receive an email with a reset token
    // For this example, we'll use the token from the development environment
    const resetToken = resetPasswordResult.resetToken;
    
    // Example 10: Confirm password reset
    console.log('Example 10: Confirming password reset');
    
    const resetPasswordConfirmResult = await authSystem.resetPasswordConfirm({
      token: resetToken,
      password: 'ResetPassword123'
    });
    
    console.log('Reset password confirm result:', resetPasswordConfirmResult);
    console.log();
    
    // Example 11: Login with reset password
    console.log('Example 11: Logging in with reset password');
    
    const resetLoginResult = await authSystem.login({
      email: 'user@example.com',
      password: 'ResetPassword123'
    });
    
    console.log('Reset login result:', resetLoginResult);
    console.log();
    
    // Example 12: Logout
    console.log('Example 12: Logging out');
    
    const logoutResult = await authSystem.logout(resetLoginResult.tokens.refreshToken);
    
    console.log('Logout result:', logoutResult);
    console.log();
    
    // Example 13: Try to use invalidated refresh token
    console.log('Example 13: Trying to use invalidated refresh token');
    
    try {
      const invalidRefreshResult = await authSystem.refreshToken(resetLoginResult.tokens.refreshToken);
      console.log('Invalid refresh result:', invalidRefreshResult);
    } catch (error) {
      console.log('Error refreshing invalidated token:', error.message);
    }
    console.log();
    
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run the examples
runExamples();