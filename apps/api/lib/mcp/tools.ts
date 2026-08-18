import { NextRequest, NextResponse } from 'next/server';
import { GET as metricsOverview } from '../../app/v1/metrics/overview/route';
import { GET as goals, POST as createGoalRoute } from '../../app/v1/goals/route';
import { GET as events } from '../../app/v1/events/route';
import { POST as createTodoRoute } from '../../app/v1/todos/route';

/**
 * Baseline's data, as MCP tools.
 *
 * Each tool delegates to the /v1 handler that already serves the same data to the
 * web app, called in-process with a synthetic request. Nothing is reimplemented
 * here, so a tool cannot drift from the endpoint it mirrors, and authentication
 * resolves exactly as it would for a direct call — whoever the request is for,
 * that is whose data comes back.
 *
 * Tools that write say so via `write`, which is surfaced to clients as MCP's
 * readOnlyHint annotation and enforced against the caller's scope before dispatch.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** True when the tool changes data. Drives readOnlyHint and the scope check. */
  write?: boolean;
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

/** The same, for the handlers that take a JSON body. */
function synthPost(origin: string, path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(path, origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Undefined for anything that is not a non-empty string, so blanks never reach a handler. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
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

TOOLS.push(
  {
    name: 'create_goal',
    description:
      'Create a goal for the user. Goals are outcomes to work towards, not individual tasks — ' +
      'use create_task for the smaller pieces. Check get_goals first so an existing goal is not ' +
      'duplicated. Only create a goal the user has asked for or agreed to.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The goal, phrased as something finishable. Required.' },
        category: { type: 'string', description: 'Category name; created if it does not exist.' },
        due_at: { type: 'string', description: 'Due date as YYYY-MM-DD.' },
        color: { type: 'string', description: 'Hex colour such as #10b981.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    run: (args, origin) =>
      createGoalRoute(
        synthPost(origin, '/v1/goals', {
          title: str(args.title),
          category: str(args.category),
          due_at: str(args.due_at),
          color: str(args.color),
        }),
      ),
  },
  {
    name: 'create_task',
    description:
      'Create a task on the user\'s list, optionally tied to a goal and dated. Tasks are the ' +
      'concrete things done on a given day. Only create a task the user has asked for or agreed to.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What to do. Required.' },
        date: { type: 'string', description: 'Day it belongs to, YYYY-MM-DD. Defaults to today.' },
        goal_id: { type: 'string', description: 'Id of a goal from get_goals, to tag this task to it.' },
        category: { type: 'string', description: 'Category name; ignored when goal_id is given.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    run: (args, origin) =>
      createTodoRoute(
        synthPost(origin, '/v1/todos', {
          title: str(args.title),
          date: str(args.date),
          goal_id: str(args.goal_id),
          category: str(args.category),
        }),
      ),
  },
);

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
