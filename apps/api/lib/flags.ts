import { initialize, isEnabled, type Unleash } from 'unleash-client';

// Feature flags via Unleash. This module is deliberately safe-by-default so it never
// breaks the two very different ways Baseline runs:
//
//   • Open-source self-host (no Unleash) — there's no flag service, so flags fall back
//     to env defaults and everything keeps working as before.
//   • The hosted instance (Unleash configured) — flags are governed by Unleash, and if
//     the flag service is unreachable or hasn't synced yet, security-sensitive gates
//     fail CLOSED rather than open.

const PUBLIC_SIGNUP = 'public-signup';

const UNLEASH_URL = process.env.UNLEASH_URL;
const UNLEASH_API_TOKEN = process.env.UNLEASH_API_TOKEN;
const APP_NAME = process.env.UNLEASH_APP_NAME || 'baseline-api';
// Governs public sign-up ONLY when Unleash isn't configured (self-host). Defaults to
// open, preserving the out-of-the-box self-host experience; set to 'false' to close
// sign-ups without running a flag service.
const SIGNUP_DEFAULT = process.env.SIGNUP_ENABLED_DEFAULT !== 'false';

let client: Unleash | null = null;

// Start the Unleash client (non-blocking). A no-op when Unleash isn't configured or
// already started, so it's safe to call from startup and idempotent.
export function initFlags(): void {
  if (client || !UNLEASH_URL || !UNLEASH_API_TOKEN) return;
  client = initialize({
    url: UNLEASH_URL,
    appName: APP_NAME,
    customHeaders: { Authorization: UNLEASH_API_TOKEN },
    refreshInterval: 15_000,
  });
  // The client is an EventEmitter — an unhandled 'error' would crash the process. Log
  // and carry on; gates fall back to their safe default until the client syncs.
  client.on('error', (e: unknown) => console.error('unleash error:', e instanceof Error ? e.message : e));
}

// Is public, self-service sign-up currently allowed?
//   • Unleash not configured → SIGNUP_ENABLED_DEFAULT (default true) — self-host stays open.
//   • Unleash configured      → the `public-signup` flag; fail CLOSED until the client has
//     synced, so an outage or cold start can never accidentally open sign-ups.
export function isSignupEnabled(): boolean {
  if (!client) return SIGNUP_DEFAULT;
  return isEnabled(PUBLIC_SIGNUP, {}, false);
}
