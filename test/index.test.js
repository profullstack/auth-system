/**
 * Main test file for @profullstack/auth-system
 * This file imports and runs all other test files
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import all test files
import './utils/password.test.js';
import './utils/token.test.js';
import './utils/validation.test.js';
import './adapters/memory.test.js';
import './auth-system.test.js';

describe('@profullstack/auth-system', () => {
  it('should have a package.json file', () => {
    const pkgPath = path.join(__dirname, '../package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    
    const pkgContent = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg).toBeTypeOf('object');
    expect(pkg.name).toBe('@profullstack/auth-system');
  });
  
  it('should have a src directory', () => {
    const srcDir = path.join(__dirname, '../src');
    expect(fs.existsSync(srcDir)).toBe(true);
  });
});