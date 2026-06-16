import { headers } from 'next/headers';

const DEV_ORIGIN = 'http://localhost:3002';

/**
 * Public, browser-reachable origin for building OAuth redirect URLs — no per-env
 * hardcoding. Precedence:
 *  1. `WEB_URL` — operator override; must match the registered OAuth callback URL.
 *  2. `x-public-origin` — injected by the web middleware (see middleware.ts).
 *  3. `DEV_ORIGIN` — local default.
 *
 * @returns An origin like `https://host` (no trailing slash).
 * @remarks Trusts only `x-public-origin`, never raw `X-Forwarded-*`/`Origin` — those
 * are spoofable, and the API is only reachable via the web rewrite anyway.
 */
export async function resolvePublicOrigin(): Promise<string> {
  const strip = (s: string) => s.replace(/\/$/, '');

  if (process.env.WEB_URL) return strip(process.env.WEB_URL);

  const injected = (await headers()).get('x-public-origin');
  if (injected) return strip(injected);

  return DEV_ORIGIN;
}
