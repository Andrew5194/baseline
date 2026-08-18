import { headers } from 'next/headers';
import { auth } from './auth';
import { db, users } from '@baseline/db';
import { eq } from 'drizzle-orm';
import { bearer, verifyServiceAssertion } from './service-auth';

export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  // The Pro service reading a user's own data back out of core on their behalf.
  // Restricted to GET in middleware, so this can only ever read.
  const secret = process.env.PRO_SERVICE_SECRET;
  if (secret) {
    const token = bearer((await headers()).get('authorization'));
    if (token) {
      // A bad token here is a hard failure, not a fallthrough to dev auto-login.
      return verifyServiceAssertion(token, secret, 'core').userId;
    }
  }

  if (
    process.env.NODE_ENV === 'development' &&
    process.env.BASELINE_DEV_AUTO_LOGIN === 'true' &&
    process.env.DATABASE_URL?.includes('localhost')
  ) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'dev@baseline.local'))
      .limit(1);
    if (user) {
      console.warn(
        '[auth] ⚠️  dev auto-login active — request resolved to dev@baseline.local. ' +
          'Unset BASELINE_DEV_AUTO_LOGIN to disable.',
      );
      return user.id;
    }
  }

  throw new Error('Unauthorized');
}

// The user's IANA timezone, used to bucket activity into local calendar days.
// Falls back to UTC if unset.
export async function getUserTimezone(userId: string): Promise<string> {
  const [u] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u?.timezone || 'UTC';
}

// Timezone + account-creation time in one row read, for callers that need both and
// shouldn't issue two queries for the same row (e.g. the baseline overview).
export async function getUser(userId: string): Promise<{ timezone: string; createdAt: Date } | null> {
  const [u] = await db
    .select({ timezone: users.timezone, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}
