'use client';

import { useState } from 'react';
import { API_URL, apiFetch } from '../../lib/api';
import { useMe } from '../../lib/me';
import { Modal } from './modal';

// Danger-zone card + confirmation modal for permanently deleting the account. Requires
// typing the account email to confirm; on success it deletes every trace of the user
// (the API cascades all data), clears the JWT session cookie, and lands on sign-in.
export function DeleteAccount() {
  const { me } = useMe();
  const email = me?.email ?? '';
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = email.length > 0 && confirm.trim().toLowerCase() === email.toLowerCase();

  async function handleDelete() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch('/v1/me', { method: 'DELETE' });
    } catch {
      setError('Something went wrong deleting your account. Please try again.');
      setDeleting(false);
      return;
    }
    // The account (and its JWT-bearing user) is gone — clear the session cookie via
    // Auth.js, then land on sign-in. Navigate regardless of the sign-out response.
    try {
      const csrfRes = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
      const { csrfToken } = await csrfRes.json();
      await fetch(`${API_URL}/api/auth/signout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrfToken }),
        credentials: 'include',
        redirect: 'manual',
      });
    } catch {
      /* fall through to the redirect */
    }
    window.location.href = '/sign-in';
  }

  return (
    <div className="p-5 rounded-xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-neutral-900">
      <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Delete account</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        Permanently delete your account and all associated data — goals, tasks, time entries,
        categories, and connected integrations. This can&apos;t be undone.
      </p>
      <button
        onClick={() => {
          setConfirm('');
          setError(null);
          setOpen(true);
        }}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
      >
        Delete account
      </button>

      {open && (
        <Modal onClose={() => !deleting && setOpen(false)}>
          <div className="w-[440px] max-w-full p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl">
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">Delete your account?</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              This permanently deletes your account and <span className="font-medium">all</span> of your data. This action cannot be undone.
            </p>
            <label className="block mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Type <span className="text-neutral-700 dark:text-neutral-200">{email || 'your email'}</span> to confirm
            </label>
            <input
              autoFocus
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
              placeholder={email}
              autoComplete="off"
              className="w-full h-10 text-sm px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
            />
            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!canDelete || deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
