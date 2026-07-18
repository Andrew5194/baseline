import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@baseline/db';
import { eq, sql, type SQL } from 'drizzle-orm';
import { getCurrentUserId } from '../../../lib/user';

// Whether `tz` is a valid IANA timezone the runtime understands.
function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const SELECT = {
  id: users.id,
  email: users.email,
  name: users.name,
  timezone: users.timezone,
  timezoneSet: users.timezoneSet,
  preferences: users.preferences,
};

// GET /v1/me — the current user's profile (incl. timezone + synced UI preferences).
export async function GET() {
  const userId = await getCurrentUserId();
  const [user] = await db.select(SELECT).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(user);
}

// PATCH /v1/me — update editable fields: timezone and/or UI preferences. Each is
// optional; preferences are shallow-merged into the stored JSON so a partial update
// (one key) doesn't clobber the others.
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();

  let body: { timezone?: string; explicit?: boolean; preferences?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  const set: { timezone?: string; timezoneSet?: boolean; preferences?: SQL } = {};

  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || !isValidTimeZone(body.timezone)) {
      return NextResponse.json({ error: 'Valid IANA timezone is required', code: 'INVALID_TIMEZONE' }, { status: 400 });
    }
    set.timezone = body.timezone;
    // `explicit` marks a deliberate user selection; only that locks timezone_set.
    if (body.explicit) set.timezoneSet = true;
  }

  if (body.preferences !== undefined) {
    if (typeof body.preferences !== 'object' || body.preferences === null || Array.isArray(body.preferences)) {
      return NextResponse.json({ error: 'preferences must be an object', code: 'INVALID_PREFERENCES' }, { status: 400 });
    }
    // Shallow-merge (|| on jsonb) so partial updates keep the other preference keys.
    set.preferences = sql`coalesce(${users.preferences}, '{}'::jsonb) || ${JSON.stringify(body.preferences)}::jsonb`;
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: 'Nothing to update', code: 'EMPTY_UPDATE' }, { status: 400 });
  }

  const [user] = await db.update(users).set(set).where(eq(users.id, userId)).returning(SELECT);
  return NextResponse.json(user);
}
