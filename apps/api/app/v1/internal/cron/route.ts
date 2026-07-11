import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runSyncBatch } from '../../../../lib/ingestion';
import { cleanupRateLimits } from '../../../../lib/rate-limit';

// Always execute; never serve a cached response.
export const dynamic = 'force-dynamic';

// Internal batch endpoint. In production it is only reachable on the baseline-worker
// service, whose IAM grants run.invoker to the Cloud Scheduler service account alone
// — that identity check is the primary guard. The shared secret is defense-in-depth
// (and the only guard in local/dev), so the batch can't be triggered by anyone who
// merely reaches the URL. Deliberately NOT session-authenticated: there is no user
// here, and middleware.ts lets /v1/internal through precisely so this check applies
// instead of a cookie check.
function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // misconfigured → fail closed
  const provided = request.headers.get('x-cron-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on length mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // runSyncBatch is contractually non-throwing (per-integration failures are
  // caught inside it), so a throw here is a real infra fault worth a 500 + retry.
  const sync = await runSyncBatch();

  // Rate-limit cleanup is a cheap best-effort sweep. Don't let it fail the whole
  // request: a 500 here would discard the sync we just completed and make Scheduler
  // re-run the entire (expensive) batch, when the sweep simply runs again next tick.
  let rateLimitsDeleted: number | null = null;
  try {
    rateLimitsDeleted = await cleanupRateLimits();
  } catch (e) {
    console.error('rate_limit_cleanup failed:', e);
  }

  return NextResponse.json({ status: 'ok', sync, rate_limits_deleted: rateLimitsDeleted });
}
