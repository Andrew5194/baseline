import { TimezoneSetting } from '../../components/timezone-setting';
import { ExportData } from '../../components/export-data';
import { DeleteAccount } from '../../components/delete-account';

export default function Settings() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight mb-6">Settings</h1>

      <div className="space-y-4">
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <p className="text-sm font-medium mb-1">Account</p>
          <p className="text-xs text-neutral-500">
            Manage your account settings and preferences.
          </p>
        </div>

        <TimezoneSetting />

        <ExportData />

        <DeleteAccount />
      </div>
    </div>
  );
}
