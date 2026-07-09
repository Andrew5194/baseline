export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Run database migrations on startup (creates tables on first boot)
    try {
      const path = await import('path');
      const { runMigrations } = await import('@baseline/db');
      // In standalone mode, cwd is /app/apps/api but drizzle files are at /app/packages/db/drizzle
      await runMigrations(path.resolve(process.cwd(), '..', '..', 'packages', 'db', 'drizzle'));
      console.log('Database migrations applied');
    } catch (e) {
      console.error('Migration failed:', e);
    }

    const cron = await import('node-cron');
    const { syncAllIntegrations } = await import('./lib/ingestion');

    cron.default.schedule('*/15 * * * *', async () => {
      console.log(JSON.stringify({ msg: 'cron_start', job: 'sync_all_integrations' }));
      await syncAllIntegrations();
      console.log(JSON.stringify({ msg: 'cron_end', job: 'sync_all_integrations' }));
    });

    // Sweep expired rate-limit buckets (Postgres has no TTL, so we clean them up).
    const { cleanupRateLimits } = await import('./lib/rate-limit');
    cron.default.schedule('*/10 * * * *', async () => {
      try {
        const deleted = await cleanupRateLimits();
        if (deleted) console.log(JSON.stringify({ msg: 'cron', job: 'rate_limit_cleanup', deleted }));
      } catch (e) {
        console.error('rate_limit_cleanup failed:', e);
      }
    });

    console.log('Cron: sync_all_integrations (15m) + rate_limit_cleanup (10m) scheduled');
  }
}
