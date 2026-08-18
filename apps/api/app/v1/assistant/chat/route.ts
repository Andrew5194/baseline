import { NextRequest } from 'next/server';
import { proxyToPro } from '../../../../lib/pro-route';

// Max is a Pro feature. This route is the whole of it that lives in the open repo:
// it authenticates, checks entitlement, and forwards. The prompt, tools and model
// calls are in the Pro service.
export async function POST(request: NextRequest) {
  return proxyToPro('max_assistant', '/max/chat', async () => {
    const body = (await request.json()) as { messages?: unknown };
    return { messages: body.messages ?? [] };
  });
}
