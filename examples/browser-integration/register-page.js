/**
 * Register Page Example
 * 
 * This example shows how to use the AuthClient to implement a registration page
 * that replaces the existing registration functionality in your application.
 */

import { AuthClient } from './auth-client.js';

/**
 * Initialize register page
 */
export async function initRegisterPage() {
  // Get form element
  const form = document.getElementById('register-form');
  if (!form) return;
  
  // Create AuthClient instance
  const authClient = await createAuthClient();
  
  // Check if already authenticated and redirect if needed
  const authStatus = await authClient.checkAuthStatus();
  if (authStatus.authenticated) {
    console.log('User already authenticated, redirecting to API keys page');
    window.router.navigate('/api-keys');
    return;
  }
  
  // Set up plan selection
  const planOptions = document.querySelectorAll('.plan-option');
  if (planOptions.length > 0) {
    planOptions.forEach(option => {
      option.addEventListener('click', () => {
        planOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
      });
    });
  }
  
  // Set up payment method selection
  const paymentMethods = document.querySelectorAll('.payment-method');
  if (paymentMethods.length > 0) {
    paymentMethods.forEach(method => {
      method.addEventListener('click', () => {
        paymentMethods.forEach(m => m.classList.remove('selected'));
        method.classList.add('selected');
      });
    });
  }
  
  // Set up form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get the submit button reference right away to avoid reference errors
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Register & Subscribe';
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    // Get selected plan and payment method if they exist
    let selectedPlan = 'monthly';
    let selectedPayment = 'btc';
    
    const selectedPlanElement = document.querySelector('.plan-option.selected');
    if (selectedPlanElement) {
      selectedPlan = selectedPlanElement.dataset.plan;
    }
    
    const selectedPaymentElement = document.querySelector('.payment-method.selected');
    if (selectedPaymentElement) {
      selectedPayment = selectedPaymentElement.dataset.payment;
    }
    
    // Show loading state
    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;
    
    try {
      // For Stripe payment, we'll register the user first, then redirect to Stripe Checkout
      if (selectedPayment === 'stripe') {
        // Register user with auto-verify set to true (since we'll verify through payment)
        const registrationResult = await authClient.register({
          email,
          password,
          profile: {
            plan: selectedPlan,
            paymentMethod: selectedPayment,
            paymentStatus: 'pending'
          },
          autoVerify: true // Auto-verify for Stripe payments
        });
        
        console.log('Registration successful:', registrationResult);
        
        // Generate a unique client ID for this registration attempt
        const tempClientId = `temp_${Date.now()}`;
        localStorage.setItem('temp_client_id', tempClientId);
        
        // Store registration data in localStorage
        localStorage.setItem('temp_registration_email', email);
        localStorage.setItem('temp_registration_plan', selectedPlan);
        localStorage.setItem('temp_register_timestamp', Date.now().toString());
        
        // Redirect to Stripe checkout
        try {
          console.log('Creating Stripe checkout session...');
          submitButton.disabled = true;
          submitButton.textContent = 'Preparing checkout...';
          
          // Use our simplified endpoint that makes a direct fetch call to Stripe
          const response = await fetch('/api/stripe-simple/create-checkout', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authClient.accessToken}`
            },
            body: JSON.stringify({ 
              email,
              plan: selectedPlan
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create checkout session');
          }
          
          const data = await response.json();
          console.log('Checkout session created:', data);
          
          // Check for checkout URL
          if (!data.url && !data.checkout_url) {
            throw new Error('No checkout URL in response');
          }
          
          // Save checkout details in localStorage
          localStorage.setItem('temp_checkout_id', data.id);
          
          // Redirect to Stripe checkout page
          const checkoutUrl = data.checkout_url || data.url;
          console.log('Redirecting to Stripe checkout:', checkoutUrl);
          window.location.href = checkoutUrl;
          return;
        } catch (error) {
          console.error('Stripe checkout error:', error);
          alert('Payment setup failed. Please try again or contact support.');
          
          // Reset button state
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
          return;
        }
      } else {
        // For crypto payments, register the user and create a subscription
        
        // Register user with auto-verify set to true (since we'll verify through payment)
        const registrationResult = await authClient.register({
          email,
          password,
          profile: {
            plan: selectedPlan,
            paymentMethod: selectedPayment,
            paymentStatus: 'pending'
          },
          autoVerify: true // Auto-verify for crypto payments
        });
        
        console.log('Registration successful:', registrationResult);
        
        // Create subscription
        const subscriptionData = await authClient.createSubscription({
          plan: selectedPlan,
          paymentMethod: selectedPayment
        });
        
        console.log('Subscription created:', subscriptionData);
        
        // Show success message with payment information
        const paymentAddress = subscriptionData.subscription.payment_address;
        const amount = subscriptionData.subscription.amount;
        const cryptoAmount = subscriptionData.subscription.crypto_amount ? subscriptionData.subscription.crypto_amount.toFixed(8) : 'calculating...';
        const coin = subscriptionData.subscription.payment_method.toUpperCase();
        
        // Create elements to store references for updating later
        const statusDisplay = {
          container: null,
          text: null,
          spinner: null
        };
        
        // Function to check payment status and update UI
        const checkPaymentStatus = async () => {
          try {
            // Check subscription status
            const subscriptionStatus = await authClient.checkSubscriptionStatus();
            console.log('Payment status check result:', subscriptionStatus);
            
            // Check if we have valid references to the elements
            if (!statusDisplay.container || !statusDisplay.text || !statusDisplay.spinner) {
              console.error('Status elements not found');
              return false;
            }
            
            if (subscriptionStatus.has_subscription && subscriptionStatus.subscription.status === 'active') {
              // Payment received, show success message
              statusDisplay.container.style.backgroundColor = '#d1fae5'; // Light green
              statusDisplay.text.textContent = 'Payment received! Redirecting to your dashboard...';
              statusDisplay.spinner.style.display = 'none';
              
              // Wait 3 seconds and redirect
              setTimeout(() => {
                window.router.navigate('/api-keys');
              }, 3000);
              
              // Clear the polling interval
              return true;
            }
            
            // Payment not received yet, keep polling
            return false;
          } catch (error) {
            console.error('Error checking payment status:', error);
            return false;
          }
        };
        
        // Import PfDialog component
        const { default: PfDialog } = await import('./components/pf-dialog.js');
        
        // Enhanced dialog with the payment information, copyable fields and payment verification
        // Using classes instead of IDs to make them easier to query
        const paymentDialog = PfDialog.alert(`
          <div class="payment-success">
            <h3 style="color: #2563eb; margin-bottom: 15px;">Registration Successful!</h3>
            <p style="margin-bottom: 20px;">Please send <strong>${amount} USD</strong> (<strong>${cryptoAmount} ${coin}</strong>) to the address below:</p>
            
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-weight: 600; margin-bottom: 5px;">Amount:</label>
              <div style="display: flex; align-items: center;">
                <input type="text" value="${cryptoAmount} ${coin}" readonly
                  style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; background-color: #f9fafb;">
                <button onclick="navigator.clipboard.writeText('${cryptoAmount} ${coin}').then(() => this.textContent = 'Copied!'); setTimeout(() => this.textContent = 'Copy', 2000)"
                  style="margin-left: 8px; padding: 8px 12px; background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">Copy</button>
              </div>
            </div>
            
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-weight: 600; margin-bottom: 5px;">Address:</label>
              <div style="display: flex; align-items: center;">
                <input type="text" value="${paymentAddress}" readonly
                  style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; background-color: #f9fafb;">
                <button onclick="navigator.clipboard.writeText('${paymentAddress}').then(() => this.textContent = 'Copied!'); setTimeout(() => this.textContent = 'Copy', 2000)"
                  style="margin-left: 8px; padding: 8px 12px; background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">Copy</button>
              </div>
            </div>
            
            <div class="payment-status-container" style="margin-top: 20px; padding: 12px; border-radius: 6px; background-color: #f0f9ff; display: flex; align-items: center;">
              <div class="payment-spinner" style="margin-right: 12px; width: 20px; height: 20px; border: 3px solid rgba(37, 99, 235, 0.3); border-radius: 50%; border-top-color: #2563eb; animation: spin 1s linear infinite;"></div>
              <p class="payment-status-text" style="margin: 0; color: #1e40af;">Waiting for payment confirmation...</p>
            </div>
            
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </div>
        `, 'Payment Details', null, 'Check Payment Status');
        
        // Find the dialog in the DOM and get references to status elements
        // We need to wait for the dialog to be fully rendered
        let pollingInterval = null;
        
        setTimeout(() => {
          // Find dialog in the document
          const dialog = document.querySelector('pf-dialog');
          if (dialog && dialog.shadowRoot) {
            // Query the dialog's shadow DOM for elements
            const dialogBody = dialog.shadowRoot.querySelector('.dialog-body');
            const continueButton = dialog.shadowRoot.querySelector('.confirm-button');
            
            if (dialogBody && continueButton) {
              // Get references to status elements
              statusDisplay.container = dialogBody.querySelector('.payment-status-container');
              statusDisplay.spinner = dialogBody.querySelector('.payment-spinner');
              statusDisplay.text = dialogBody.querySelector('.payment-status-text');
              
              // Initial state - hide the status container until Continue is clicked
              if (statusDisplay.container) {
                statusDisplay.container.style.display = 'none';
              }
              
              // Replace the Continue button click handler to handle polling
              continueButton.removeEventListener('click', continueButton.onclick);
              continueButton.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show the spinner in the button and disable it
                const originalButtonText = continueButton.textContent;
                continueButton.innerHTML = `<span style="display: inline-block; width: 15px; height: 15px; border: 2px solid white; border-radius: 50%; border-top-color: transparent; margin-right: 8px; animation: spin 1s linear infinite;"></span> Checking...`;
                continueButton.disabled = true;
                
                // Show the status container
                if (statusDisplay.container) {
                  statusDisplay.container.style.display = 'flex';
                }
                
                // First check if payment is already received
                const paymentReceived = await checkPaymentStatus();
                if (paymentReceived) {
                  // Already paid, will redirect shortly
                  return;
                }
                
                // Start polling for payment status every 5 seconds
                pollingInterval = setInterval(async () => {
                  const paymentReceived = await checkPaymentStatus();
                  if (paymentReceived) {
                    clearInterval(pollingInterval);
                  }
                }, 5000); // Check every 5 seconds
              });
              
              console.log('Payment verification components initialized');
            }
          }
        }, 300); // Short delay to ensure dialog is rendered
        
        // Add an event listener to clean up the interval when the dialog is closed
        document.addEventListener('dialog-closed', function dialogClosedHandler() {
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
          document.removeEventListener('dialog-closed', dialogClosedHandler);
        }, { once: true });
      }
    } catch (error) {
      console.error('Registration error:', error);
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
      
      // Show error message
      alert('Registration failed: ' + (error.message || 'Unable to create subscription'));
    }
  });
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
    
    // Create subscription API
    const subscriptionApi = {
      /**
       * Check subscription status
       * @param {string} email - User email
       * @returns {Promise<Object>} - Subscription status
       */
      async checkSubscriptionStatus(email) {
        const response = await fetch(`/api/1/subscriptions/status?email=${encodeURIComponent(email)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to check subscription status');
        }
        
        return await response.json();
      },
      
      /**
       * Create subscription
       * @param {string} email - User email
       * @param {string} plan - Subscription plan
       * @param {string} paymentMethod - Payment method
       * @returns {Promise<Object>} - Subscription result
       */
      async createSubscription(email, plan, paymentMethod) {
        const response = await fetch('/api/1/subscriptions/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
          },
          body: JSON.stringify({
            email,
            plan,
            payment_method: paymentMethod
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to create subscription');
        }
        
        return await response.json();
      }
    };
    
    // Create AuthClient
    return new AuthClient({
      supabaseUrl,
      supabaseKey: supabaseAnonKey,
      jwtSecret,
      subscriptionApi,
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