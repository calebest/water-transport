import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { settingsService } from "../services/settings";

export default function SettingsPage({ settings }) {
  const { isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);

  const directApproval = !!settings?.directApproval;

  const toggleDirectApproval = async () => {
    if (!isAdmin || saving) return;
    setSaving(true);
    try {
      await settingsService.update({ directApproval: !directApproval });
    } catch (e) {
      console.error(e);
      alert("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-800">Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage system-wide approval behavior from one place.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Approvals</p>
            <h3 className="mt-1 text-base font-bold text-slate-800">Direct Approval</h3>
            <p className="mt-1 text-sm text-slate-500">
              When enabled, new trip submissions and admin edits are approved immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDirectApproval}
            disabled={!isAdmin || saving}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${directApproval ? "bg-emerald-500" : "bg-slate-300"}`}
            aria-pressed={directApproval}
            aria-label="Toggle direct approval"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${directApproval ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-700">Current status</p>
          <p className="mt-1">
            Direct approval is currently <span className="font-bold text-slate-800">{directApproval ? "enabled" : "disabled"}</span>.
          </p>
          {!isAdmin && (
            <p className="mt-2 text-xs text-slate-400">
              Only admins can change this setting.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
