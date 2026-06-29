'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { PRESET_CATEGORIES, buildColorMap, colorForCategory } from '../../lib/categories';

interface Cat {
  name: string;
  in_use: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

// A modal to create categories and manage their colors. Categories are registered
// via the color-overrides table (which doubles as the registry), so a created
// category shows up in the pickers and donut even before it's used.
export function ManageCategoriesModal({ onChange }: { onChange: () => void }) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#10b981');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, col] = await Promise.all([
        apiFetch<{ categories: Cat[] }>('/v1/categories'),
        apiFetch<{ colors: Record<string, string> }>('/v1/category-colors'),
      ]);
      setCats(c.categories ?? []);
      setColors(col.colors ?? {});
    } catch (e) {
      // Keep whatever is already on screen rather than blanking the list.
      console.error(e);
      setError('Could not refresh categories');
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const inUseOf = new Map(cats.map((c) => [c.name, c.in_use]));
  // Presets are always manageable; the rest come from usage/registry.
  const names = [...new Set([...PRESET_CATEGORIES, ...cats.map((c) => c.name)])].sort((a, b) => a.localeCompare(b));
  const colorMap = buildColorMap(names, colors);
  const colorOf = (n: string) => colors[n] ?? colorMap[n] ?? colorForCategory(n, colors);

  async function recolor(name: string, color: string) {
    setColors((m) => ({ ...m, [name]: color }));
    await apiFetch('/v1/category-colors', { method: 'PUT', body: JSON.stringify({ category: name, color }) }).catch(console.error);
    onChange();
  }

  async function remove(name: string) {
    await apiFetch(`/v1/category-colors?category=${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(console.error);
    await load();
    onChange();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const name = newName.trim();
    if (!name) return setError('Enter a category name');
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return setError('That category already exists');
    const color = newColor;
    // Show it right away, then persist + reconcile.
    setCats((prev) => [...prev, { name, in_use: false }]);
    setColors((prev) => ({ ...prev, [name]: color }));
    setNewName('');
    setNewColor('#10b981');
    try {
      await apiFetch('/v1/category-colors', { method: 'PUT', body: JSON.stringify({ category: name, color }) });
      onChange();
    } catch (err) {
      console.error(err);
      setError('Could not save the category');
    }
    await load();
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
        ) : (
          names.map((name) => {
            const isPreset = PRESET_CATEGORIES.includes(name);
            const inUse = inUseOf.get(name) === true;
            const removable = !isPreset && !inUse;
            return (
              <div key={name} className="flex items-center gap-3 py-2 group">
                <label className="relative w-4 h-4 flex-shrink-0 cursor-pointer" title={`Change ${name} color`}>
                  <span className="block w-4 h-4 rounded" style={{ backgroundColor: colorOf(name) }} />
                  <input
                    type="color"
                    aria-label={`Color for ${name}`}
                    value={colorOf(name)}
                    onChange={(e) => recolor(name, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
                <span className="text-sm text-neutral-800 dark:text-neutral-200 flex-1 truncate">{name}</span>
                {isPreset ? (
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">preset</span>
                ) : inUse ? (
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">in use</span>
                ) : (
                  <span className="text-[10px] text-emerald-500">new</span>
                )}
                {removable && (
                  <button
                    onClick={() => remove(name)}
                    aria-label={`Delete ${name}`}
                    className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
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
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>
    </div>
  );
}
