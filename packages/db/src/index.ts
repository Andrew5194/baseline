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
  categories,
  goals,
  todos,
  recurringTodos,
  recurringTodoCompletions,
  dayNotes,
} from './schema';
export { resolveCategoryId, seedDefaultCategories, DEFAULT_CATEGORIES } from './categories';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
