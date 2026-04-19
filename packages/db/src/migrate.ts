import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

export async function runMigrations(migrationsFolder: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const sql = postgres(connectionString, { max: 1 });

  // Read the journal to get ordered migrations
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

  // Create migrations tracking table
  await sql`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT
  )`;

  const applied = await sql`SELECT hash FROM __drizzle_migrations`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appliedHashes = new Set(applied.map((r: any) => r.hash as string));

  for (const entry of journal.entries) {
    if (appliedHashes.has(entry.tag)) continue;

    const sqlFile = path.join(migrationsFolder, `${entry.tag}.sql`);
    const migration = fs.readFileSync(sqlFile, 'utf-8');

    // Split on statement boundaries and execute each
    const statements = migration.split('--> statement-breakpoint').map((s: string) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }

    await sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${entry.tag}, ${Date.now()})`;
    console.log(`Applied migration: ${entry.tag}`);
  }

  await sql.end();
}
