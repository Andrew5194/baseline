export { db, getDb } from './client';
export { runMigrations } from './migrate';
// Every table, rather than a hand-kept list: the previous one had already drifted
// (rateLimits was missing), and a table you cannot import is a bug waiting to be
// rediscovered from a failing build.
export * from './schema';
export { resolveCategoryId, seedDefaultCategories, DEFAULT_CATEGORIES } from './categories';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
