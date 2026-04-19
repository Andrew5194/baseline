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

export type CommitPayload = z.infer<typeof commitPayload>;
export type PrPayload = z.infer<typeof prPayload>;
export type ReviewPayload = z.infer<typeof reviewPayload>;

export const EVENT_TYPES = {
  COMMIT_PUSHED: 'github.commit.pushed',
  PR_MERGED: 'github.pr.merged',
  PR_REVIEWED: 'github.pr.reviewed',
} as const;
