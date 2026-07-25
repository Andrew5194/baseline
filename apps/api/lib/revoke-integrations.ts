import { revokeGoogleToken } from '@baseline/integrations-google-calendar';
import { revokeGitHubGrant } from '@baseline/integrations-github';

interface IntegrationTokens {
  provider: string;
  accessToken: string | null;
  refreshToken: string | null;
}

// Best-effort: revoke the app's OAuth grant with each provider so Baseline drops out of
// the user's authorized-apps list. Never throws — a failed or already-expired revoke must
// not block the caller (account deletion or disconnect). Runs all providers in parallel.
export async function revokeIntegrations(rows: IntegrationTokens[]): Promise<void> {
  await Promise.allSettled(
    rows.map(async (r) => {
      try {
        if (r.provider === 'google_calendar') {
          const token = r.refreshToken || r.accessToken; // refresh token revokes the whole grant
          if (token) await revokeGoogleToken(token);
        } else if (r.provider === 'github') {
          const clientId = process.env.GITHUB_CLIENT_ID;
          const clientSecret = process.env.GITHUB_CLIENT_SECRET;
          if (r.accessToken && clientId && clientSecret) {
            await revokeGitHubGrant(clientId, clientSecret, r.accessToken);
          }
        }
      } catch {
        /* best-effort — provider errors / expired tokens are non-fatal */
      }
    }),
  );
}
