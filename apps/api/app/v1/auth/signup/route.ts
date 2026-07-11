import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@baseline/db';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/bcrypt';
import { allow, clientIp } from '../../../../lib/rate-limit';

export async function POST(request: NextRequest) {
  if (!(await allow('signup', clientIp(request.headers)))) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: 'Email and password are required', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  if (body.password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists', code: 'EMAIL_EXISTS' },
      { status: 409 },
    );
  }

  const passwordHash = await hash(body.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email: body.email,
      passwordHash,
      name: body.name || null,
    })
    .returning({ id: users.id, email: users.email });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
