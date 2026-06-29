const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Read-only calendar access, plus basic identity so we can label the connection.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
];

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number; // seconds until the access token expires
  refresh_token?: string; // only returned on the first consent (prompt=consent)
  scope: string;
  token_type: string;
  id_token?: string;
}

// access_type=offline + prompt=consent ensures Google returns a refresh token so
// the connection survives the ~1h access-token lifetime.
export function buildAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Exchange a stored refresh token for a fresh access token. Google does NOT return
// a new refresh token here — keep the existing one.
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  // A revoked/expired refresh token returns 400/401 → treat as needing reconnect.
  if (res.status === 400 || res.status === 401) {
    throw new Error('GOOGLE_TOKEN_INVALID');
  }
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchGoogleUser(
  accessToken: string,
): Promise<{ email: string; name: string | null }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google user fetch failed: ${res.status}`);
  }
  const d = await res.json();
  return { email: d.email, name: d.name ?? null };
}
