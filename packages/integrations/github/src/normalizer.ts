import { EVENT_TYPES } from '@baseline/events';

interface EventRow {
  userId: string;
  source: string;
  sourceId: string;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export function normalizeCommits(
  commits: Array<{ sha: string; message: string; repo: string; occurred_at: string }>,
  userId: string,
): EventRow[] {
  return commits.map((c) => ({
    userId,
    source: 'github',
    sourceId: c.sha,
    eventType: EVENT_TYPES.COMMIT_PUSHED,
    occurredAt: new Date(c.occurred_at),
    payload: { sha: c.sha, message: c.message, repo: c.repo },
  }));
}

export function normalizePullRequests(
  prs: Array<{
    number: number;
    title: string;
    repo: string;
    state: string;
    merged_at: string | null;
    created_at: string;
    additions: number;
    deletions: number;
    changed_files: number;
  }>,
  userId: string,
): EventRow[] {
  return prs
    .filter((pr) => pr.merged_at)
    .map((pr) => ({
      userId,
      source: 'github',
      sourceId: `${pr.repo}#${pr.number}`,
      eventType: EVENT_TYPES.PR_MERGED,
      occurredAt: new Date(pr.merged_at!),
      payload: {
        number: pr.number,
        title: pr.title,
        repo: pr.repo,
        state: pr.state,
        merged_at: pr.merged_at,
        created_at: pr.created_at,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
      },
    }));
}

export function normalizeReviews(
  reviews: Array<{
    review_id: number;
    pr_number: number;
    repo: string;
    state: string;
    body: string;
    occurred_at: string;
  }>,
  userId: string,
): EventRow[] {
  return reviews.map((r) => ({
    userId,
    source: 'github',
    sourceId: `${r.repo}#${r.pr_number}/review/${r.review_id}`,
    eventType: EVENT_TYPES.PR_REVIEWED,
    occurredAt: new Date(r.occurred_at),
    payload: {
      review_id: r.review_id,
      pr_number: r.pr_number,
      repo: r.repo,
      state: r.state,
    },
  }));
}
