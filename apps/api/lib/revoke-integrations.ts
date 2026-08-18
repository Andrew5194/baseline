import { revokeGoogleToken } from '@baseline/integrations-google-calendar';
import { revokeGitHubGrant } from '@baseline/integrations-github';

// Every Google source is one OAuth client, and consent is extended rather than
// duplicated (include_granted_scopes), so they share a single grant. Revoking any of
// them revokes all of them — callers disconnecting one source must check none of the
// others is still connected before asking for a revoke.
const GOOGLE_PROVIDERS = new Set(['google_calendar', 'google_books']);

export function isGoogleProvider(provider: string): boolean {
  return GOOGLE_PROVIDERS.has(provider);
}

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
        if (GOOGLE_PROVIDERS.has(r.provider)) {
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
