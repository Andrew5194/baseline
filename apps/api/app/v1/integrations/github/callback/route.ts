import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db, integrations } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { exchangeCodeForToken, fetchGitHubUser } from '@baseline/integrations-github';
import { getCurrentUserId } from '../../../../../lib/user';

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const webUrl = process.env.WEB_URL || 'http://localhost:3002';

  const cookieStore = await cookies();
  const storedState = cookieStore.get('github_oauth_state')?.value;
  cookieStore.delete('github_oauth_state');

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${webUrl}/sources?error=invalid_state`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;

  try {
    const tokenData = await exchangeCodeForToken(clientId, clientSecret, code);
    const githubUser = await fetchGitHubUser(tokenData.access_token);

    // Upsert: update existing or insert new
    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, 'github')));

    if (existing) {
      await db
        .update(integrations)
        .set({
          status: 'connected',
          accessToken: tokenData.access_token,
          externalAccountId: githubUser.login,
          connectedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        userId,
        provider: 'github',
        status: 'connected',
        accessToken: tokenData.access_token,
        externalAccountId: githubUser.login,
      });
    }

    return NextResponse.redirect(`${webUrl}/sources?success=github`);
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    return NextResponse.redirect(`${webUrl}/sources?error=oauth_failed`);
  }
}
