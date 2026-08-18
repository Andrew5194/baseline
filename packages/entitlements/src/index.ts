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

/**
 * Where a user's plan is read from.
 *
 * Hosted, the plan is a row in a database we control, so the row is the truth. A
 * self-hosted deployment owns its own database and could simply set plan='pro', so
 * there the truth has to be something it cannot mint — a signed licence.
 *
 * Only the lookup is swappable. featuresForPlan stays the single policy, so what a
 * plan unlocks cannot drift between deployments.
 *
 * A licence-backed source belongs in the proprietary build, not here: this package
 * is AGPL, and a check shipped under a licence granting the right to modify it is a
 * check the customer may lawfully remove. Core may read a licence to display it;
 * only the Pro service may rely on one.
 */
export type PlanSource = (userId: string) => Promise<PlanState | null>;

/** The default: the plan is whatever our own database says it is. */
export const hostedPlanSource: PlanSource = async (userId) => {
  const [row] = await db
    .select({ plan: users.plan, planExpiresAt: users.planExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
};

let planSource: PlanSource = hostedPlanSource;

/**
 * Install a different source of truth. Call once at startup, before serving: the
 * source is read per request, so swapping it mid-flight would change the answer
 * for requests already in progress.
 */
export function setPlanSource(source: PlanSource): void {
  planSource = source;
}

/** Everything this user is currently entitled to. Empty for free and unknown users. */
export async function entitlements(userId: string): Promise<Set<Feature>> {
  // A missing user resolves to no features rather than throwing: paid surfaces fail
  // closed, and nothing in the free tier consults this.
  return featuresForPlan(await planSource(userId));
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
