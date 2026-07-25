import { TimezoneSetting } from '../../components/timezone-setting';
import { ExportData } from '../../components/export-data';
import { DeleteAccount } from '../../components/delete-account';

export default function Settings() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight mb-6">Settings</h1>

      <div className="space-y-4">
        <div className="p-5 card-modern rise" style={{ animationDelay: '40ms' }}>
          <p className="text-sm font-medium mb-1">Account</p>
          <p className="text-xs text-neutral-500">
            Manage your account settings and preferences.
          </p>
        </div>

        <div className="rise" style={{ animationDelay: '100ms' }}>
          <TimezoneSetting />
        </div>

        <div className="rise" style={{ animationDelay: '160ms' }}>
          <ExportData />
        </div>

        <div className="rise" style={{ animationDelay: '220ms' }}>
          <DeleteAccount />
        </div>
      </div>
    </div>
  );
}
