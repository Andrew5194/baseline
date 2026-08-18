import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Assertions signed with the shared Pro secret, in both directions.
 *
 * Core mints them for the Pro service (aud "pro"); the Pro service mints them to
 * read the user's data back out of core on their behalf (aud "core"). Both sides
 * hold the same secret, so `aud` is what stops a token captured in one direction
 * being replayed in the other.
 */
export interface ServiceAssertion {
  userId: string;
  features: string[];
  /** Who the token is for: "pro" or "core". */
  aud: string;
  /** Unix seconds. */
  exp: number;
}

export class ServiceAuthError extends Error {}

export function verifyServiceAssertion(
  token: string,
  secret: string,
  expectedAud: string,
  now: number = Date.now(),
): ServiceAssertion {
  const [body, mac] = token.split('.');
  if (!body || !mac) throw new ServiceAuthError('malformed token');

  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  // Constant time, and only when lengths match — timingSafeEqual throws on a
  // length mismatch, which would itself leak.
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ServiceAuthError('bad signature');

  let payload: ServiceAssertion;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    throw new ServiceAuthError('malformed payload');
  }

  if (payload.aud !== expectedAud) throw new ServiceAuthError('wrong audience');
  if (!payload.userId) throw new ServiceAuthError('no subject');
  if (!payload.exp || payload.exp * 1000 <= now) throw new ServiceAuthError('expired');

  return payload;
}

/** Bearer token from an Authorization header, or null. */
export function bearer(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}
