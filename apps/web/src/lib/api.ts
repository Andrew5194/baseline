/**
 * Base URL for API calls from the browser. Empty by default → requests are
 * same-origin and Next.js rewrites forward them to the API (see next.config.ts).
 * Set `NEXT_PUBLIC_API_URL` only to target the API on a separate origin.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
