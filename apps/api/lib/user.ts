import { auth } from './auth';
import { db, users } from '@baseline/db';
import { eq } from 'drizzle-orm';

export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
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
