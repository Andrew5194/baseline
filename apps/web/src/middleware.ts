import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const publicPaths = ['/sign-in', '/sign-up'];

// The scheme the browser actually used, from real evidence — most authoritative first.
function detectScheme(request: NextRequest): string {
  const norm = (v?: string | null) => {
    const s = v?.split(',')[0].trim().toLowerCase();
    return s === 'http' || s === 'https' ? s : undefined;
  };

  const xfProto = norm(request.headers.get('x-forwarded-proto'));
  if (xfProto) return xfProto;

  const fwdProto = request.headers.get('forwarded')?.match(/proto=("?)(https?)\1/i)?.[2];
  if (fwdProto) return fwdProto.toLowerCase();

  const xfScheme = norm(request.headers.get('x-forwarded-scheme'));
  if (xfScheme) return xfScheme;
  if (request.headers.get('x-forwarded-ssl')?.trim().toLowerCase() === 'on') return 'https';

  for (const name of ['origin', 'referer']) {
    const raw = request.headers.get(name);
    if (raw) {
      try {
        const p = new URL(raw).protocol.replace(':', '');
        if (p === 'http' || p === 'https') return p;
      } catch {
        /* malformed */
      }
    }
  }

  return request.nextUrl.protocol.replace(':', '');
}

function detectHost(request: NextRequest): string {
  const xfHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  if (xfHost) return xfHost;
  const fwdHost = request.headers.get('forwarded')?.match(/host=("?)([^;",\s]+)\1/i)?.[2];
  if (fwdHost) return fwdHost;
  return request.headers.get('host') || request.nextUrl.host;
}

// Browser-reachable origin from the proxy headers, seen first-hand here (the
// internal rewrite to the API can drop them). Works for the proxy and localhost.
function publicOrigin(request: NextRequest): string {
  return `${detectScheme(request)}://${detectHost(request)}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Hand the API the resolved origin (it can't see forwarded headers behind the
  // rewrite) so its GitHub OAuth redirects stay browser-reachable. Authorize + callback.
  if (pathname.startsWith('/v1/integrations/github/')) {
    const headers = new Headers(request.headers);
    headers.set('x-public-origin', publicOrigin(request));
    return NextResponse.next({ request: { headers } });
  }

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Fixed name pinned by the API (authConfig.cookies); reads identically on
  // localhost and the proxy.
  const cookieName = 'authjs.session-token';

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: false,
    cookieName,
    salt: cookieName,
  });

  if (!token) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Gate page navigations only — /api/auth/* and /v1/* are proxied to the API,
  // which does its own auth. The github paths re-enter solely for header injection.
  // The `.*\\.` clause excludes any static asset with a file extension (icon.svg,
  // baseline-logo.svg, favicon.ico, …) so they aren't redirected to /sign-in.
  matcher: [
    '/((?!_next/static|_next/image|api/auth|v1|.*\\.).*)',
    '/v1/integrations/github/:path*',
  ],
};
