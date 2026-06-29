import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthorizationUrl } from '@baseline/integrations-google-calendar';
import { getCurrentUserId } from '../../../../../lib/user';
import { resolvePublicOrigin } from '../../../../../lib/origin';

export async function GET() {
  await getCurrentUserId();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured', code: 'NOT_CONFIGURED' },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  // Google redirects the user's browser here, so this must be the public origin
  // the browser used — not the internal API URL.
  const redirectUri = `${await resolvePublicOrigin()}/v1/integrations/google/callback`;

  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = buildAuthorizationUrl(clientId, redirectUri, state);
  return NextResponse.redirect(url);
}
