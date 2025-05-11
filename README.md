# @profullstack/auth-system

A flexible authentication system with user registration, login/logout, password reset, and session management.

## Features

- **User Management**: Registration, login, profile management
- **Authentication**: JWT-based authentication with access and refresh tokens
- **Password Management**: Secure password hashing, validation, reset
- **Email Verification**: Email verification for new accounts
- **Adapters**: Pluggable storage adapters (memory, database, etc.)
- **Middleware**: Express/Connect/Hono middleware for protected routes
- **Validation**: Input validation for emails, passwords, etc.
- **Customization**: Configurable password requirements, token expiry, etc.

## Installation

```bash
npm install @profullstack/auth-system
```

## Basic Usage

```javascript
import { createAuthSystem } from '@profullstack/auth-system';

// Create an auth system with default options
const authSystem = createAuthSystem({
  tokenOptions: {
    secret: 'your-secret-key-here',
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800 // 7 days
  }
});

// Register a new user
const registrationResult = await authSystem.register({
  email: 'user@example.com',
  password: 'Password123',
  profile: {
    firstName: 'John',
    lastName: 'Doe'
  }
});

// Login
const loginResult = await authSystem.login({
  email: 'user@example.com',
  password: 'Password123'
});

// Use the tokens for authentication
const { accessToken, refreshToken } = loginResult.tokens;
```

## API Reference

### Creating an Auth System

```javascript
import { createAuthSystem, MemoryAdapter } from '@profullstack/auth-system';

const authSystem = createAuthSystem({
  // Storage adapter (optional, defaults to in-memory)
  adapter: new MemoryAdapter(),
  
  // Token configuration (optional)
  tokenOptions: {
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800, // 7 days
    secret: 'your-secret-key-here'
  },
  
  // Password configuration (optional)
  passwordOptions: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  },
  
  // Email configuration (optional)
  emailOptions: {
    sendEmail: async (emailData) => {
      // Your email sending implementation
    },
    fromEmail: 'noreply@example.com',
    resetPasswordTemplate: {
      subject: 'Reset Your Password',
      text: 'Click the link to reset your password: {resetLink}',
      html: '<p>Click the link to reset your password: <a href="{resetLink}">{resetLink}</a></p>'
    },
    verificationTemplate: {
      subject: 'Verify Your Email',
      text: 'Click the link to verify your email: {verificationLink}',
      html: '<p>Click the link to verify your email: <a href="{verificationLink}">{verificationLink}</a></p>'
    }
  }
});
```

### User Registration

```javascript
const registrationResult = await authSystem.register({
  email: 'user@example.com',
  password: 'Password123',
  profile: {
    firstName: 'John',
    lastName: 'Doe'
  },
  autoVerify: false // Set to true to skip email verification
});
```

### User Login

```javascript
const loginResult = await authSystem.login({
  email: 'user@example.com',
  password: 'Password123'
});

// The login result contains user data and tokens
const { user, tokens } = loginResult;
```

### Token Refresh

```javascript
const refreshResult = await authSystem.refreshToken(refreshToken);

// The refresh result contains new tokens
const { accessToken, refreshToken } = refreshResult.tokens;
```

### Password Reset

```javascript
// Request password reset
const resetResult = await authSystem.resetPassword('user@example.com');

// Confirm password reset (in a real app, the token would come from the email link)
const confirmResult = await authSystem.resetPasswordConfirm({
  token: 'reset-token-from-email',
  password: 'NewPassword123'
});
```

### Email Verification

```javascript
// Verify email (in a real app, the token would come from the email link)
const verificationResult = await authSystem.verifyEmail('verification-token-from-email');
```

### User Profile Management

```javascript
// Get user profile
const profileResult = await authSystem.getProfile(userId);

// Update user profile
const updateResult = await authSystem.updateProfile({
  userId,
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '555-123-4567'
  }
});

// Change password
const changePasswordResult = await authSystem.changePassword({
  userId,
  currentPassword: 'Password123',
  newPassword: 'NewPassword123'
});
```

### Token Validation

```javascript
// Validate an access token
const user = await authSystem.validateToken(accessToken);

if (user) {
  // Token is valid, user contains user data
  console.log(`Valid token for user: ${user.email}`);
} else {
  // Token is invalid or expired
  console.log('Invalid token');
}
```

### Logout

```javascript
// Logout (invalidates the refresh token)
const logoutResult = await authSystem.logout(refreshToken);
```

### Middleware

```javascript
import express from 'express';
import { createAuthSystem } from '@profullstack/auth-system';

const app = express();
const authSystem = createAuthSystem();

// Protect routes with authentication middleware
app.use('/api/protected', authSystem.middleware());

app.get('/api/protected/profile', (req, res) => {
  // req.user contains the authenticated user data
  res.json({ user: req.user });
});

app.listen(3000);
```

## Storage Adapters

### Memory Adapter (Default)

Stores user data in memory. Suitable for development or testing.

```javascript
import { createAuthSystem, MemoryAdapter } from '@profullstack/auth-system';

const authSystem = createAuthSystem({
  adapter: new MemoryAdapter()
});
```

### JWT Adapter

Uses JSON Web Tokens (JWT) for authentication. Requires a database adapter for user storage.

```javascript
import { createAuthSystem, MemoryAdapter, JwtAdapter } from '@profullstack/auth-system';

const dbAdapter = new MemoryAdapter();
const jwtAdapter = new JwtAdapter({
  dbAdapter,
  secret: 'your-secret-key-here'
});

const authSystem = createAuthSystem({
  adapter: jwtAdapter
});
```

### Creating Custom Adapters

You can create custom adapters by implementing the adapter interface:

```javascript
class CustomAdapter {
  async createUser(userData) { /* ... */ }
  async getUserById(userId) { /* ... */ }
  async getUserByEmail(email) { /* ... */ }
  async updateUser(userId, updates) { /* ... */ }
  async deleteUser(userId) { /* ... */ }
  async invalidateToken(token) { /* ... */ }
  async isTokenInvalidated(token) { /* ... */ }
}
```

## Examples

See the [examples](./examples) directory for complete usage examples.

## License

MIT