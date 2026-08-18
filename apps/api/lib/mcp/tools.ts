import { NextRequest, NextResponse } from 'next/server';
import { GET as metricsOverview } from '../../app/v1/metrics/overview/route';
import { GET as goals } from '../../app/v1/goals/route';
import { GET as events } from '../../app/v1/events/route';

/**
 * Baseline's data, as MCP tools.
 *
 * Each tool delegates to the /v1 handler that already serves the same data to the
 * web app, called in-process with a synthetic request. Nothing is reimplemented
 * here, so a tool cannot drift from the endpoint it mirrors, and authentication
 * resolves exactly as it would for a direct call — whoever the request is for,
 * that is whose data comes back.
 *
 * Read-only by construction: only GET handlers are wired up.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>, origin: string) => Promise<NextResponse>;
}

const WINDOWS = new Set(['7d', '30d', '90d']);
const SOURCES = new Set(['github', 'google_calendar', 'google_books', 'manual']);

/** A request the /v1 handlers can read, carrying this request's own headers. */
function synth(origin: string, path: string, params: Record<string, string | undefined>): NextRequest {
  const url = new URL(path, origin);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  return new NextRequest(url, { method: 'GET' });
}

export const TOOLS: McpTool[] = [
  {
    name: 'get_metrics_overview',
    description:
      'Headline productivity metrics across a recent window: commits, pull requests, reviews, ' +
      'reading progress, tracked time, streaks and consistency, each with a delta against the ' +
      'previous window. Start here for questions about how someone is doing overall.',
    inputSchema: {
      type: 'object',
      properties: {
        window: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Look-back window. Defaults to 30d.' },
      },
      additionalProperties: false,
    },
    run: (args, origin) => {
      const w = typeof args.window === 'string' && WINDOWS.has(args.window) ? args.window : '30d';
      return metricsOverview(synth(origin, '/v1/metrics/overview', { window: w }));
    },
  },
  {
    name: 'get_goals',
    description:
      'Goals, active and completed, each with counts of the tasks tagged to it. Use before ' +
      'proposing a new goal, to avoid suggesting something already being tracked.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: (_args, origin) => goals(synth(origin, '/v1/goals', {})),
  },
  {
    name: 'get_recent_activity',
    description:
      'Raw activity events newest first — commits, pull requests, reviews, reading progress, ' +
      'calendar entries and manual time entries. Use when specifics matter more than aggregates.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum events, capped at 100. Defaults to 30.' },
        source: {
          type: 'string',
          enum: [...SOURCES],
          description: 'Restrict to a single source. Omit for all sources.',
        },
        since: { type: 'string', description: 'ISO 8601 timestamp; only events at or after it.' },
        until: { type: 'string', description: 'ISO 8601 timestamp; only events before it.' },
      },
      additionalProperties: false,
    },
    run: (args, origin) => {
      const limit = String(Math.min(Math.max(Number(args.limit) || 30, 1), 100));
      const source = typeof args.source === 'string' && SOURCES.has(args.source) ? args.source : undefined;
      const since = typeof args.since === 'string' ? args.since : undefined;
      const until = typeof args.until === 'string' ? args.until : undefined;
      return events(synth(origin, '/v1/events', { limit, source, since, until }));
    },
  },
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
