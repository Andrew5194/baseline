import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthorizationUrl } from '@baseline/integrations-github';
import { getCurrentUserId } from '../../../../../lib/user';

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
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/v1/integrations/github/callback`;

  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = buildAuthorizationUrl(clientId, redirectUri, state);
  return NextResponse.redirect(url);
}
