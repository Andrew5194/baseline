export async function register() {
  // The `=== 'nodejs'` wrapper matters beyond correctness: Next.js compiles this
  // file for the edge runtime too, and replaces process.env.NEXT_RUNTIME with a
  // build-time literal. Wrapping the body in `if (... === 'nodejs')` lets the edge
  // build tree-shake the whole block, so the node-only imports below (postgres/fs
  // in @baseline/db) never reach the edge bundle. An early-return `!== 'nodejs'`
  // does NOT get eliminated the same way and breaks `next build`.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Run database migrations on startup (creates tables on first boot). Gated so a
    // single process migrates: other processes sharing this image must not race it
    // applying DDL, so they set RUN_MIGRATIONS=false.
    if (process.env.RUN_MIGRATIONS !== 'false') {
      try {
        const path = await import('path');
        const { runMigrations } = await import('@baseline/db');
        // In standalone mode, cwd is /app/apps/api but drizzle files are at /app/packages/db/drizzle
        await runMigrations(path.resolve(process.cwd(), '..', '..', 'packages', 'db', 'drizzle'));
        console.log('Database migrations applied');
      } catch (e) {
        // Fail loudly: a failed migration must NOT serve traffic on a mismatched
        // schema. Exiting non-zero aborts startup so the process never begins serving
        // on a bad schema, instead of silently continuing. (Swallowing this error is
        // what previously masked an unmigrated schema and broke sign-in.)
        console.error('FATAL: database migration failed, aborting startup:', e);
        process.exit(1);
      }
    }

    // Sync + rate-limit cleanup.
    //
    // When an external scheduler drives these jobs out-of-process (a separate worker
    // hitting POST /v1/internal/cron once per interval, isolated from request
    // serving), that environment sets INPROCESS_CRON=false to disable this timer.
    //
    // Otherwise — self-host and local `make dev` — there is no external scheduler, so
    // an in-process timer is the right driver and stays ON by default. A single
    // long-lived container doesn't hit the "duplicated per instance" /
    // "scale-to-zero skips ticks" problems that motivate an external scheduler.
    if (process.env.INPROCESS_CRON !== 'false') {
      const INTERVAL_MS = 15 * 60 * 1000;
      let running = false;

      setInterval(async () => {
        if (running) {
          // Previous tick still going (slow sync / many integrations) — skip this
          // one rather than overlapping runs on the same box.
          console.warn(JSON.stringify({ msg: 'inprocess_cron_skip', reason: 'previous_still_running' }));
          return;
        }
        running = true;
        try {
          const { runSyncBatch } = await import('./lib/ingestion');
          const { cleanupRateLimits } = await import('./lib/rate-limit');
          await runSyncBatch();
          await cleanupRateLimits();
        } catch (e) {
          console.error('inprocess_cron failed:', e);
        } finally {
          running = false;
        }
      }, INTERVAL_MS);

      console.log('In-process cron enabled (sync + rate-limit cleanup every 15m). Set INPROCESS_CRON=false to disable.');
    }
  }
}
