import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthorizationUrl } from '@baseline/integrations-github';
import { getCurrentUserId } from '../../../../../lib/user';
import { resolvePublicOrigin } from '../../../../../lib/origin';

export async function GET() {
  await getCurrentUserId();

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured', code: 'NOT_CONFIGURED' },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  // GitHub redirects the user's browser here, so this must be the public origin
  // the browser used — not the internal API URL (unreachable behind the proxy).
  const redirectUri = `${await resolvePublicOrigin()}/v1/integrations/github/callback`;

  const cookieStore = await cookies();
  // Non-Secure for the same reason as the session cookie (see auth.ts): must
  // survive plain-HTTP localhost. The callback consumes it.
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = buildAuthorizationUrl(clientId, redirectUri, state);
  return NextResponse.redirect(url);
}
