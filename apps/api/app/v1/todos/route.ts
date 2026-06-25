import { NextRequest, NextResponse } from 'next/server';
import { db, todos } from '@baseline/db';
import { eq, asc, desc } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

const toDto = (r: { id: string; title: string; done: boolean; createdAt: Date }) => ({
  id: r.id,
  title: r.title,
  done: r.done,
  created_at: r.createdAt,
});

// GET /v1/todos — the user's to-do items (open first, newest first within each).
export async function GET() {
  const userId = await getCurrentUserId();
  const rows = await db
    .select({ id: todos.id, title: todos.title, done: todos.done, createdAt: todos.createdAt })
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(asc(todos.done), desc(todos.createdAt));

  return NextResponse.json({ data: rows.map(toDto) });
}

// POST /v1/todos — add a to-do.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'title is required', code: 'INVALID_TITLE' }, { status: 400 });
  }
  if (title.length > 280) {
    return NextResponse.json({ error: 'title is too long', code: 'INVALID_TITLE' }, { status: 400 });
  }

  const [row] = await db
    .insert(todos)
    .values({ userId, title })
    .returning({ id: todos.id, title: todos.title, done: todos.done, createdAt: todos.createdAt });

  return NextResponse.json(toDto(row), { status: 201 });
}
