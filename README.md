# @profullstack/auth-system

A flexible authentication system with user registration, login/logout, password reset, and session management.

## Features

- **User Management**: Registration, login, profile management
- **Authentication**: JWT-based authentication with access and refresh tokens
- **Password Management**: Secure password hashing, validation, reset
- **Email Verification**: Email verification for new accounts
- **Adapters**: Pluggable storage adapters (memory, Supabase, MySQL, PostgreSQL, MongoDB, PocketBase, etc.)
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

### Supabase Adapter

Uses Supabase for user storage and authentication. Requires the `@supabase/supabase-js` package.

```javascript
import { createAuthSystem, SupabaseAdapter } from '@profullstack/auth-system';

const supabaseAdapter = new SupabaseAdapter({
  supabaseUrl: 'https://your-project-id.supabase.co',
  supabaseKey: 'your-supabase-api-key',
  tableName: 'users', // Optional: defaults to 'users'
  tokensTableName: 'invalidated_tokens' // Optional: defaults to 'invalidated_tokens'
});

const authSystem = createAuthSystem({
  adapter: supabaseAdapter,
  tokenOptions: {
    secret: 'your-jwt-secret-key'
  }
});
```

> **Note:** Before using the Supabase adapter, you need to set up the required tables in your Supabase database. You can use the [supabase-schema.sql](./examples/supabase-schema.sql) file to create the necessary tables and indexes.

### MySQL Adapter

Uses MySQL for user storage and authentication. Requires the `mysql2` package.

```javascript
import { createAuthSystem, MySQLAdapter } from '@profullstack/auth-system';

const mysqlAdapter = new MySQLAdapter({
  host: 'localhost',
  port: 3306,
  database: 'auth_system',
  user: 'root',
  password: 'password',
  usersTable: 'users', // Optional: defaults to 'users'
  tokensTable: 'invalidated_tokens' // Optional: defaults to 'invalidated_tokens'
});

const authSystem = createAuthSystem({
  adapter: mysqlAdapter,
  tokenOptions: {
    secret: 'your-jwt-secret-key'
  }
});
```

> **Note:** This is a stub implementation. You'll need to complete the implementation before using it in production.

### PostgreSQL Adapter

Uses PostgreSQL for user storage and authentication. Requires the `pg` package.

```javascript
import { createAuthSystem, PostgresAdapter } from '@profullstack/auth-system';

const postgresAdapter = new PostgresAdapter({
  host: 'localhost',
  port: 5432,
  database: 'auth_system',
  user: 'postgres',
  password: 'password',
  usersTable: 'users', // Optional: defaults to 'users'
  tokensTable: 'invalidated_tokens' // Optional: defaults to 'invalidated_tokens'
});

const authSystem = createAuthSystem({
  adapter: postgresAdapter,
  tokenOptions: {
    secret: 'your-jwt-secret-key'
  }
});
```

> **Note:** This is a stub implementation. You'll need to complete the implementation before using it in production.

### MongoDB Adapter

Uses MongoDB for user storage and authentication. Requires the `mongodb` package.

```javascript
import { createAuthSystem, MongoDBAdapter } from '@profullstack/auth-system';

const mongodbAdapter = new MongoDBAdapter({
  uri: 'mongodb://localhost:27017',
  dbName: 'auth_system',
  usersCollection: 'users', // Optional: defaults to 'users'
  tokensCollection: 'invalidated_tokens' // Optional: defaults to 'invalidated_tokens'
});

const authSystem = createAuthSystem({
  adapter: mongodbAdapter,
  tokenOptions: {
    secret: 'your-jwt-secret-key'
  }
});
```

> **Note:** This is a stub implementation. You'll need to complete the implementation before using it in production.

### PocketBase Adapter

Uses PocketBase for user storage and authentication. Requires the `pocketbase` package.

```javascript
import { createAuthSystem, PocketBaseAdapter } from '@profullstack/auth-system';

const pocketbaseAdapter = new PocketBaseAdapter({
  url: 'http://127.0.0.1:8090',
  usersCollection: 'auth_users', // Optional: defaults to 'auth_users'
  tokensCollection: 'auth_invalidated_tokens', // Optional: defaults to 'auth_invalidated_tokens'
  adminEmail: 'admin@example.com', // Optional: for admin authentication
  adminPassword: 'password' // Optional: for admin authentication
});

const authSystem = createAuthSystem({
  adapter: pocketbaseAdapter,
  tokenOptions: {
    secret: 'your-jwt-secret-key'
  }
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

> **Note:** Before using the PocketBase adapter, you need to set up the required collections in your PocketBase database. You can use the [pocketbase-schema.json](./examples/pocketbase-schema.json) file to create the necessary collections and indexes.

## Examples

See the [examples](./examples) directory for complete usage examples:

- [Basic Usage](./examples/basic-usage.js): Simple example of using the auth system
- [Supabase Usage](./examples/supabase-usage.js): Example of using the auth system with Supabase
- [Supabase Schema](./examples/supabase-schema.sql): SQL schema for setting up Supabase tables
- [PocketBase Usage](./examples/pocketbase-usage.js): Example of using the auth system with PocketBase
- [PocketBase Schema](./examples/pocketbase-schema.json): JSON schema for setting up PocketBase collections
- [Browser Integration](./examples/browser-integration/): Complete example of integrating the auth system into a browser-based web application

### Browser Integration

The browser integration example provides a complete authentication system for web applications, including:

- User registration with payment integration (Stripe, crypto)
- Login/logout functionality
- Password reset and change
- Profile management
- API key management
- Authentication status utilities

It includes a browser-friendly wrapper around the auth-system module with localStorage support and event handling. See the [Browser Integration README](./examples/browser-integration/README.md) for more details.

## License

MIT