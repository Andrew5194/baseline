import { TOOLS, TOOLS_BY_NAME } from './tools';

/**
 * Model Context Protocol over the streamable HTTP transport, stateless.
 *
 * Stateless means no session id and no server-initiated messages: every request
 * carries its own authentication and is answered with a single JSON response. The
 * transport permits that, and it is what lets this run on Cloud Run without
 * pinning a client to an instance.
 *
 * Implements initialize, tools/list, tools/call and ping. Everything exposed is a
 * read, so there is no elicitation, sampling or subscription surface to secure.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26'] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

const SERVER_INFO = { name: 'baseline', title: 'Baseline', version: '1.0.0' };

// JSON-RPC 2.0 reserved codes.
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string; data?: unknown } };

export function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function fail(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

/** A message with no id is a notification: acknowledged, never answered. */
export function isNotification(msg: JsonRpcRequest): boolean {
  return msg.id === undefined || msg.id === null;
}

export function isValidRequest(msg: unknown): msg is JsonRpcRequest {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.jsonrpc === '2.0' && typeof m.method === 'string';
}

/**
 * Handle one message. `origin` is the base URL the tool calls are issued against;
 * it never leaves the process, since the handlers are invoked in-process.
 */
export async function handleMessage(
  msg: JsonRpcRequest,
  origin: string,
  /** Whether this caller may invoke tools that change data. */
  canWrite: boolean,
): Promise<JsonRpcResponse | null> {
  const id = msg.id ?? null;

  switch (msg.method) {
    case 'initialize': {
      // Echo the client's version when we speak it, else answer with our latest and
      // let the client decide whether it can continue.
      const asked = (msg.params?.protocolVersion as string) ?? '';
      const version = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(asked)
        ? asked
        : LATEST_PROTOCOL_VERSION;
      return ok(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Baseline measures a person\'s rate of progress from their real activity across GitHub, ' +
          'Google Calendar, Google Play Books and manual time entries. These tools read that data. ' +
          'Call them before making claims about how someone is doing — the numbers are theirs, not estimates.',
      });
    }

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return ok(id, {});

    case 'tools/list':
      // Write tools are listed for every caller, annotated, rather than hidden from
      // read-only ones: a client that cannot use one should say so, not behave as
      // though the capability does not exist.
      return ok(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: {
            readOnlyHint: !t.write,
            // Nothing here deletes or overwrites; writes only ever add a row.
            destructiveHint: false,
            idempotentHint: !t.write,
            openWorldHint: false,
          },
        })),
      });

    case 'tools/call': {
      const name = msg.params?.name;
      if (typeof name !== 'string') return fail(id, INVALID_PARAMS, 'Missing tool name');

      const tool = TOOLS_BY_NAME.get(name);
      if (!tool) return fail(id, INVALID_PARAMS, `Unknown tool: ${name}`);

      if (tool.write && !canWrite) {
        return ok(id, {
          content: [
            {
              type: 'text',
              text: `${name} changes data, and this connection is read-only. Ask the user to make the change themselves.`,
            },
          ],
          isError: true,
        });
      }

      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const res = await tool.run(args, origin);
        const body = await res.text();
        // A failing tool is a result with isError, not a protocol error: the model
        // is meant to see what went wrong and decide what to do about it.
        return ok(id, {
          content: [{ type: 'text', text: body }],
          isError: !res.ok,
          // _meta is the protocol's extension point. Only on a write that worked —
          // a client should not invalidate anything because a call failed.
          ...(res.ok && tool.changes?.length ? { _meta: { 'baseline/changed': tool.changes } } : {}),
        });
      } catch (err) {
        return ok(id, {
          content: [{ type: 'text', text: `Tool failed: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        });
      }
    }

    default:
      return fail(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
  }
}
