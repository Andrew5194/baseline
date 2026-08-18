import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Only used in the optional separate-origin mode (NEXT_PUBLIC_API_URL set). The
// default single-origin setup proxies server-side, so no preflight reaches here.
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  process.env.WEB_URL,
].filter(Boolean);

// Session cookie names (the non-Secure pinned name + its Secure variant).
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

// /v1 paths that don't require a session: health check, sign-up, the GitHub OAuth
// dance (which manages its own auth and must not be 401'd mid-redirect), and the
// internal cron endpoint (guarded by CRON_SECRET + Cloud Run IAM, not a cookie).
const PUBLIC_V1_PREFIXES = ['/v1/healthz', '/v1/auth', '/v1/integrations/github', '/v1/internal'];

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * A Pro-service assertion, verified with Web Crypto because middleware runs on the
 * Edge runtime and node:crypto is unavailable there. The route verifies it again
 * before trusting it — this is only the gate that turns a bad token into a clean
 * 401 instead of a 500 thrown deep inside a handler.
 */
async function validServiceAssertion(token: string, secret: string): Promise<boolean> {
  const [body, mac] = token.split('.');
  if (!body || !mac) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify('HMAC', key, fromB64url(mac), new TextEncoder().encode(body));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    return payload.aud === 'core' && typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function requiresAuth(pathname: string): boolean {
  if (!pathname.startsWith('/v1')) return false;
  return !PUBLIC_V1_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isAllowed = allowedOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Auth-Return-Redirect',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Gate protected /v1 routes: no session cookie → a clean 401 instead of the
  // 500 that getCurrentUserId() would otherwise throw. Presence-only check, so a
  // valid session is never rejected (the route still validates the token).
  if (requiresAuth(request.nextUrl.pathname)) {
    let hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));

    // The Pro service acts for a user with a signed assertion instead of a cookie.
    // Reads only: either a GET, or the MCP endpoint, whose transport is POST but
    // whose tools are all read handlers. No other write path accepts an assertion.
    const isMcp = request.nextUrl.pathname === '/v1/mcp';
    const readOnly = request.method === 'GET' || (isMcp && request.method === 'POST');
    const auth = request.headers.get('authorization');
    const secret = process.env.PRO_SERVICE_SECRET;
    if (!hasSession && readOnly && auth?.startsWith('Bearer ') && secret) {
      hasSession = await validServiceAssertion(auth.slice(7).trim(), secret);
    }

    if (!hasSession) {
      const res = NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      if (isAllowed) {
        res.headers.set('Access-Control-Allow-Origin', origin);
        res.headers.set('Access-Control-Allow-Credentials', 'true');
      }
      return res;
    }
  }

  const response = NextResponse.next();
  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
}

export const config = {
  // The middleware only gates the /v1 API (auth presence + CORS) and the Auth.js
  // endpoints — so only run it there, instead of on every request (assets, RSC
  // payloads, error pages), which needlessly invokes the Edge runtime per request.
  matcher: ['/v1/:path*', '/api/:path*'],
};
