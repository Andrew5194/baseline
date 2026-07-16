'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { colorForCategory } from '../../lib/categories';
import { Modal } from './modal';

interface Cat {
  id: string;
  name: string;
  color: string | null;
  count: number;
  in_use: boolean;
  is_default: boolean;
}

type LinkedItem = {
  type: string;
  label: string;
  date: string;
  schedule: string;
  hours: string;
  status: string;
  durationMs: number;
};

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

// A modal to create categories and manage their colors. Categories are real rows
// (seeded with defaults on signup); every one — default or custom — can be deleted.
// Deleting uncategorizes anything linked to it (goals/tasks/allocations/time entries)
// rather than removing those items.
export function ManageCategoriesModal({ onChange }: { onChange: () => void }) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#10b981');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState<Cat | null>(null);
  const [viewing, setViewing] = useState<Cat | null>(null);
  const [linked, setLinked] = useState<LinkedItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    try {
      const c = await apiFetch<{ categories: Cat[] }>('/v1/categories');
      setCats(c.categories ?? []);
    } catch (e) {
      console.error(e);
      setError('Could not refresh categories');
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  // Refresh when categories/colors change elsewhere on the same page (e.g. a
  // recolor from the budget donut) so this panel's swatches don't go stale.
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('baseline:categories-changed', onChanged);
    return () => window.removeEventListener('baseline:categories-changed', onChanged);
  }, [load]);

  const colorOf = (c: Cat) => c.color ?? colorForCategory(c.name);

  async function recolor(c: Cat, color: string) {
    setCats((list) => list.map((x) => (x.id === c.id ? { ...x, color } : x)));
    await apiFetch('/v1/category-colors', { method: 'PUT', body: JSON.stringify({ category: c.name, color }) }).catch(console.error);
    onChange();
  }

  function startEdit(c: Cat) {
    setError('');
    setEditName(c.name);
    setEditingId(c.id);
  }

  async function saveRename(c: Cat) {
    const name = editName.trim();
    if (!name || name === c.name) {
      setEditingId(null);
      return;
    }
    if (cats.some((x) => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) {
      setError('That category already exists');
      return;
    }
    // Optimistic: show the new name and close the editor immediately (mirrors the
    // optimistic recolor above); reconcile via load(). Roll back on failure.
    const prev = cats;
    setEditingId(null);
    setCats((list) => list.map((x) => (x.id === c.id ? { ...x, name } : x)));
    try {
      await apiFetch(`/v1/categories?id=${encodeURIComponent(c.id)}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      await load();
      onChange();
    } catch (e) {
      console.error(e);
      setCats(prev);
      setError('Could not rename the category');
    }
  }

  // Fetch the specific items linked to a category (shared by the confirm + view modals).
  async function loadItems(c: Cat) {
    setLinked(c.count > 0 ? null : []);
    if (c.count === 0) return;
    try {
      const r = await apiFetch<{ items: LinkedItem[] }>(`/v1/categories/${c.id}/items`);
      setLinked(r.items ?? []);
    } catch (e) {
      console.error(e);
      setLinked([]);
    }
  }

  function openConfirm(c: Cat) {
    setError('');
    setConfirming(c);
    loadItems(c);
  }

  function openView(c: Cat) {
    setViewing(c);
    loadItems(c);
  }

  async function confirmDelete() {
    if (!confirming) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/v1/categories?id=${encodeURIComponent(confirming.id)}`, { method: 'DELETE' });
      setConfirming(null);
      setLinked(null);
      await load();
      onChange();
    } catch (e) {
      console.error(e);
      setError('Could not delete the category');
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const name = newName.trim();
    if (!name) return setError('Enter a category name');
    if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) return setError('That category already exists');
    try {
      await apiFetch('/v1/categories', { method: 'POST', body: JSON.stringify({ name, color: newColor }) });
      setNewName('');
      setNewColor('#10b981');
      await load();
      onChange();
    } catch (err) {
      console.error(err);
      setError('Could not save the category');
    }
  }

  return (
    <div className="w-full p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Manage categories</h2>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
        Create categories and set their colors. Time tracked on goals and tasks rolls up into these.
      </p>

      <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 divide-y divide-neutral-100 dark:divide-neutral-800">
        {!loaded ? (
          <div className="space-y-2 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-7 bg-neutral-100 dark:bg-neutral-800 rounded shimmer" />
            ))}
          </div>
        ) : cats.length === 0 ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 py-3">No categories yet — add one below.</p>
        ) : (
          cats.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 group">
              <label className="relative w-4 h-4 flex-shrink-0 cursor-pointer" title={`Change ${c.name} color`}>
                <span className="block w-4 h-4 rounded" style={{ backgroundColor: colorOf(c) }} />
                <input
                  type="color"
                  aria-label={`Color for ${c.name}`}
                  value={colorOf(c)}
                  onChange={(e) => recolor(c, e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
              {editingId === c.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(c);
                    else if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => setEditingId(null)}
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-emerald-500/50 bg-white dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              ) : (
                <span className="text-sm text-neutral-800 dark:text-neutral-200 flex-1 min-w-0 truncate">{c.name}</span>
              )}
              {c.is_default && (
                <span className="text-[9px] font-medium tracking-wide text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-full px-1.5 py-px shrink-0">
                  Default
                </span>
              )}
              {c.count > 0 ? (
                <button
                  onClick={() => openView(c)}
                  title="View linked items"
                  className="text-[10px] text-neutral-400 dark:text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors"
                >
                  {c.count} linked
                </button>
              ) : (
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">unused</span>
              )}
              <button
                onClick={() => startEdit(c)}
                aria-label={`Rename ${c.name}`}
                className="text-neutral-300 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => openConfirm(c)}
                aria-label={`Delete ${c.name}`}
                className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={create} className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">New category</label>
        <div className="flex items-center gap-2">
          <label className="relative w-9 h-9 flex-shrink-0 cursor-pointer rounded-lg border border-neutral-200 dark:border-neutral-700" title="Pick a color">
            <span className="absolute inset-1 rounded" style={{ backgroundColor: newColor }} />
            <input type="color" aria-label="New category color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Errands" className={`${inputClass} flex-1`} />
          <button type="submit" className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors">
            Add
          </button>
        </div>
        {error && !confirming && <p className="text-xs text-red-500">{error}</p>}
      </form>

      {confirming && (
        <Modal onClose={() => { if (!busy) { setConfirming(null); setLinked(null); setError(''); } }}>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-6">
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
              Delete “{confirming.name}”?
            </h2>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {confirming.count > 0 ? (
                <>
                  This category is linked to{' '}
                  <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                    {confirming.count} item{confirming.count === 1 ? '' : 's'}
                  </span>
                  . Deleting it will leave {confirming.count === 1 ? 'it' : 'them'} uncategorized — the {confirming.count === 1 ? 'item' : 'items'} won’t be removed.
                </>
              ) : (
                <>This category isn’t used anywhere, so nothing else changes.</>
              )}
            </p>
            {confirming.count > 0 && <LinkedItems items={linked} />}
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirming(null);
                  setLinked(null);
                  setError('');
                }}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal onClose={() => { setViewing(null); setLinked(null); }}>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-6">
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
              Linked to “{viewing.name}”
            </h2>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              {viewing.count} item{viewing.count === 1 ? '' : 's'} use this category.
            </p>
            <LinkedItems items={linked} />
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => {
                  setViewing(null);
                  setLinked(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Scrollable list of the items linked to a category. `items` is null while loading.
const LINKED_COLS: { label: string; field: keyof LinkedItem }[] = [
  { label: 'Type', field: 'type' },
  { label: 'Item', field: 'label' },
  { label: 'Date', field: 'date' },
  { label: 'Recurs', field: 'schedule' },
  { label: 'Duration', field: 'hours' },
  { label: 'Status', field: 'status' },
];

function LinkedItems({ items }: { items: LinkedItem[] | null }) {
  const [sortField, setSortField] = useState<keyof LinkedItem | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const th = 'px-3 py-2 font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-700 cursor-pointer select-none transition-colors';
  const td = 'px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap';

  function toggleSort(field: keyof LinkedItem) {
    if (sortField === field) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortField(field);
      setSortDir(1);
    }
  }

  const sorted =
    items && sortField
      ? [...items].sort((a, b) => {
          if (sortField === 'hours') return (a.durationMs - b.durationMs) * sortDir; // Duration sorts by raw ms
          const av = String(a[sortField]);
          const bv = String(b[sortField]);
          if (!av && bv) return 1; // blanks to the bottom
          if (av && !bv) return -1;
          return av.localeCompare(bv) * sortDir;
        })
      : items ?? [];

  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      {items === null ? (
        <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500">Loading items…</div>
      ) : items.length === 0 ? (
        <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500">No items found.</div>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {LINKED_COLS.map((c) => (
                <th key={c.field} className={th} onClick={() => toggleSort(c.field)}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <span className="text-neutral-400 dark:text-neutral-500">{sortField === c.field ? (sortDir === 1 ? '↑' : '↓') : ''}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sorted.map((it, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500 whitespace-nowrap align-top">{it.type}</td>
                <td className="px-3 py-1.5 text-neutral-700 dark:text-neutral-200 whitespace-nowrap">{it.label}</td>
                <td className={td}>{it.date}</td>
                <td className={td}>{it.schedule}</td>
                <td className={td}>{it.hours}</td>
                <td className={td}>{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
