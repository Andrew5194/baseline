import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db, integrations } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { exchangeCodeForToken, fetchGoogleUser } from '@baseline/integrations-google-books';
import { getCurrentUserId } from '../../../../../lib/user';
import { resolvePublicOrigin } from '../../../../../lib/origin';

const PROVIDER = 'google_books';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const webUrl = await resolvePublicOrigin();

  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_books_oauth_state')?.value;
  cookieStore.delete('google_books_oauth_state');

  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.redirect(`${webUrl}/sign-in?error=not_signed_in`);
  }

  const gError = searchParams.get('error');
  if (gError) {
    return NextResponse.redirect(`${webUrl}/sources?error=${encodeURIComponent(gError)}`);
  }

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${webUrl}/sources?error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${webUrl}/v1/integrations/google-books/callback`;

  try {
    const tokenData = await exchangeCodeForToken(clientId, clientSecret, code, redirectUri);
    const googleUser = await fetchGoogleUser(tokenData.access_token);
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, PROVIDER)));

    if (existing) {
      await db
        .update(integrations)
        .set({
          status: 'connected',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? existing.refreshToken,
          tokenExpiresAt,
          externalAccountId: googleUser.email,
          connectedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        userId,
        provider: PROVIDER,
        status: 'connected',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt,
        externalAccountId: googleUser.email,
      });
    }

    return NextResponse.redirect(`${webUrl}/sources?success=google_books`);
  } catch (err) {
    console.error('Google Books OAuth callback error:', err);
    return NextResponse.redirect(`${webUrl}/sources?error=oauth_failed`);
  }
}
