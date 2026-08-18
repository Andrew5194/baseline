import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../lib/user';
import { bearer, verifyServiceAssertion } from '../../../lib/service-auth';
import {
  handleMessage,
  isNotification,
  isValidRequest,
  fail,
  INVALID_REQUEST,
  PARSE_ERROR,
  LATEST_PROTOCOL_VERSION,
} from '../../../lib/mcp/server';

/**
 * The MCP endpoint, streamable HTTP transport, stateless.
 *
 * Any MCP client that can authenticate as the user — the Pro service on their
 * behalf, or their own client carrying a session — reaches the same tools over the
 * same protocol. Authentication is resolved before a single message is read, so an
 * unauthenticated caller cannot even enumerate the tool list.
 */

function protocolHeaders(extra?: Record<string, string>): Record<string, string> {
  return { 'MCP-Protocol-Version': LATEST_PROTOCOL_VERSION, ...extra };
}

/**
 * Whether this caller may run tools that change data.
 *
 * A session belongs to the user themselves, so it carries full rights. A service
 * assertion carries only what it claims: a token minted to read cannot be turned
 * around and used to write, even though the same secret signs both.
 */
function canWrite(request: NextRequest): boolean {
  const token = bearer(request.headers.get('authorization'));
  if (!token) return true; // session cookie — the user acting as themselves
  const secret = process.env.PRO_SERVICE_SECRET;
  if (!secret) return false;
  try {
    return verifyServiceAssertion(token, secret, 'core').scope?.includes('write') ?? false;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Throws for an unauthenticated caller, which middleware has already turned away.
  await getCurrentUserId();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(fail(null, PARSE_ERROR, 'Invalid JSON'), { status: 400, headers: protocolHeaders() });
  }

  // Batching was removed in 2025-06-18; one message per request.
  if (Array.isArray(payload)) {
    return NextResponse.json(fail(null, INVALID_REQUEST, 'Batched requests are not supported'), {
      status: 400,
      headers: protocolHeaders(),
    });
  }

  if (!isValidRequest(payload)) {
    return NextResponse.json(fail(null, INVALID_REQUEST, 'Not a JSON-RPC 2.0 request'), {
      status: 400,
      headers: protocolHeaders(),
    });
  }

  // Tools call the /v1 handlers in-process; the origin only builds their URLs.
  const response = await handleMessage(payload, request.nextUrl.origin, canWrite(request));

  // A notification is acknowledged with no body.
  if (response === null || isNotification(payload)) {
    return new NextResponse(null, { status: 202, headers: protocolHeaders() });
  }

  return NextResponse.json(response, { headers: protocolHeaders({ 'Cache-Control': 'no-store' }) });
}

// No server-initiated messages and no sessions to end, so the spec's optional GET
// stream and DELETE termination are both declined rather than faked.
export async function GET() {
  await getCurrentUserId();
  return NextResponse.json(
    { error: 'This server does not offer an SSE stream', code: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: protocolHeaders({ Allow: 'POST' }) },
  );
}

export async function DELETE() {
  await getCurrentUserId();
  return NextResponse.json(
    { error: 'This server is stateless; there is no session to terminate', code: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: protocolHeaders({ Allow: 'POST' }) },
  );
}
