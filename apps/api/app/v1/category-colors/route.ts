import { NextRequest, NextResponse } from 'next/server';
import { db, categoryColors } from '@baseline/db';
import { eq, and } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

// Accept #rgb / #rrggbb hex colors only.
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// GET /v1/category-colors — the user's category color overrides as { category: color }.
export async function GET() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select({ category: categoryColors.category, color: categoryColors.color })
    .from(categoryColors)
    .where(eq(categoryColors.userId, userId));

  const colors: Record<string, string> = {};
  for (const r of rows) colors[r.category] = r.color;
  return NextResponse.json({ colors });
}

// PUT /v1/category-colors — set (upsert) the color override for one category.
export async function PUT(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { category?: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const color = typeof body.color === 'string' ? body.color.trim() : '';
  if (!category) {
    return NextResponse.json({ error: 'category is required', code: 'INVALID_CATEGORY' }, { status: 400 });
  }
  if (!HEX.test(color)) {
    return NextResponse.json({ error: 'color must be a hex value', code: 'INVALID_COLOR' }, { status: 400 });
  }

  await db
    .insert(categoryColors)
    .values({ userId, category, color })
    .onConflictDoUpdate({
      target: [categoryColors.userId, categoryColors.category],
      set: { color },
    });

  return NextResponse.json({ category, color });
}

// DELETE /v1/category-colors?category=... — reset a category to its default color.
export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  const category = request.nextUrl.searchParams.get('category')?.trim();
  if (!category) {
    return NextResponse.json({ error: 'category is required', code: 'INVALID_CATEGORY' }, { status: 400 });
  }

  await db
    .delete(categoryColors)
    .where(and(eq(categoryColors.userId, userId), eq(categoryColors.category, category)));

  return NextResponse.json({ category, reset: true });
}
