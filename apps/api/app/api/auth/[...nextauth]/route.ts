import { NextResponse, type NextRequest } from 'next/server';
import { handlers } from '../../../../lib/auth';
import { allow, clientIp } from '../../../../lib/rate-limit';

export const GET = handlers.GET;

// Rate-limit only the credentials sign-in callback (the brute-force target); every
// other /api/auth/* route (csrf, session, signout, …) passes straight through.
export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith('/callback/credentials')) {
    if (!(await allow('login', clientIp(request.headers)))) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }
  }
  return handlers.POST(request);
}
