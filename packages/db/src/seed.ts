import { db } from './client';
import { users } from './schema';

async function seed() {
  console.log('Seeding database...');

  await db
    .insert(users)
    .values({
      email: 'dev@baseline.local',
      name: 'Dev User',
    })
    .onConflictDoNothing();

  console.log('Seeded dev user: dev@baseline.local');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
