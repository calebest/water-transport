import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const OWNER_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "financials", label: "Financials", icon: "💰" },
  { id: "fleet", label: "Fleet", icon: "🚚" },
  { id: "drivers", label: "Drivers", icon: "👤" },
  { id: "routes", label: "Routes", icon: "📍" },
  { id: "approvals", label: "Approvals", icon: "✅" },
  { id: "alerts", label: "Alerts", icon: "🚨" },
];

export default function OwnerLayout({ children, page, setPage }) {
  const { profile, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar / Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 shadow-2xl lg:shadow-sm transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-xl shadow">👑</div>
            <div>
              <p className="text-sm font-black text-white leading-tight">Water Transport</p>
              <p className="text-xs font-bold text-amber-500 mt-0.5 tracking-wider">◆ OWNER</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {OWNER_NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => { setPage(n.id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${page === n.id ? "bg-amber-500 text-slate-900 shadow-md shadow-amber-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}>
              <span>{n.icon}</span>
              <span className="flex-1 text-left">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="rounded-xl bg-slate-800 p-3 mb-3">
            <p className="text-xs font-bold text-white truncate">{profile?.name || "Owner"}</p>
            <p className="text-[10px] text-amber-500 uppercase tracking-wider font-bold">Business Owner</p>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-900/30 hover:text-rose-300 transition-colors">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-slate-900 text-white shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center text-sm shadow">👑</div>
            <div>
              <p className="text-sm font-black leading-tight">Water Transport</p>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -mr-2 text-slate-300">
            ☰
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto pb-20 lg:pb-0">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-between px-2 py-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 overflow-x-auto hide-scrollbar">
          {OWNER_NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`flex flex-col items-center justify-center min-w-[64px] px-1 py-1 rounded-lg transition-colors ${page === n.id ? "text-amber-500" : "text-slate-500 hover:text-slate-300"}`}>
              <span className="text-xl mb-0.5">{n.icon}</span>
              <span className="text-[10px] font-bold">{n.label}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
