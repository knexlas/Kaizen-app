const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

let msalInstance = null;

/**
 * Get MSAL client ID from environment variables
 */
function getClientId() {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_MS_CLIENT_ID;
}

/**
 * Get redirect URI (must match Azure app registration exactly; use origin only for SPA)
 */
function getRedirectUri() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5173';
}

/**
 * Initialize MSAL PublicClientApplication instance
 * Uses dynamic import to avoid requiring msal-browser if user doesn't use Outlook sync
 */
async function getMsalInstance() {
  if (msalInstance) return msalInstance;

  const clientId = getClientId();
  if (!clientId) {
    const uri = getRedirectUri();
    throw new Error(
      'OUTLOOK_SETUP: Add VITE_MS_CLIENT_ID to your .env file. ' +
      'Then in Azure Portal (portal.azure.com) → App registrations → Your app → Authentication, ' +
      'add a SPA redirect URI: ' + uri
    );
  }

  try {
    const msalModule = await import(/* @vite-ignore */ '@azure/msal-browser');
    const { PublicClientApplication } = msalModule;

    const redirectUri = getRedirectUri();
    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: redirectUri,
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
      },
    };

    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
    return msalInstance;
  } catch (err) {
    console.error('Failed to initialize MSAL:', err);
    if (err?.message?.includes('VITE_MS_CLIENT_ID') || err?.message?.includes('OUTLOOK_SETUP')) throw err;
    throw new Error('Failed to load Microsoft sign-in. If the popup was blocked, allow popups and try again.');
  }
}

/**
 * Login with Microsoft using popup flow
 * Requests User.Read (profile) + Calendars.ReadWrite for Graph API
 * @returns {Promise<{accessToken: string, account: object}>}
 */
export async function loginWithMicrosoft() {
  const clientId = getClientId();
  if (!clientId) {
    const uri = getRedirectUri();
    throw new Error(
      'OUTLOOK_SETUP: Add VITE_MS_CLIENT_ID to .env. In Azure Portal → App registrations → Your app → Authentication, add SPA redirect URI: ' + uri
    );
  }

  try {
    const msal = await getMsalInstance();
    // User.Read is often required for login; Calendars.ReadWrite for calendar API
    const loginRequest = {
      scopes: ['User.Read', 'Calendars.ReadWrite'],
      prompt: 'select_account',
    };

    const response = await msal.loginPopup(loginRequest);

    if (response && response.accessToken) {
      return {
        accessToken: response.accessToken,
        account: response.account,
      };
    }

    throw new Error('Microsoft sign-in did not return a token. Try again.');
  } catch (err) {
    console.error('Microsoft login error:', err);
    const msg = err?.message || String(err);
    if (msg.includes('popup') || msg.includes('blocked') || msg.includes('Popup')) {
      throw new Error('Sign-in popup was blocked. Please allow popups for this site and try again.');
    }
    if (msg.includes('AADSTS50011') || msg.includes('redirect_uri')) {
      throw new Error(
        'Redirect URI mismatch. In Azure Portal → Your app → Authentication, add this exact SPA redirect URI: ' + getRedirectUri()
      );
    }
    if (msg.includes('OUTLOOK_SETUP') || msg.includes('VITE_MS_CLIENT_ID')) throw err;
    throw new Error(msg || 'Outlook sign-in failed. Check the console for details.');
  }
}

/**
 * Logout from Microsoft account (no-op if not configured or no accounts)
 */
export async function logoutMicrosoft() {
  if (!getClientId()) {
    msalInstance = null;
    return;
  }
  try {
    const msal = await getMsalInstance();
    const accounts = msal.getAllAccounts();
    if (accounts.length > 0) {
      await msal.logoutPopup({ account: accounts[0] });
    }
  } catch (err) {
    console.warn('Microsoft logout:', err?.message || err);
  } finally {
    msalInstance = null;
  }
}

/**
 * Get access token silently if user is already logged in
 * @returns {Promise<string|null>}
 */
export async function getAccessTokenSilently() {
  try {
    const msal = await getMsalInstance();
    const accounts = msal.getAllAccounts();
    
    if (accounts.length === 0) {
      return null;
    }

    const silentRequest = {
      scopes: ['User.Read', 'Calendars.ReadWrite'],
      account: accounts[0],
    };

    const response = await msal.acquireTokenSilent(silentRequest);
    return response?.accessToken || null;
  } catch (err) {
    // If silent token acquisition fails, user needs to login again
    return null;
  }
}

/**
 * Fetch Outlook events from Microsoft Graph calendarview endpoint
 * Maps events to Garden Weather format: { id, title, start, end, type ('storm'|'leaf'|'sun'), source: 'outlook' }
 * @param {string} accessToken - Microsoft Graph access token
 * @param {Date} timeMin - Start time for event range
 * @param {Date} timeMax - End time for event range
 * @returns {Promise<Array>} Array of events in Garden Weather format
 */
export async function fetchOutlookEvents(accessToken, timeMin, timeMax) {
  if (!accessToken) throw new Error('No access token');

  const url = new URL(GRAPH_API_BASE + '/me/calendarview');
  url.searchParams.append('startDateTime', timeMin.toISOString());
  url.searchParams.append('endDateTime', timeMax.toISOString());
  url.searchParams.append('$orderby', 'start/dateTime');
  url.searchParams.append('$select', 'id,subject,start,end');

  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Failed to fetch Outlook events: ' + response.status + ' ' + errorText);
  }

  const data = await response.json();
  
  // Map Microsoft Graph events to Garden Weather format
  return (data.value || []).map(event => {
    const title = event.subject || 'Busy';
    // Simple logic to guess weather type based on keywords (same as Google Calendar)
    let type = 'leaf';
    if (title.match(/deadline|urgent|review|meeting/i)) type = 'storm';
    if (title.match(/lunch|gym|break|coffee/i)) type = 'sun';

    return {
      id: event.id,
      title: title,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      type: type, // 'storm', 'leaf', 'sun'
      source: 'outlook'
    };
  });
}

/**
 * Create a new event in Outlook calendar via Microsoft Graph
 * @param {string} accessToken - Microsoft Graph access token
 * @param {object} eventDetails - Event details with title, startTime, endTime (ISO strings)
 * @returns {Promise<object>} Created event object from Microsoft Graph
 */
export async function createOutlookEvent(accessToken, eventDetails) {
  if (!accessToken) throw new Error('No access token');

  const event = {
    subject: eventDetails.title,
    body: {
      contentType: 'HTML',
      content: 'Planted in Kaizen Garden 🌱',
    },
    start: {
      dateTime: eventDetails.startTime, // ISO String
      timeZone: 'UTC',
    },
    end: {
      dateTime: eventDetails.endTime, // ISO String
      timeZone: 'UTC',
    },
  };

  const response = await fetch(GRAPH_API_BASE + '/me/events', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Failed to create Outlook event: ' + response.status + ' ' + errorText);
  }

  return await response.json();
}
