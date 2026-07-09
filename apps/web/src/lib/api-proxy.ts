// Same-origin BFF proxy: forwards /api/auth/* and /v1/* to the API server-side so
// the browser only ever talks to the web origin (cookies/CSRF stay same-origin, no
// CORS). Lives in a Node.js route handler — NOT next.config rewrites or middleware —
// because only the Node runtime reads process.env.API_INTERNAL_URL at RUNTIME (both
// build-time rewrites and Edge middleware freeze it at build time).

function apiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:3001' : 'http://localhost:3001')
  );
}

function normProto(v: string | null): string | undefined {
  const s = v?.split(',')[0].trim().toLowerCase();
  return s === 'http' || s === 'https' ? s : undefined;
}

// The scheme/host the browser actually used, from the proxy headers (the internal
// fetch to the API would otherwise drop them). Mirrors the old middleware logic.
function detectScheme(h: Headers): string {
  const xfProto = normProto(h.get('x-forwarded-proto'));
  if (xfProto) return xfProto;
  const fwdProto = h.get('forwarded')?.match(/proto=("?)(https?)\1/i)?.[2];
  if (fwdProto) return fwdProto.toLowerCase();
  const xfScheme = normProto(h.get('x-forwarded-scheme'));
  if (xfScheme) return xfScheme;
  if (h.get('x-forwarded-ssl')?.trim().toLowerCase() === 'on') return 'https';
  for (const name of ['origin', 'referer']) {
    const raw = h.get(name);
    if (raw) {
      try {
        const p = new URL(raw).protocol.replace(':', '');
        if (p === 'http' || p === 'https') return p;
      } catch {
        /* malformed */
      }
    }
  }
  return 'https';
}

function detectHost(h: Headers): string {
  const xfHost = h.get('x-forwarded-host')?.split(',')[0].trim();
  if (xfHost) return xfHost;
  const fwdHost = h.get('forwarded')?.match(/host=("?)([^;",\s]+)\1/i)?.[2];
  if (fwdHost) return fwdHost;
  return h.get('host') || '';
}

export async function proxyToApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = apiBase() + url.pathname + url.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length'); // fetch recomputes from the body

  // Preserve the browser-facing origin so the API (behind AUTH_TRUST_HOST) builds
  // correct absolute URLs for Auth.js and OAuth redirects.
  const scheme = detectScheme(request.headers);
  const host = detectHost(request.headers);
  if (host) {
    headers.set('x-forwarded-host', host);
    headers.set('x-forwarded-proto', scheme);
    if (
      url.pathname.startsWith('/v1/integrations/github/') ||
      url.pathname.startsWith('/v1/integrations/google/')
    ) {
      headers.set('x-public-origin', `${scheme}://${host}`);
    }
  }

  const method = request.method;
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, { method, headers, body, redirect: 'manual' });

  // Rebuild response headers, dropping hop-by-hop/encoding ones (fetch already
  // decoded the body) and forwarding every Set-Cookie individually.
  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (
      k === 'set-cookie' ||
      k === 'content-encoding' ||
      k === 'content-length' ||
      k === 'transfer-encoding'
    ) {
      return;
    }
    respHeaders.append(key, value);
  });
  const setCookies =
    (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const cookie of setCookies) respHeaders.append('set-cookie', cookie);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}
