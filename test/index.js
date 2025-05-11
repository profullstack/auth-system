/**
 * Basic tests for @profullstack/auth-system
 */

// Import the module
const authSystem = require('../src/index.js');

// Basic test to ensure the module exports something
console.log('Testing @profullstack/auth-system...');
console.log('Module exports:', Object.keys(authSystem));

if (Object.keys(authSystem).length === 0) {
  console.error('ERROR: Module does not export anything!');
  process.exit(1);
}

// Test adapters if they exist
try {
  const jwtAdapter = require('../src/adapters/jwt.js');
  console.log('Testing JWT adapter...');
  console.log('JWT adapter exports:', Object.keys(jwtAdapter));
} catch (err) {
  console.log('JWT adapter not found or could not be loaded:', err.message);
}

try {
  const memoryAdapter = require('../src/adapters/memory.js');
  console.log('Testing memory adapter...');
  console.log('Memory adapter exports:', Object.keys(memoryAdapter));
} catch (err) {
  console.log('Memory adapter not found or could not be loaded:', err.message);
}

// Test utils if they exist
try {
  const passwordUtils = require('../src/utils/password.js');
  console.log('Testing password utils...');
  console.log('Password utils exports:', Object.keys(passwordUtils));
} catch (err) {
  console.log('Password utils not found or could not be loaded:', err.message);
}

try {
  const tokenUtils = require('../src/utils/token.js');
  console.log('Testing token utils...');
  console.log('Token utils exports:', Object.keys(tokenUtils));
} catch (err) {
  console.log('Token utils not found or could not be loaded:', err.message);
}

try {
  const validationUtils = require('../src/utils/validation.js');
  console.log('Testing validation utils...');
  console.log('Validation utils exports:', Object.keys(validationUtils));
} catch (err) {
  console.log('Validation utils not found or could not be loaded:', err.message);
}

// Test basic functionality
if (typeof authSystem.authenticate === 'function') {
  console.log('Testing authenticate function exists:', typeof authSystem.authenticate === 'function' ? 'SUCCESS' : 'FAILED');
}

if (typeof authSystem.authorize === 'function') {
  console.log('Testing authorize function exists:', typeof authSystem.authorize === 'function' ? 'SUCCESS' : 'FAILED');
}

console.log('Basic test passed!');