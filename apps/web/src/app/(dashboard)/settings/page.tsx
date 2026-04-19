export default function Settings() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight mb-6">Settings</h1>

      <div className="space-y-4">
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <p className="text-sm font-medium mb-1">Account</p>
          <p className="text-xs text-neutral-500">
            Manage your account settings and preferences.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium">Export data</p>
            <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            Download all your data as JSON.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium">Delete account</p>
            <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            Permanently delete your account and all associated data.
          </p>
        </div>
      </div>
    </div>
  );
}
