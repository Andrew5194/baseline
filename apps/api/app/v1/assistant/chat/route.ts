import { NextRequest, NextResponse } from 'next/server';
import { entitlements } from '@baseline/entitlements';
import { getCurrentUserId } from '../../../../lib/user';
import { callProService, proServiceUrl, ProUnavailableError } from '../../../../lib/pro-service';

// Max is a Pro feature. This route is the whole of it that lives in the open repo:
// it authenticates, checks entitlement, and forwards. The prompt, tools and model
// calls are in the Pro service.
export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();

  if (!proServiceUrl()) {
    return NextResponse.json(
      { error: 'Assistant is not available on this deployment', code: 'PRO_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const features = await entitlements(userId);
  if (!features.has('max_assistant')) {
    return NextResponse.json(
      { error: 'Baseline Pro required', code: 'UPGRADE_REQUIRED' },
      { status: 402 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const reply = await callProService<{ reply: string }>(
      '/max/chat',
      userId,
      [...features],
      { messages: body.messages ?? [] },
    );
    return NextResponse.json(reply);
  } catch (err) {
    if (err instanceof ProUnavailableError) {
      console.error('pro service call failed:', err.message);
      return NextResponse.json(
        { error: 'Assistant is temporarily unavailable', code: 'PRO_UNAVAILABLE' },
        { status: 503 },
      );
    }
    throw err;
  }
}
