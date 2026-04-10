// Google Calendar client-side integration using Google Identity Services (GIS).
//
// SETUP: Create an OAuth 2.0 Client ID (type: Web application) in Google Cloud Console,
// add http://localhost:3000 to Authorized JavaScript origins, then set your client ID
// via NEXT_PUBLIC_GOOGLE_CLIENT_ID env var or paste it directly below.
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient = null;
let accessToken = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function initGoogleAuth() {
  await loadScript('https://accounts.google.com/gsi/client');
  if (!window.google || !window.google.accounts) {
    throw new Error('Google Identity Services failed to load');
  }
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // set per request
    });
  }
}

export function requestAccessToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Auth not initialized'));
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

export async function fetchUpcomingEvents() {
  if (!accessToken) throw new Error('Not authenticated');
  const now = new Date().toISOString();
  const url =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
    `?timeMin=${encodeURIComponent(now)}` +
    '&maxResults=25&singleEvents=true&orderBy=startTime';

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || null,
  }));
}
