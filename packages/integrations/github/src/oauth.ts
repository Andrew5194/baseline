// Revoke the app's entire OAuth grant for a user (DELETE .../grant), removing it from
// their authorized-apps list and invalidating all tokens. Authenticated with the app's
// client_id:client_secret. Best-effort — an already-revoked grant returns 404.
export async function revokeGitHubGrant(
  clientId: string,
  clientSecret: string,
  accessToken: string,
): Promise<void> {
  // btoa (not Buffer) so this package type-checks without @types/node; client
  // id/secret are ASCII, so Latin1 base64 is correct.
  const basic = btoa(`${clientId}:${clientSecret}`);
  await fetch(`https://api.github.com/applications/${clientId}/grant`, {
    method: 'DELETE',
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ access_token: accessToken }),
  });
}

export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user repo',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<{ access_token: string; token_type: string; scope: string }> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data;
}

export async function fetchGitHubUser(
  accessToken: string,
): Promise<{ login: string; avatar_url: string; name: string | null }> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub user fetch failed: ${res.status}`);
  }

  return res.json();
}
