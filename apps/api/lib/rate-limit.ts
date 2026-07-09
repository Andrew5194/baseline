import { getDb } from '@baseline/db';
import { sql } from 'drizzle-orm';

type Kind = 'login' | 'signup';

// Fixed-window limits: at most `limit` of this action per `windowMs` per client IP.
const CONFIG: Record<Kind, { limit: number; windowMs: number }> = {
  login: { limit: 5, windowMs: 60_000 }, //        5 login attempts / minute
  signup: { limit: 3, windowMs: 60 * 60_000 }, //  3 sign-ups        / hour
};

// Client IP from the proxy chain (first hop is the real client).
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  return xff ? xff.split(',')[0].trim() : 'unknown';
}

// True when the request is allowed. One atomic upsert bumps a per-(action,IP,window)
// counter shared across all Cloud Run instances. Fails OPEN on any DB error so a
// hiccup in the limiter never locks users out of auth.
export async function allow(kind: Kind, ip: string): Promise<boolean> {
  const { limit, windowMs } = CONFIG[kind];
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `${kind}:${ip}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * windowMs);
  try {
    const rows = (await getDb().execute(sql`
      INSERT INTO rate_limits (key, count, expires_at)
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `)) as unknown as Array<{ count: number }>;
    const count = Number(rows[0]?.count ?? 1);
    return count <= limit;
  } catch (err) {
    console.error('rate-limit check failed (allowing):', err);
    return true;
  }
}

// Delete expired buckets so the table stays tiny. Called by the cron.
export async function cleanupRateLimits(): Promise<number> {
  const res = (await getDb().execute(sql`
    DELETE FROM rate_limits WHERE expires_at < now()
  `)) as unknown as { count?: number };
  return res.count ?? 0;
}
