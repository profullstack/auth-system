# Browser Integration Example

This example demonstrates how to integrate the `@profullstack/auth-system` module into a browser-based web application. It provides a complete authentication system with user registration, login/logout, password reset, profile management, and API key management.

## Overview

The browser integration example includes:

- **AuthClient**: A browser-friendly wrapper around the auth-system module
- **Page Initializers**: Functions to initialize different pages in the application
- **Utilities**: Helper functions for authentication status and token management

## Files

- `auth-client.js`: Main client for browser integration with localStorage support
- `index.js`: Main entry point that exports all page initializers and utilities
- `login-page.js`: Login page implementation
- `register-page.js`: Registration page implementation with payment integration
- `settings-page.js`: Settings page with profile management and password change
- `reset-password-page.js`: Password reset functionality
- `api-keys-page.js`: API key management
- `utils/auth-status.js`: Authentication status utilities

## Usage

### Installation

First, install the auth-system module:

```bash
npm install @profullstack/auth-system
```

Then copy the browser integration files to your project.

### Basic Setup

```javascript
import { initApp, AuthClient } from './browser-integration/index.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  await initApp({
    createGlobalAuthClient: true
  });
});
```

### Page Initialization

Use the page initializers in your router or page load handlers:

```javascript
import { initLoginPage, initRegisterPage, initApiKeysPage, initSettingsPage, initResetPasswordPage } from './browser-integration/index.js';

// Set up router
const router = {
  '/login': initLoginPage,
  '/register': initRegisterPage,
  '/api-keys': initApiKeysPage,
  '/settings': initSettingsPage,
  '/reset-password': initResetPasswordPage
};

// Initialize current page
const path = window.location.pathname;
if (router[path]) {
  router[path]();
}
```

### Authentication Status

Check authentication status:

```javascript
import { checkAuthStatus } from './browser-integration/utils/auth-status.js';

async function checkIfLoggedIn() {
  const status = await checkAuthStatus();
  
  if (status.authenticated) {
    console.log('User is logged in:', status.user);
  } else {
    console.log('User is not logged in');
    window.location.href = '/login';
  }
}
```

### Direct AuthClient Usage

You can also use the AuthClient directly:

```javascript
import { AuthClient } from './browser-integration/auth-client.js';

async function createAuthClient() {
  const authClient = new AuthClient({
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseKey: 'your-anon-key',
    jwtSecret: 'your-jwt-secret',
    onAuthChanged: (authenticated, user) => {
      console.log('Auth state changed:', authenticated, user);
    }
  });
  
  return authClient;
}

async function loginUser(email, password) {
  const authClient = await createAuthClient();
  
  try {
    const result = await authClient.login({ email, password });
    console.log('Login successful:', result);
    return result;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}
```

## HTML Structure

The example assumes the following HTML structure for each page:

### Login Page

```html
<form id="login-form">
  <input type="email" id="email" required>
  <input type="password" id="password" required>
  <button type="submit">Login</button>
</form>

<button id="check-auth-status">Check Auth Status</button>
<pre id="auth-status-result"></pre>
```

### Register Page

```html
<form id="register-form">
  <input type="email" id="email" required>
  <input type="password" id="password" required>
  <input type="password" id="confirm-password" required>
  
  <div class="plan-options">
    <div class="plan-option" data-plan="monthly">Monthly</div>
    <div class="plan-option" data-plan="yearly">Yearly</div>
  </div>
  
  <div class="payment-methods">
    <div class="payment-method" data-payment="btc">Bitcoin</div>
    <div class="payment-method" data-payment="stripe">Stripe</div>
  </div>
  
  <button type="submit">Register & Subscribe</button>
</form>
```

### Settings Page

```html
<form id="profile-form">
  <input type="email" id="profile-email" disabled>
  <input type="text" id="profile-first-name">
  <input type="text" id="profile-last-name">
  <input type="tel" id="profile-phone">
  <button type="submit">Update Profile</button>
</form>

<form id="password-form">
  <input type="password" id="current-password" required>
  <input type="password" id="new-password" required>
  <input type="password" id="confirm-password" required>
  <button type="submit">Change Password</button>
</form>

<div id="subscription-info"></div>

<button id="delete-account-button">Delete Account</button>
```

### Reset Password Page

```html
<h2 class="page-title">Reset Password</h2>
<p class="page-description">Enter your email to reset your password</p>

<form id="request-reset-form">
  <input type="email" id="email" required>
  <button type="submit">Request Reset</button>
</form>

<form id="confirm-reset-form" style="display: none;">
  <input type="password" id="new-password" required>
  <input type="password" id="confirm-password" required>
  <button type="submit">Reset Password</button>
</form>

<form id="change-password-form" style="display: none;">
  <input type="password" id="current-password" required>
  <input type="password" id="new-password" required>
  <input type="password" id="confirm-password" required>
  <button type="submit">Change Password</button>
</form>
```

### API Keys Page

```html
<div id="api-keys-container"></div>

<form id="create-api-key-form">
  <input type="text" id="api-key-name" required>
  <button type="submit">Create API Key</button>
</form>
```

## Server API Endpoints

The example assumes the following server API endpoints:

- `/api/1/config/supabase`: Returns Supabase configuration
- `/api/1/auth/register`: Registers a new user
- `/api/1/subscriptions/status`: Checks subscription status
- `/api/1/subscriptions/create`: Creates a subscription
- `/api/1/api-keys`: Gets and creates API keys
- `/api/1/api-keys/:id`: Revokes an API key
- `/api/stripe-simple/create-checkout`: Creates a Stripe checkout session

## Customization

You can customize the AuthClient and page initializers to fit your application's needs. The example is designed to be modular and flexible, so you can use only the parts you need.

## Dialog Component

The example uses a custom dialog component (`PfDialog`) for displaying messages and confirmations. You'll need to implement this component or replace it with your own dialog implementation.

## Router

The example assumes a router object with a `navigate` method for page navigation. You'll need to implement this or replace it with your own routing solution.

## License

MIT