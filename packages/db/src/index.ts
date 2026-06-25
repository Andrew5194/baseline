export { db, getDb } from './client';
export { runMigrations } from './migrate';
export {
  users,
  accounts,
  sessions,
  verificationTokens,
  integrations,
  events,
  recurringAllocations,
  categoryColors,
  goals,
  todos,
} from './schema';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
