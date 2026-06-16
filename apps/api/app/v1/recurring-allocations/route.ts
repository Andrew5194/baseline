import { NextRequest, NextResponse } from 'next/server';
import { db, recurringAllocations } from '@baseline/db';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

const HOUR_MS = 60 * 60 * 1000;
const ALL_DAYS = 127; // every weekday
const round2 = (n: number) => Math.round(n * 100) / 100;

const toDto = (r: { id: string; category: string; durationMs: number; daysMask: number; note: string | null }) => ({
  id: r.id,
  category: r.category,
  hours: round2(r.durationMs / HOUR_MS),
  days_mask: r.daysMask,
  note: r.note,
});

// GET /v1/recurring-allocations — the user's standing daily routine.
export async function GET() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select({
      id: recurringAllocations.id,
      category: recurringAllocations.category,
      durationMs: recurringAllocations.durationMs,
      daysMask: recurringAllocations.daysMask,
      note: recurringAllocations.note,
    })
    .from(recurringAllocations)
    .where(eq(recurringAllocations.userId, userId))
    .orderBy(asc(recurringAllocations.createdAt));

  return NextResponse.json({ data: rows.map(toDto) });
}

// POST /v1/recurring-allocations — add a recurring allocation (e.g. Sleep 8h daily).
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { category?: string; hours?: number; days_mask?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!category) {
    return NextResponse.json({ error: 'category is required', code: 'INVALID_CATEGORY' }, { status: 400 });
  }
  if (typeof body.hours !== 'number' || !(body.hours > 0) || body.hours > 24) {
    return NextResponse.json({ error: 'hours must be between 0 and 24', code: 'INVALID_HOURS' }, { status: 400 });
  }
  // Clamp days_mask into the valid 7-bit range; default to every day.
  const daysMask =
    Number.isInteger(body.days_mask) && body.days_mask! > 0 ? body.days_mask! & ALL_DAYS : ALL_DAYS;

  const [row] = await db
    .insert(recurringAllocations)
    .values({
      userId,
      category,
      durationMs: Math.round(body.hours * HOUR_MS),
      daysMask,
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    })
    .returning({
      id: recurringAllocations.id,
      category: recurringAllocations.category,
      durationMs: recurringAllocations.durationMs,
      daysMask: recurringAllocations.daysMask,
      note: recurringAllocations.note,
    });

  return NextResponse.json(toDto(row), { status: 201 });
}
