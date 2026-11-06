import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { settingsService } from "../services/settings";
import { DASHBOARD_THEMES } from "../utils/dashboardThemes";
import {
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  testGeminiConnection
} from "../services/ai/geminiClient";

export default function SettingsPage({
  settings,
  onNavigateToMarketing,
  onNavigateToDashboard,
  onNavigateToAI
}) {
  const { isAdmin, isOwner } = useAuth();
  const [saving, setSaving] = useState(false);
  const [themeToast, setThemeToast] = useState("");

  // AI Assistant State
  const [geminiKey, setGeminiKey] = useState(() => getStoredApiKey());
  const [geminiModel, setGeminiModel] = useState(() => getStoredModel());
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [keyToast, setKeyToast] = useState("");

  const directApproval = !!settings?.directApproval;

  const currentThemeId = settings?.dashboardTheme || (typeof window !== "undefined" ? localStorage.getItem("wt_dashboard_theme") : "glacier") || "glacier";
  const [activeThemeId, setActiveThemeId] = useState(currentThemeId);

  const handleSaveGeminiKey = () => {
    setStoredApiKey(geminiKey);
    setKeyToast("Gemini API key saved successfully!");
    setTimeout(() => setKeyToast(""), 3500);
  };

  const handleTestConnection = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testGeminiConnection(geminiKey, geminiModel);
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, error: err.message || "Failed to reach Gemini" });
    } finally {
      setTestingKey(false);
    }
  };

  const handleModelChange = (m) => {
    setGeminiModel(m);
    setStoredModel(m);
  };

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

      {/* ── SECTION 3: BOLAS AI ASSISTANT & GOOGLE GEMINI CONFIGURATION ── */}
      <div className="rounded-3xl border border-indigo-200/90 bg-white p-6 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Bolas AI Assistant & Gemini Integration</h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Free Tier Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Powered by Google Gemini Free Tier. Fully grounded in your Supabase operational ledger with zero ongoing API subscription costs.
              </p>
            </div>
          </div>
          {onNavigateToAI && (
            <button
              type="button"
              onClick={onNavigateToAI}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <span>Open AI Assistant</span>
              <span>→</span>
            </button>
          )}
        </div>

        {keyToast && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <span>✓</span>
            <span>{keyToast}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Google Gemini API Key (Stored securely in local environment)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono transition-all"
              />
              <button
                type="button"
                onClick={handleSaveGeminiKey}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              >
                Save Key
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingKey || !geminiKey}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer border border-slate-200 disabled:opacity-50 shrink-0"
              >
                {testingKey ? "Testing..." : "Test Connection"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Get a free API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold hover:text-indigo-800">aistudio.google.com/app/apikey</a>. Free tier limits: 15 Requests/Min, 1,500 Requests/Day.
            </p>
          </div>

          {testResult && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              testResult.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}>
              <div className="flex items-center gap-2">
                <span>{testResult.ok ? "✅" : "⚠️"}</span>
                <div>
                  <p className="font-bold">{testResult.ok ? "Connection Successful!" : "Connection Failed"}</p>
                  <p className="text-[11px] opacity-90">{testResult.ok ? `Active model: ${testResult.model}. Gemini replied successfully.` : testResult.error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                AI Intelligence Model
              </label>
              <select
                value={geminiModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              >
                <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended · Fast & Smart)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (Reliable Fallback)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex flex-col justify-center">
              <span className="font-bold text-slate-800">🛡️ Financial Ledger Grounding</span>
              <span>All numbers are computed on-device from your Supabase records before passing to the model. Bolas never hallucinates financial figures.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: SYSTEM APPROVALS ── */}
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
