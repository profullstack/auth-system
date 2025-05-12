/**
 * Example of using the Auth System with Supabase adapter
 */

import { createAuthSystem, SupabaseAdapter } from '../src/index.js';

// Create Supabase adapter
const supabaseAdapter = new SupabaseAdapter({
  supabaseUrl: 'https://your-project-id.supabase.co',
  supabaseKey: 'your-supabase-api-key',
  tableName: 'users', // Optional: defaults to 'users'
  tokensTableName: 'invalidated_tokens' // Optional: defaults to 'invalidated_tokens'
});

// Create auth system with Supabase adapter
const auth = createAuthSystem({
  adapter: supabaseAdapter,
  tokenOptions: {
    secret: 'your-jwt-secret-key',
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800 // 7 days
  },
  passwordOptions: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },
  emailOptions: {
    sendEmail: async (emailData) => {
      // Implement your email sending logic here
      console.log('Sending email:', emailData);
    },
    fromEmail: 'noreply@yourdomain.com',
    resetPasswordTemplate: {
      subject: 'Reset Your Password',
      text: 'Click the link to reset your password: {token}',
      html: '<p>Click the link to reset your password: <a href="{token}">{token}</a></p>'
    },
    verificationTemplate: {
      subject: 'Verify Your Email',
      text: 'Click the link to verify your email: {token}',
      html: '<p>Click the link to verify your email: <a href="{token}">{token}</a></p>'
    }
  }
});

// Example usage

// Register a new user
async function registerUser() {
  try {
    const result = await auth.register({
      email: 'user@example.com',
      password: 'SecureP@ssw0rd',
      profile: {
        firstName: 'John',
        lastName: 'Doe'
      },
      autoVerify: true // Set to false in production to require email verification
    });
    
    console.log('Registration result:', result);
    return result;
  } catch (error) {
    console.error('Registration error:', error.message);
  }
}

// Login a user
async function loginUser() {
  try {
    const result = await auth.login({
      email: 'user@example.com',
      password: 'SecureP@ssw0rd'
    });
    
    console.log('Login result:', result);
    return result;
  } catch (error) {
    console.error('Login error:', error.message);
  }
}

// Get user profile
async function getUserProfile(userId) {
  try {
    const result = await auth.getProfile(userId);
    console.log('User profile:', result);
    return result;
  } catch (error) {
    console.error('Get profile error:', error.message);
  }
}

// Update user profile
async function updateUserProfile(userId) {
  try {
    const result = await auth.updateProfile({
      userId,
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        bio: 'Software developer'
      }
    });
    
    console.log('Profile update result:', result);
    return result;
  } catch (error) {
    console.error('Update profile error:', error.message);
  }
}

// Change password
async function changePassword(userId) {
  try {
    const result = await auth.changePassword({
      userId,
      currentPassword: 'SecureP@ssw0rd',
      newPassword: 'NewSecureP@ssw0rd123'
    });
    
    console.log('Password change result:', result);
    return result;
  } catch (error) {
    console.error('Change password error:', error.message);
  }
}

// Request password reset
async function requestPasswordReset() {
  try {
    const result = await auth.resetPassword('user@example.com');
    console.log('Password reset request result:', result);
    return result;
  } catch (error) {
    console.error('Password reset request error:', error.message);
  }
}

// Confirm password reset
async function confirmPasswordReset(token) {
  try {
    const result = await auth.resetPasswordConfirm({
      token,
      password: 'NewSecureP@ssw0rd456'
    });
    
    console.log('Password reset confirmation result:', result);
    return result;
  } catch (error) {
    console.error('Password reset confirmation error:', error.message);
  }
}

// Verify email
async function verifyEmail(token) {
  try {
    const result = await auth.verifyEmail(token);
    console.log('Email verification result:', result);
    return result;
  } catch (error) {
    console.error('Email verification error:', error.message);
  }
}

// Refresh token
async function refreshToken(refreshToken) {
  try {
    const result = await auth.refreshToken(refreshToken);
    console.log('Token refresh result:', result);
    return result;
  } catch (error) {
    console.error('Token refresh error:', error.message);
  }
}

// Logout
async function logout(refreshToken) {
  try {
    const result = await auth.logout(refreshToken);
    console.log('Logout result:', result);
    return result;
  } catch (error) {
    console.error('Logout error:', error.message);
  }
}

// Example flow
async function runExample() {
  // Register a new user
  const registration = await registerUser();
  if (!registration) return;
  
  // Get user ID and tokens
  const { user, tokens } = registration;
  
  // Get user profile
  await getUserProfile(user.id);
  
  // Update user profile
  await updateUserProfile(user.id);
  
  // Change password
  await changePassword(user.id);
  
  // Login with new password
  const login = await loginUser();
  if (!login) return;
  
  // Refresh token
  await refreshToken(login.tokens.refreshToken);
  
  // Logout
  await logout(login.tokens.refreshToken);
}

// Run the example
runExample().catch(console.error);