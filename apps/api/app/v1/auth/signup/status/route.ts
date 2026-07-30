import { NextResponse } from 'next/server';
import { isSignupEnabled } from '../../../../../lib/flags';

// GET /v1/auth/signup/status — whether public, self-service sign-up is currently open.
// Public (no auth) so the sign-up page can render the right state; exposes only the
// boolean, never the flag token.
export async function GET() {
  return NextResponse.json({ open: isSignupEnabled() });
}
