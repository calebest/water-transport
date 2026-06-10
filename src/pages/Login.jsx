import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) { setErr("Please fill in all fields."); return; }
    setLoading(true); setErr("");
    try { await login(email, pass); }
    catch (e) { setErr(e.code === "auth/invalid-credential" ? "Invalid email or password." : e.message); }
    finally { setLoading(false); }
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 shadow-2xl shadow-emerald-500/40 mb-4">
            <span className="text-4xl">🚛</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Water Transport</h1>
          <p className="text-emerald-400 text-sm mt-1 font-medium">Fleet Management System</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Sign In</h2>
          {err && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{err}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
            <input className={inp} type="email" placeholder="admin@company.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Password</label>
            <input className={inp} type="password" placeholder="••••••••"
              value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 disabled:opacity-60 transition-all">
            {loading ? "Signing in…" : "Sign In →"}
          </button>
          <p className="text-xs text-center text-slate-400 pt-2">Contact your administrator to get access</p>
        </div>
      </div>
    </div>
  );
}
