#!/usr/bin/env node
/**
 * What the Google Books API will and will not tell you about your library.
 *
 * Findings from running this against a real Play Books account (2026-08-11):
 *
 *   WORKS   /volumes/mybooks?acquireMethod=PURCHASED|SAMPLE|PUBLIC_DOMAIN|...
 *           Returns real Play Books content with title, pageCount, acquiredTime.
 *           You MUST pass acquireMethod — omitting it returns totalItems: 0.
 *
 *   WORKS   /mylibrary/annotations?volumeId=...   (highlights and bookmarks)
 *
 *   EMPTY   /mylibrary/bookshelves — every built-in shelf reports 0 volumes.
 *           Play Books content does not appear here. This is the trap: it looks
 *           like an empty account rather than the wrong endpoint.
 *
 *   DEAD    /mylibrary/readingpositions/{volumeId} -> HTTP 501
 *           "Operation is not implemented, or supported, or enabled."
 *           Returned for every volume including public-domain ones, so it is
 *           switched off globally, not missing data. Still in the discovery
 *           document, which is why the docs suggest it should work.
 *
 * Conclusion: reading POSITION is unavailable. Library inventory is available.
 *
 *   GOOGLE_BOOKS_TOKEN=ya29.... node scripts/probe-google-books.mjs
 */

const TOKEN = process.env.GOOGLE_BOOKS_TOKEN;
if (!TOKEN) {
  console.error('set GOOGLE_BOOKS_TOKEN (scope https://www.googleapis.com/auth/books)');
  process.exit(1);
}

const API = 'https://books.googleapis.com/books/v1';

async function call(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* non-JSON error page */ }
  return { status: res.status, body };
}

const ACQUIRE = ['PURCHASED', 'PREORDERED', 'RENTED', 'PREVIOUSLY_RENTED',
                 'SAMPLE', 'UPLOADED', 'PUBLIC_DOMAIN', 'FAMILY_SHARED'];

console.log('\n=== library, via /volumes/mybooks ===');
const volumes = [];
for (const method of ACQUIRE) {
  const { body } = await call(`/volumes/mybooks?acquireMethod=${method}&maxResults=40`);
  const items = body?.items ?? [];
  if (!items.length) continue;
  console.log(`\n  ${method} (${body.totalItems})`);
  for (const v of items) {
    const info = v.volumeInfo ?? {};
    const user = v.userInfo ?? {};
    volumes.push({ id: v.id, title: info.title, method });
    console.log(
      `    ${(info.title ?? '?').slice(0, 52).padEnd(54)}` +
      `pages=${String(info.pageCount ?? '?').padStart(5)}  ` +
      `acquired=${(user.acquiredTime ?? '—').slice(0, 10)}`
    );
  }
}
if (!volumes.length) {
  console.log('  nothing found — check the token belongs to the account holding your books');
}

console.log('\n=== reading position (the thing we actually wanted) ===');
for (const v of volumes.slice(0, 3)) {
  const { status, body } = await call(`/mylibrary/readingpositions/${v.id}`);
  const note = status === 501 ? 'NOT IMPLEMENTED — endpoint is disabled server-side'
             : status === 200 ? JSON.stringify(body)
             : body?.error?.message ?? '';
  console.log(`  ${status}  ${(v.title ?? v.id).slice(0, 40).padEnd(42)} ${note}`);
}

console.log('\n=== annotations (highlights/bookmarks — a proxy for reading activity) ===');
let annotations = 0;
for (const v of volumes.slice(0, 5)) {
  const { status, body } = await call(`/mylibrary/annotations?volumeId=${v.id}`);
  const n = body?.totalItems ?? 0;
  annotations += n;
  console.log(`  ${status}  ${(v.title ?? v.id).slice(0, 40).padEnd(42)} ${n} annotation(s)`);
}

console.log('\n=== verdict ===');
console.log(`  ${volumes.length} volumes readable. Reading position: unavailable (501).`);
console.log(`  ${annotations} annotations found — usable as an activity signal only if you highlight as you read.`);
