import { NextResponse } from 'next/server';
import { entitlements } from '@baseline/entitlements';
import { getCurrentUserId } from '../../../../lib/user';
import { callProService, proServiceUrl, ProUnavailableError } from '../../../../lib/pro-service';

// What the assistant can reach, straight from the Pro service's definitions rather
// than from anything the model says about itself. Same gates as the chat route: a
// deployment without a Pro service has no tools, and a free user cannot enumerate them.
export async function GET() {
  const userId = await getCurrentUserId();

  if (!proServiceUrl()) {
    return NextResponse.json(
      { error: 'Assistant is not available on this deployment', code: 'PRO_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const features = await entitlements(userId);
  if (!features.has('max_assistant')) {
    return NextResponse.json({ error: 'Baseline Pro required', code: 'UPGRADE_REQUIRED' }, { status: 402 });
  }

  try {
    return NextResponse.json(await callProService('/max/tools', userId, [...features]));
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
