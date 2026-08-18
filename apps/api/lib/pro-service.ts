import { createHmac } from 'node:crypto';
import type { Feature } from '@baseline/entitlements';

/**
 * Client for the Pro service, which lives in a separate private repo.
 *
 * Core never imports Pro code — it speaks HTTP to a configured URL. With
 * PRO_SERVICE_URL unset there is no Pro service, every paid surface reports itself
 * unavailable, and the open-source build is fully functional at the free tier.
 */
export function proServiceUrl(): string | null {
  return process.env.PRO_SERVICE_URL?.replace(/\/+$/, '') || null;
}

/**
 * Short-lived signed assertion of what core has already decided.
 *
 * Deliberately not a licence: one user, seconds of life, minted per request. The
 * Pro service verifies the signature rather than trusting a bare shared secret, so
 * a leaked secret on its own does not buy unlimited inference.
 */
function signAssertion(userId: string, features: Feature[], secret: string, ttlSeconds = 60): string {
  // aud pins the direction: both sides share the secret, so without it a token
  // captured on the way out could be replayed back at core.
  const payload = { userId, features, aud: 'pro', exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export class ProUnavailableError extends Error {
  readonly code = 'PRO_UNAVAILABLE';
}

/** POST to the Pro service on behalf of an already-entitled user. */
export async function callProService<T>(
  path: string,
  userId: string,
  features: Feature[],
  body: unknown,
): Promise<T> {
  const base = proServiceUrl();
  const secret = process.env.PRO_SERVICE_SECRET;
  if (!base || !secret) throw new ProUnavailableError('Pro service not configured');

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signAssertion(userId, features, secret)}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new ProUnavailableError(`Pro service ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
