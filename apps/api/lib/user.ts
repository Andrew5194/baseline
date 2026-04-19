import { auth } from './auth';
import { db, users } from '@baseline/db';
import { eq } from 'drizzle-orm';

export async function getCurrentUserId(): Promise<string> {
  // Try real auth session first
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  // Dev fallback: use seed user
  if (process.env.NODE_ENV === 'development') {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'dev@baseline.local'))
      .limit(1);
    if (user) return user.id;
  }

  throw new Error('Unauthorized');
}
