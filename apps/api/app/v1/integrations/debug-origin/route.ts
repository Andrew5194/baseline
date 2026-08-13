import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { resolvePublicOrigin } from '../../../../lib/origin';

/**
 * TEMPORARY — diagnosing redirect_uri_mismatch. Delete once OAuth connects.
 *
 * Reports the origin this API resolves for OAuth redirects, which is the value
 * that has to match the OAuth client's registered redirect URIs exactly. Sits
 * under /v1/integrations/ deliberately: that is the prefix the web proxy injects
 * x-public-origin for, so this exercises the same path the real flow does.
 *
 * Unauthenticated, and returns nothing the caller's own browser doesn't already
 * know — but it should not outlive the bug.
 */
export async function GET() {
  const h = await headers();
  const origin = await resolvePublicOrigin();

  return NextResponse.json({
    resolved_origin: origin,
    register_these_exactly: [
      `${origin}/v1/integrations/google-books/callback`,
      `${origin}/v1/integrations/google/callback`,
      `${origin}/v1/integrations/github/callback`,
    ],
    how_it_was_resolved: process.env.WEB_URL
      ? 'WEB_URL env var'
      : h.get('x-public-origin')
        ? 'x-public-origin injected by the web proxy'
        : 'dev fallback (http://localhost:3002) — the proxy did not inject a header',
    seen_headers: {
      'x-public-origin': h.get('x-public-origin'),
      'x-forwarded-host': h.get('x-forwarded-host'),
      'x-forwarded-proto': h.get('x-forwarded-proto'),
      host: h.get('host'),
    },
    web_url_env: process.env.WEB_URL ?? null,
  });
}
