import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './client';
import { categories, categoryColors } from './schema';

// The starter set every new account gets, seeded on signup. These are ordinary
// rows — editable, renamable, and deletable like any user-created category.
// Colors are seeded into category_colors (which stays keyed by name).
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Coding', color: '#10b981' }, //     emerald
  { name: 'Work', color: '#6366f1' }, //       indigo
  { name: 'Essentials', color: '#f59e0b' }, // amber
  { name: 'Health', color: '#f43f5e' }, //     rose
  { name: 'Household', color: '#0ea5e9' }, //  sky
];

// Find (case-insensitively) or create the category row for `name` under `userId`,
// returning its id. Empty/blank name → null (uncategorized). This is the single
// entry point routes use to turn a typed category name into a foreign key.
export async function resolveCategoryId(
  userId: string,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return null;
  const clipped = trimmed.slice(0, 120);
  const db = getDb();

  const found = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), sql`lower(${categories.name}) = lower(${clipped})`))
    .limit(1);
  if (found[0]) return found[0].id;

  const inserted = await db
    .insert(categories)
    .values({ userId, name: clipped })
    .onConflictDoNothing()
    .returning({ id: categories.id });
  if (inserted[0]) return inserted[0].id;

  // Lost an insert race — the row now exists; read it back.
  const again = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, clipped)))
    .limit(1);
  return again[0]?.id ?? null;
}

// Seed the default categories (+ their colors) for a freshly created user.
// Idempotent: onConflictDoNothing so re-running never duplicates.
export async function seedDefaultCategories(userId: string): Promise<void> {
  const db = getDb();
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ userId, name: c.name, position: i })))
    .onConflictDoNothing();
  await db
    .insert(categoryColors)
    .values(DEFAULT_CATEGORIES.map((c) => ({ userId, category: c.name, color: c.color })))
    .onConflictDoNothing();
}
