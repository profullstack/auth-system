/**
 * API Keys Page Example
 * 
 * This example shows how to use the AuthClient to implement an API keys page
 * that checks authentication status and displays API keys.
 */

import { AuthClient } from './auth-client.js';

/**
 * Initialize API keys page
 */
export async function initApiKeysPage() {
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
    
    // Load API keys
    await loadApiKeys(authClient);
    
    // Initialize create API key form
    initCreateApiKeyForm(authClient);
    
    // Initialize API key actions (revoke, copy)
    initApiKeyActions(authClient);
    
  } catch (error) {
    console.error('Error initializing API keys page:', error);
    window.router.navigate('/login');
  }
}

/**
 * Load API keys
 * @param {AuthClient} authClient - AuthClient instance
 */
async function loadApiKeys(authClient) {
  try {
    // Get API keys from server
    const apiKeys = await fetchApiKeys(authClient);
    
    // Get API keys container
    const apiKeysContainer = document.getElementById('api-keys-container');
    if (!apiKeysContainer) return;
    
    // Clear container
    apiKeysContainer.innerHTML = '';
    
    if (apiKeys.length === 0) {
      // No API keys
      apiKeysContainer.innerHTML = `
        <div class="empty-state">
          <p>You don't have any API keys yet. Create one to get started.</p>
        </div>
      `;
      return;
    }
    
    // Create API key elements
    apiKeys.forEach(apiKey => {
      const apiKeyElement = document.createElement('div');
      apiKeyElement.className = 'api-key-item';
      apiKeyElement.dataset.id = apiKey.id;
      
      // Format created date
      const createdDate = new Date(apiKey.created_at).toLocaleDateString();
      
      // Format last used date
      const lastUsedDate = apiKey.last_used_at 
        ? new Date(apiKey.last_used_at).toLocaleDateString() 
        : 'Never';
      
      // Create API key HTML
      apiKeyElement.innerHTML = `
        <div class="api-key-details">
          <div class="api-key-name">${apiKey.name}</div>
          <div class="api-key-value">${maskApiKey(apiKey.key)}</div>
          <div class="api-key-meta">
            <span>Created: ${createdDate}</span>
            <span>Last used: ${lastUsedDate}</span>
          </div>
        </div>
        <div class="api-key-actions">
          <button class="copy-api-key" data-key="${apiKey.key}">Copy</button>
          <button class="revoke-api-key" data-id="${apiKey.id}">Revoke</button>
        </div>
      `;
      
      // Add API key element to container
      apiKeysContainer.appendChild(apiKeyElement);
    });
  } catch (error) {
    console.error('Error loading API keys:', error);
    
    // Show error message
    const { default: PfDialog } = await import('./components/pf-dialog.js');
    PfDialog.alert('Error loading API keys: ' + (error.message || 'Unknown error'));
  }
}

/**
 * Initialize create API key form
 * @param {AuthClient} authClient - AuthClient instance
 */
function initCreateApiKeyForm(authClient) {
  const createApiKeyForm = document.getElementById('create-api-key-form');
  if (!createApiKeyForm) return;
  
  createApiKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading state
    const submitButton = createApiKeyForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Creating...';
    submitButton.disabled = true;
    
    try {
      // Get API key name from form
      const apiKeyName = document.getElementById('api-key-name').value;
      
      // Create API key
      const apiKey = await createApiKey(authClient, apiKeyName);
      
      console.log('API key created successfully:', apiKey);
      
      // Reset form
      createApiKeyForm.reset();
      
      // Reset button state
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Show success message with the API key
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      await PfDialog.alert(`
        <div class="api-key-created">
          <p>Your API key has been created successfully.</p>
          <p>Make sure to copy your API key now. You won't be able to see it again.</p>
          <div class="api-key-display">
            <code>${apiKey.key}</code>
            <button onclick="navigator.clipboard.writeText('${apiKey.key}').then(() => this.textContent = 'Copied!'); setTimeout(() => this.textContent = 'Copy', 2000)"
              style="margin-left: 8px; padding: 4px 8px; background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">Copy</button>
          </div>
        </div>
      `, 'API Key Created');
      
      // Reload API keys
      await loadApiKeys(authClient);
    } catch (error) {
      console.error('Error creating API key:', error);
      
      // Reset button state
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Show error message
      const { default: PfDialog } = await import('./components/pf-dialog.js');
      PfDialog.alert('Error creating API key: ' + (error.message || 'Unknown error'));
    }
  });
}

