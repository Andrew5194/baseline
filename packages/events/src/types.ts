import { z } from 'zod';

export const commitPayload = z.object({
  sha: z.string(),
  message: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
});

export const prPayload = z.object({
  number: z.number(),
  title: z.string(),
  repo: z.string(),
  state: z.string(),
  merged_at: z.string().nullable(),
  created_at: z.string(),
  first_commit_at: z.string().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  changed_files: z.number().optional(),
});

export const reviewPayload = z.object({
  review_id: z.number(),
  pr_number: z.number(),
  repo: z.string(),
  state: z.string(),
  body: z.string().optional(),
});

export const manualTimeEntryPayload = z.object({
  category: z.string().min(1),
  note: z.string().optional(),
  // True for stopwatch/timer sessions — occurred_at is the real end time, so a
  // start–end range can be derived. Manual entries leave this unset (no real time).
  timed: z.boolean().optional(),
  // When the session was started from a task's timer, the task's id — lets the
  // entry link back to that task.
  task_id: z.string().optional(),
});

export const gcalEventPayload = z.object({
  category: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  html_link: z.string().optional(),
  all_day: z.boolean().optional(),
  attendee_count: z.number().optional(),
  status: z.string().optional(),
  end: z.string().optional(),
});

export type CommitPayload = z.infer<typeof commitPayload>;
export type PrPayload = z.infer<typeof prPayload>;
export type ReviewPayload = z.infer<typeof reviewPayload>;
export type ManualTimeEntryPayload = z.infer<typeof manualTimeEntryPayload>;
export type GcalEventPayload = z.infer<typeof gcalEventPayload>;

export const EVENT_TYPES = {
  COMMIT_PUSHED: 'github.commit.pushed',
  PR_MERGED: 'github.pr.merged',
  PR_REVIEWED: 'github.pr.reviewed',
  MANUAL_TIME_ENTRY_CREATED: 'manual.time_entry.created',
  GCAL_EVENT: 'google_calendar.event',
} as const;
