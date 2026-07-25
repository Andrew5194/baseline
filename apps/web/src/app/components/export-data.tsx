'use client';

import { useState } from 'react';
import { apiFetch } from '../../lib/api';

// Downloads the user's full data (from GET /v1/me/export) as a JSON file, built client-
// side from the response so nothing is stored server-side.
export function ExportData() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const data = await apiFetch<unknown>('/v1/me/export', { noCache: true });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `baseline-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Something went wrong exporting your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-5 card-modern">
      <p className="text-sm font-medium mb-1">Export data</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        Download all your data as a JSON file.
      </p>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
      >
        {exporting ? 'Exporting…' : 'Export data'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
