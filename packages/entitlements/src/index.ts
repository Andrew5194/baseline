import { db, users } from '@baseline/db';
import { eq } from 'drizzle-orm';

/**
 * What a plan unlocks.
 *
 * This module ships in the open-source repo on purpose: it is the *question*, not
 * the answer. It decides whether a user is entitled, never what a paid feature
 * does — that lives in the private Pro service. Keeping the interface open is what
 * lets open-source code call it without importing anything proprietary.
 */
export type Feature = 'max_assistant';

/** Features a paid plan unlocks. Free plans get none of them. */
const PRO_FEATURES: readonly Feature[] = ['max_assistant'];

export interface PlanState {
  plan: string;
  planExpiresAt: Date | null;
}

/**
 * Features for a plan, as a pure function so the policy is testable without a
 * database and identical everywhere it is evaluated.
 *
 * Expiry is checked here rather than by a scheduled job: a lapsed plan degrades on
 * the next request instead of waiting on a webhook or cron that might not run.
 * Consequently callers must not cache the result for long.
 */
export function featuresForPlan(state: PlanState | null, now: Date = new Date()): Set<Feature> {
  if (!state || state.plan !== 'pro') return new Set();
  if (state.planExpiresAt && state.planExpiresAt <= now) return new Set();
  return new Set(PRO_FEATURES);
}

/** Everything this user is currently entitled to. Empty for free and unknown users. */
export async function entitlements(userId: string): Promise<Set<Feature>> {
  const [row] = await db
    .select({ plan: users.plan, planExpiresAt: users.planExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  // A missing user resolves to no features rather than throwing: paid surfaces fail
  // closed, and nothing in the free tier consults this.
  return featuresForPlan(row ?? null);
}

export async function hasFeature(userId: string, feature: Feature): Promise<boolean> {
  return (await entitlements(userId)).has(feature);
}

/** Thrown when a paid surface is reached without entitlement. Carries a 402. */
export class FeatureRequiredError extends Error {
  readonly status = 402;
  readonly code = 'UPGRADE_REQUIRED';
  constructor(readonly feature: Feature) {
    super(`Baseline Pro required for: ${feature}`);
    this.name = 'FeatureRequiredError';
  }
}

export async function requireFeature(userId: string, feature: Feature): Promise<void> {
  if (!(await hasFeature(userId, feature))) throw new FeatureRequiredError(feature);
}
