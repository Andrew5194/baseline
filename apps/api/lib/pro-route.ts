import { NextResponse } from 'next/server';
import { entitlements, type Feature } from '@baseline/entitlements';
import { getCurrentUserId } from './user';
import { callProService, proServiceUrl, ProUnavailableError } from './pro-service';

/**
 * A route that hands work to the Pro service.
 *
 * Every paid surface answers the same three questions in the same order — does this
 * deployment have a Pro service, is this user entitled, did the call succeed — and
 * every one of them must answer identically. Written out per route, the fourth
 * feature is where one of them quietly gets it wrong.
 *
 * The gates run before the body is read, so an unentitled caller gets 402 rather
 * than a complaint about their JSON.
 */
export async function proxyToPro(
  feature: Feature,
  path: string,
  /** Omit for a read. Called only after the gates pass. */
  readBody?: () => Promise<unknown>,
  /** Runs after a successful call, before responding. Failures here are logged,
   *  never surfaced: a bookkeeping problem must not lose the user their answer. */
  onSuccess?: (result: unknown, userId: string, body: unknown) => Promise<void>,
): Promise<NextResponse> {
  const userId = await getCurrentUserId();

  if (!proServiceUrl()) {
    return NextResponse.json(
      { error: 'This feature is not available on this deployment', code: 'PRO_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const features = await entitlements(userId);
  if (!features.has(feature)) {
    return NextResponse.json({ error: 'Baseline Pro required', code: 'UPGRADE_REQUIRED' }, { status: 402 });
  }

  let body: unknown;
  if (readBody) {
    try {
      body = await readBody();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }
  }

  try {
    const result = await callProService(path, userId, [...features], body);
    if (onSuccess) {
      try {
        await onSuccess(result, userId, body);
      } catch (err) {
        console.error(`post-call hook failed on ${path}:`, err instanceof Error ? err.message : err);
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProUnavailableError) {
      // The message can carry the upstream body, so it is logged and not returned.
      console.error(`pro service call failed on ${path}:`, err.message);
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable', code: 'PRO_UNAVAILABLE' },
        { status: 503 },
      );
    }
    throw err;
  }
}
