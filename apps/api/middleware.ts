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

// /v1 paths that don't require a session: health check, sign-up, and the GitHub
// OAuth dance (which manages its own auth and must not be 401'd mid-redirect).
const PUBLIC_V1_PREFIXES = ['/v1/healthz', '/v1/auth', '/v1/integrations/github'];

function requiresAuth(pathname: string): boolean {
  if (!pathname.startsWith('/v1')) return false;
  return !PUBLIC_V1_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isAllowed = allowedOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Gate protected /v1 routes: no session cookie → a clean 401 instead of the
  // 500 that getCurrentUserId() would otherwise throw. Presence-only check, so a
  // valid session is never rejected (the route still validates the token).
  if (requiresAuth(request.nextUrl.pathname)) {
    const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