/**
 * Initialize API key actions (revoke, copy)
 * @param {AuthClient} authClient - AuthClient instance
 */
function initApiKeyActions(authClient) {
  const apiKeysContainer = document.getElementById('api-keys-container');
  if (!apiKeysContainer) return;
  
  // Use event delegation for API key actions
  apiKeysContainer.addEventListener('click', async (e) => {
    // Copy API key
    if (e.target.classList.contains('copy-api-key')) {
      const apiKey = e.target.dataset.key;
      
      try {
        await navigator.clipboard.writeText(apiKey);
        
        // Change button text temporarily
        const originalText = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => {
          e.target.textContent = originalText;
        }, 2000);
      } catch (error) {
        console.error('Error copying API key:', error);
        
        // Show error message
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        PfDialog.alert('Error copying API key: ' + (error.message || 'Unknown error'));
      }
    }
    
    // Revoke API key
    if (e.target.classList.contains('revoke-api-key')) {
      const apiKeyId = e.target.dataset.id;
      
      try {
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        
        const confirmed = await PfDialog.confirm(
          'Are you sure you want to revoke this API key? This action cannot be undone.',
          'Revoke API Key',
          null,
          null,
          'Revoke',
          'Cancel'
        );
        
        if (confirmed) {
          // Show loading state
          const originalText = e.target.textContent;
          e.target.textContent = 'Revoking...';
          e.target.disabled = true;
          
          // Revoke API key
          await revokeApiKey(authClient, apiKeyId);
          
          console.log('API key revoked successfully');
          
          // Reload API keys
          await loadApiKeys(authClient);
        }
      } catch (error) {
        console.error('Error revoking API key:', error);
        
        // Reset button state
        e.target.textContent = 'Revoke';
        e.target.disabled = false;
        
        // Show error message
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        PfDialog.alert('Error revoking API key: ' + (error.message || 'Unknown error'));
      }
    }
  });
}

/**
 * Fetch API keys from server
 * @param {AuthClient} authClient - AuthClient instance
 * @returns {Promise<Array>} - API keys
 */
async function fetchApiKeys(authClient) {
  try {
    const response = await fetch('/api/1/api-keys', {
      headers: {
        'Authorization': `Bearer ${authClient.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch API keys');
    }
    
    const data = await response.json();
    return data.api_keys || [];
  } catch (error) {
    console.error('Error fetching API keys:', error);
    throw error;
  }
}

/**
 * Create API key
 * @param {AuthClient} authClient - AuthClient instance
 * @param {string} name - API key name
 * @returns {Promise<Object>} - Created API key
 */
async function createApiKey(authClient, name) {
  try {
    const response = await fetch('/api/1/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authClient.accessToken}`
      },
      body: JSON.stringify({ name })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create API key');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating API key:', error);
    throw error;
  }
}

/**
 * Revoke API key
 * @param {AuthClient} authClient - AuthClient instance
 * @param {string} apiKeyId - API key ID
 * @returns {Promise<void>}
 */
async function revokeApiKey(authClient, apiKeyId) {
  try {
    const response = await fetch(`/api/1/api-keys/${apiKeyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authClient.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to revoke API key');
    }
  } catch (error) {
    console.error('Error revoking API key:', error);
    throw error;
  }
}

/**
 * Mask API key
 * @param {string} apiKey - API key
 * @returns {string} - Masked API key
 */
function maskApiKey(apiKey) {
  if (!apiKey) return '';
  
  // Show first 4 and last 4 characters
  const firstFour = apiKey.substring(0, 4);
  const lastFour = apiKey.substring(apiKey.length - 4);
  
  return `${firstFour}...${lastFour}`;
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