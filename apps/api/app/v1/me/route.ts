import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@baseline/db';
import { eq } from 'drizzle-orm';
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

// GET /v1/me — the current user's profile (incl. timezone).
export async function GET() {
  const userId = await getCurrentUserId();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      timezone: users.timezone,
      timezoneSet: users.timezoneSet,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(user);
}

// PATCH /v1/me — update editable profile fields (currently: timezone).
export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();

  // `explicit` marks a deliberate user selection (vs. the client auto-persisting the
  // browser-detected zone). Only an explicit save locks in `timezone_set = true`; an
  // auto-persist updates the zone but leaves it "unset" so it keeps tracking the browser.
  let body: { timezone?: string; explicit?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  if (typeof body.timezone !== 'string' || !isValidTimeZone(body.timezone)) {
    return NextResponse.json(
      { error: 'Valid IANA timezone is required', code: 'INVALID_TIMEZONE' },
      { status: 400 },
    );
  }

  const [user] = await db
    .update(users)
    .set({ timezone: body.timezone, ...(body.explicit ? { timezoneSet: true } : {}) })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      timezone: users.timezone,
      timezoneSet: users.timezoneSet,
    });

  return NextResponse.json(user);
}
