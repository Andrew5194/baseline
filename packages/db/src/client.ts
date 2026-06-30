import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Cache the pool + client on globalThis (not a module-scoped variable). In dev,
// Next.js hot-reload re-evaluates this module on every change; a module-scoped
// singleton would reset and open a fresh 10-connection pool each time while
// abandoning the old one, leaking connections until Postgres hits max_connections
// (→ 500s / timeouts). globalThis survives reloads, so we reuse one pool.
const globalForDb = globalThis as unknown as {
  __pgSql?: ReturnType<typeof postgres>;
  __db?: PostgresJsDatabase<typeof schema>;
};

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!globalForDb.__db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    const sql =
      globalForDb.__pgSql ??
      postgres(connectionString, {
        max: 10,
        idle_timeout: 20, // close idle connections after 20s
      });
    globalForDb.__pgSql = sql;
    globalForDb.__db = drizzle(sql, { schema });
  }
  return globalForDb.__db;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
