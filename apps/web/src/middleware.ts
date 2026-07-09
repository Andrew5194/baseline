import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const publicPaths = ['/sign-in', '/sign-up'];

// Where to forward same-origin API/auth traffic. Read per-request so one image
// works in any environment (Docker network, Cloud Run, …) via the runtime
// API_INTERNAL_URL — the destination is NOT baked at build time.
function apiInternalUrl(): string {
  return (
    process.env.API_INTERNAL_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:3001' : 'http://localhost:3001')
  );
}

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

  // Same-origin proxy: forward /api/auth/* and /v1/* to the API server-side at
  // runtime (keeps cookies/CSRF same-origin, no CORS). Done here rather than via
  // next.config rewrites so the target honors the runtime API_INTERNAL_URL.
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/v1/')) {
    const target = new URL(apiInternalUrl());
    const url = request.nextUrl.clone();
    url.protocol = target.protocol;
    url.hostname = target.hostname;
    url.port = target.port;

    // OAuth paths: hand the API the browser-reachable origin (it can't see the
    // forwarded headers behind the rewrite) so redirects stay correct.
    if (
      pathname.startsWith('/v1/integrations/github/') ||
      pathname.startsWith('/v1/integrations/google/')
    ) {
      const headers = new Headers(request.headers);
      headers.set('x-public-origin', publicOrigin(request));
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return NextResponse.rewrite(url);
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
  // Page navigations hit the auth gate; /api/auth/* and /v1/* hit the runtime
  // proxy above (the API does its own auth). The `.*\\.` clause excludes any
  // static asset with a file extension (icon.svg, favicon.ico, …) so they aren't
  // redirected to /sign-in.
  matcher: [
    '/((?!_next/static|_next/image|api/auth|v1|.*\\.).*)',
    '/api/auth/:path*',
    '/v1/:path*',
  ],
};
