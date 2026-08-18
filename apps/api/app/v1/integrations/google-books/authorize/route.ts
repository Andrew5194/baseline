import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthorizationUrl } from '@baseline/integrations-google-books';
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
  const redirectUri = `${await resolvePublicOrigin()}/v1/integrations/google-books/callback`;

  const cookieStore = await cookies();
  // Distinct from the Calendar state cookie so connecting one cannot clobber a
  // consent flow already in progress for the other.
  cookieStore.set('google_books_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = buildAuthorizationUrl(clientId, redirectUri, state);
  return NextResponse.redirect(url);
}
