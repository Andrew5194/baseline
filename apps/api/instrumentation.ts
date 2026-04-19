export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');
    const { syncAllIntegrations } = await import('./lib/ingestion');

    cron.default.schedule('*/15 * * * *', async () => {
      console.log(JSON.stringify({ msg: 'cron_start', job: 'sync_all_integrations' }));
      await syncAllIntegrations();
      console.log(JSON.stringify({ msg: 'cron_end', job: 'sync_all_integrations' }));
    });

    console.log('Cron: sync_all_integrations scheduled every 15 minutes');
  }
}
