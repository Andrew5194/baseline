import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runSyncBatch } from '../../../../lib/ingestion';
import { cleanupRateLimits } from '../../../../lib/rate-limit';

// Always execute; never serve a cached response.
export const dynamic = 'force-dynamic';

// Internal batch endpoint. Primary guard in prod is IAM: only the Cloud Scheduler SA
// has run.invoker on baseline-worker. The shared secret is defense-in-depth (and the
// only guard in dev). Not session-authenticated — no user here; middleware lets
// /v1/internal through so this check applies instead of a cookie check.
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

  // runSyncBatch is contractually non-throwing (per-integration failures caught
  // inside), so a throw here is a real infra fault worth a 500 + retry.
  const sync = await runSyncBatch();

  // Best-effort sweep; must not fail the request. A 500 here would discard the
  // completed sync and make Scheduler re-run the whole expensive batch — the sweep
  // just runs again next tick.
  let rateLimitsDeleted: number | null = null;
  try {
    rateLimitsDeleted = await cleanupRateLimits();
  } catch (e) {
    console.error('rate_limit_cleanup failed:', e);
  }

  return NextResponse.json({ status: 'ok', sync, rate_limits_deleted: rateLimitsDeleted });
}
