/**
 * Google OAuth 2.0 Authentication Service
 * Handles Google account connection and token management
 * 
 * Setup Instructions:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing one
 * 3. Enable "Google Calendar API" in APIs & Services
 * 4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
 * 5. Choose "Web application"
 * 6. Add authorized JavaScript origins:
 *    - http://localhost:5173 (or your dev port)
 *    - Your production URL
 * 7. Add authorized redirect URIs:
 *    - http://localhost:5173 (or your dev port)
 *    - Your production URL
 * 8. Copy the Client ID and add to .env: VITE_GOOGLE_CLIENT_ID=your_client_id
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events';

let gapiLoaded = false;
let tokenClient = null;

/**
 * Load Google API script
 */
export function loadGoogleAPI() {
  return new Promise((resolve, reject) => {
    if (window.gapi) {
      gapiLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      gapi.load('client', () => {
        gapiLoaded = true;
        resolve();
      });
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Load Google Identity Services (for OAuth)
 */
export function loadGoogleIdentityServices() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Initialize Google API client
 */
export async function initializeGoogleAPI() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID not set in environment variables');
  }

  await loadGoogleAPI();
  await loadGoogleIdentityServices();

  await gapi.client.init({
    apiKey: import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY, // Optional, for public calendar access
    discoveryDocs: GOOGLE_DISCOVERY_DOCS,
  });

  // Initialize token client for OAuth
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (tokenResponse) => {
      // Token response is handled in the promise-based flow
    },
  });
}

/**
 * Check if user is signed in
 */
export function isSignedIn() {
  return gapi?.client?.getToken() !== null;
}

/**
 * Get current access token
 */
export function getAccessToken() {
  const token = gapi?.client?.getToken();
  return token?.access_token || null;
}

/**
 * Sign in to Google account
 */
export async function signIn() {
  if (!gapiLoaded || !tokenClient) {
    await initializeGoogleAPI();
  }

  return new Promise((resolve, reject) => {
    let timeoutId;
    
    // Set a timeout to detect if popup is blocked or user takes too long
    timeoutId = setTimeout(() => {
      reject(new Error('Connection timeout. Please check if popup blockers are enabled and allow popups for this site.'));
    }, 60000); // 60 second timeout

    tokenClient.callback = (response) => {
      clearTimeout(timeoutId);
      
      if (response.error) {
        let errorMessage = response.error;
        
        // Provide user-friendly error messages
        if (response.error === 'popup_closed_by_user') {
          errorMessage = 'The sign-in window was closed. Please try again and complete the sign-in process.';
        } else if (response.error === 'popup_blocked') {
          errorMessage = 'Popup was blocked by your browser. Please allow popups for this site and try again.';
        } else if (response.error === 'access_denied') {
          errorMessage = 'Access was denied. Please grant calendar permissions to use this feature.';
        } else if (response.error === 'invalid_client') {
          errorMessage = 'Invalid Google OAuth configuration. Please check your VITE_GOOGLE_CLIENT_ID in .env file.';
        }
        
        reject(new Error(errorMessage));
        return;
      }
      
      if (!response.access_token) {
        reject(new Error('No access token received. Please try again.'));
        return;
      }
      
      gapi.client.setToken(response);
      resolve(response);
    };

    try {
      if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to start sign-in process: ${error.message}`));
    }
  });
}

/**
 * Sign out from Google account
 */
export async function signOut() {
  const token = gapi?.client?.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
}

/**
 * Get user's email (if available)
 */
export async function getUserEmail() {
  try {
    const response = await gapi.client.oauth2.userinfo.get();
    return response.result.email;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}

