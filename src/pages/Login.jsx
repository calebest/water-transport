import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import bgImage from '../images/bg.png';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) { setErr("Please fill in all fields."); return; }
    setLoading(true); setErr("");
    try { await login(email, pass); }
    catch (e) { setErr(e.code === "auth/invalid-credential" ? "Invalid email or password." : e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative w-full flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/65 to-emerald-900/60" />

      {/* Animated floating orbs */}
      <div className="absolute top-[-5%] right-[10%] w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-5%] left-[5%] w-80 h-80 bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.2s' }} />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-8 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 min-h-screen py-10 lg:py-0">

        {/* Left: Branding (desktop only) */}
        <div className="hidden lg:flex flex-col flex-1 text-white max-w-lg">
          {/* Logo + Name */}
          <div className="inline-flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/80 border border-emerald-400/30 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-emerald-900/40">
              <span className="text-2xl">🚛</span>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-emerald-400 uppercase">Mount Kenya</p>
              <span className="text-lg font-black text-white leading-none">Water Distributors</span>
            </div>
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-6 drop-shadow-lg">
            Smarter fleet management, built for the road.
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed mb-10">
            A powerful platform to manage trips, track vehicles, monitor personnel earnings, and generate financial reports — all in one place.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center mb-3 text-xl">🚚</div>
              <h4 className="font-bold text-white mb-1">Trip Tracking</h4>
              <p className="text-sm text-slate-300">Log, review and manage every trip in real time.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center mb-3 text-xl">📊</div>
              <h4 className="font-bold text-white mb-1">Financial Reports</h4>
              <p className="text-sm text-slate-300">Export detailed PDF & CSV reports instantly.</p>
            </div>
          </div>
        </div>

        {/* Right: Glass Login Card */}
        <div className="w-full max-w-[420px] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl p-8 sm:p-10">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:items-start">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/90 shadow-xl mb-5 backdrop-blur-sm">
              <span className="text-2xl">🚛</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white text-center lg:text-left">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-300 font-medium text-center lg:text-left">
              Sign in to Mount Kenya Water Distributors
            </p>
          </div>

          {err && (
            <div className="mb-5 rounded-xl bg-rose-500/20 border border-rose-500/50 px-4 py-2.5 text-sm text-rose-200 flex items-center gap-2">
              <span>⚠️</span> {err}
            </div>
          )}

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200 block">Email address</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  disabled={loading}
                  className="w-full pl-9 pr-4 h-11 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent backdrop-blur-sm transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-200 block">Password</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  disabled={loading}
                  className="w-full pl-9 pr-10 h-11 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent backdrop-blur-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-12 mt-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-900/50 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Signing in...
              </>
            ) : "Sign in"}
          </button>

          <p className="text-center text-slate-400/80 text-xs mt-8">
            © {new Date().getFullYear()} Mount Kenya Water Distributors · All rights reserved<br />
            Designed by <span className="text-emerald-400">Cyber Vision Lab</span>
          </p>
        </div>
      </div>
    </div>
  );
}
