import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { settingsService } from "../services/settings";
import { DASHBOARD_THEMES } from "../utils/dashboardThemes";

export default function SettingsPage({ settings, onNavigateToMarketing, onNavigateToDashboard }) {
  const { isAdmin, isOwner } = useAuth();
  const [saving, setSaving] = useState(false);
  const [themeToast, setThemeToast] = useState("");

  const directApproval = !!settings?.directApproval;

  const currentThemeId = settings?.dashboardTheme || (typeof window !== "undefined" ? localStorage.getItem("wt_dashboard_theme") : "glacier") || "glacier";
  const [activeThemeId, setActiveThemeId] = useState(currentThemeId);

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

  const handleSelectTheme = async (themeId) => {
    setActiveThemeId(themeId);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("wt_dashboard_theme", themeId);
      } catch (e) {}
    }

    const selectedTheme = DASHBOARD_THEMES.find(t => t.id === themeId);
    setThemeToast(`Active theme set to "${selectedTheme?.name || themeId}"!`);
    setTimeout(() => setThemeToast(""), 4000);

    if (isAdmin || isOwner) {
      try {
        await settingsService.update({ dashboardTheme: themeId });
      } catch (err) {
        console.warn("Could not sync theme to database:", err);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">System Settings & Customization</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure system approvals, customize your visual dashboard theme, and manage business marketing assets.
          </p>
        </div>
      </div>

      {/* Toast Notification when Theme Changes */}
      {themeToast && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🎨</span>
            <span className="text-xs sm:text-sm font-bold">{themeToast}</span>
          </div>
          {onNavigateToDashboard && (
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            >
              View on Dashboard →
            </button>
          )}
        </div>
      )}

      {/* ── SECTION 1: DASHBOARD COLOR & APPEARANCE THEMES ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <h3 className="text-base font-bold text-slate-900">Dashboard Color & Appearance Theme</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose your favorite visual style for the operations dashboard. Option 1 (Alpine Glacier) is active by default.
            </p>
          </div>
          {onNavigateToDashboard && (
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 cursor-pointer self-start sm:self-auto"
            >
              <span>Preview Dashboard</span>
              <span>→</span>
            </button>
          )}
        </div>

        {/* 4 Theme Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DASHBOARD_THEMES.map((theme) => {
            const isSelected = activeThemeId === theme.id;
            return (
              <div
                key={theme.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectTheme(theme.id)}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between text-left relative overflow-hidden group ${
                  isSelected
                    ? "border-sky-500 bg-sky-50/40 shadow-md ring-2 ring-sky-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs"
                }`}
              >
                <div>
                  {/* Swatches preview ribbon */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      {theme.swatches.map((color, i) => (
                        <span
                          key={i}
                          className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    {theme.isDefault ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                        Default
                      </span>
                    ) : theme.id === "executive-dark" ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">
                        Dark Mode
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Light Mode
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-sky-950">
                    {theme.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {theme.vibe}
                  </p>
                </div>

                {/* Bottom Action / Active Badge */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isSelected ? "Currently Active" : "Click to activate"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTheme(theme.id);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-sky-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {isSelected ? "✓ Active" : "Select Theme"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: MARKETING & PROMOTIONAL ASSETS ── */}
      {onNavigateToMarketing && (
        <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/70 via-blue-50/40 to-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
                📇
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-700 block">
                  Branding & Marketing Studio
                </span>
                <h3 className="text-base font-bold text-slate-800 mt-0.5">
                  Business Card & Promotional Poster Generator
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                  Create beautiful, fully customized business cards (with 8-card A4 print sheets, passport photos, and QR codes) and promotional posters for Mount Kenya Water Distributors.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToMarketing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-sky-600/30 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
            >
              <span>Open Studio</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* ── SECTION 3: SYSTEM APPROVALS ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Trip Approvals</p>
            <h3 className="mt-1 text-base font-bold text-slate-800">Direct Approval Workflow</h3>
            <p className="mt-1 text-sm text-slate-500">
              When enabled, new trip submissions and dispatcher edits are approved immediately into the financial ledger.
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

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 border border-slate-100">
          <p className="font-semibold text-slate-700">Current Approval Mode</p>
          <p className="mt-0.5 text-xs">
            Direct approval is currently <span className="font-bold text-slate-800">{directApproval ? "enabled (Auto-approve on entry)" : "disabled (Manual review required)"}</span>.
          </p>
          {!isAdmin && (
            <p className="mt-2 text-xs text-slate-400">
              Only administrator or director accounts can modify approval settings.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
