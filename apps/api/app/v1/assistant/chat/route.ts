import { NextRequest } from 'next/server';
import { db, assistantMessages } from '@baseline/db';
import { proxyToPro } from '../../../../lib/pro-route';

// Max is a Pro feature. This route is the whole of it that lives in the open repo:
// it authenticates, checks entitlement, forwards, and keeps the transcript. The
// prompt, tools and model calls are in the Pro service.
export async function POST(request: NextRequest) {
  return proxyToPro(
    'max_assistant',
    '/max/chat',
    async () => {
      const body = (await request.json()) as { messages?: unknown };
      return { messages: body.messages ?? [] };
    },
    // Both halves are stored together, once the reply exists. Saving the question
    // earlier would leave it stranded in the transcript when a call fails, looking
    // like Max ignored it.
    async (result, userId, body) => {
      const sent = (body as { messages?: Array<{ role?: string; text?: string }> }).messages ?? [];
      const asked = [...sent].reverse().find((m) => m.role === 'user')?.text?.trim();
      const { reply, suggestions } = (result ?? {}) as { reply?: string; suggestions?: unknown };
      if (!asked || !reply) return;

      await db.insert(assistantMessages).values([
        { userId, role: 'user', content: asked },
        {
          userId,
          role: 'assistant',
          content: reply,
          suggestions: Array.isArray(suggestions) && suggestions.length ? suggestions : null,
        },
      ]);
    },
  );
}
