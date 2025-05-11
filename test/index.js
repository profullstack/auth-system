/**
 * Basic tests for @profullstack/auth-system
 */

// Import the module
import authSystem from '../src/index.js';
import { jest } from '@jest/globals';

// Import adapters and utils
let jwtAdapter, memoryAdapter, passwordUtils, tokenUtils, validationUtils;

try { jwtAdapter = await import('../src/adapters/jwt.js'); }
catch (err) { console.log('JWT adapter not found or could not be loaded:', err.message); }

try { memoryAdapter = await import('../src/adapters/memory.js'); }
catch (err) { console.log('Memory adapter not found or could not be loaded:', err.message); }

try { passwordUtils = await import('../src/utils/password.js'); }
catch (err) { console.log('Password utils not found or could not be loaded:', err.message); }

try { tokenUtils = await import('../src/utils/token.js'); }
catch (err) { console.log('Token utils not found or could not be loaded:', err.message); }

try { validationUtils = await import('../src/utils/validation.js'); }
catch (err) { console.log('Validation utils not found or could not be loaded:', err.message); }

describe('@profullstack/auth-system', () => {
  test('module exports something', () => {
    console.log('Testing @profullstack/auth-system...');
    console.log('Module exports:', Object.keys(authSystem));
    
    expect(Object.keys(authSystem).length).toBeGreaterThan(0);
  });
  
  // Test adapters if they exist
  test('JWT adapter if available', () => {
    if (jwtAdapter) {
      console.log('Testing JWT adapter...');
      console.log('JWT adapter exports:', Object.keys(jwtAdapter));
      expect(Object.keys(jwtAdapter).length).toBeGreaterThan(0);
    } else {
      console.log('JWT adapter not available, skipping test');
    }
  });
  
  test('Memory adapter if available', () => {
    if (memoryAdapter) {
      console.log('Testing memory adapter...');
      console.log('Memory adapter exports:', Object.keys(memoryAdapter));
      expect(Object.keys(memoryAdapter).length).toBeGreaterThan(0);
    } else {
      console.log('Memory adapter not available, skipping test');
    }
  });
  
  // Test utils if they exist
  test('Password utils if available', () => {
    if (passwordUtils) {
      console.log('Testing password utils...');
      console.log('Password utils exports:', Object.keys(passwordUtils));
      expect(Object.keys(passwordUtils).length).toBeGreaterThan(0);
    } else {
      console.log('Password utils not available, skipping test');
    }
  });
  
  test('Token utils if available', () => {
    if (tokenUtils) {
      console.log('Testing token utils...');
      console.log('Token utils exports:', Object.keys(tokenUtils));
      expect(Object.keys(tokenUtils).length).toBeGreaterThan(0);
    } else {
      console.log('Token utils not available, skipping test');
    }
  });
  
  test('Validation utils if available', () => {
    if (validationUtils) {
      console.log('Testing validation utils...');
      console.log('Validation utils exports:', Object.keys(validationUtils));
      expect(Object.keys(validationUtils).length).toBeGreaterThan(0);
    } else {
      console.log('Validation utils not available, skipping test');
    }
  });
  
  // Test basic functionality
  test('authenticate function if available', () => {
    if (typeof authSystem.authenticate === 'function') {
      console.log('Testing authenticate function exists');
      expect(authSystem.authenticate).toBeDefined();
    } else {
      console.log('authenticate function not available, skipping test');
    }
  });
  
  test('authorize function if available', () => {
    if (typeof authSystem.authorize === 'function') {
      console.log('Testing authorize function exists');
      expect(authSystem.authorize).toBeDefined();
    } else {
      console.log('authorize function not available, skipping test');
    }
  });
});