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

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 pr-11";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
      {/* Background Image with slight scale for premium feel */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Elegant Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/70 to-emerald-900/80 backdrop-blur-[6px]" />

      {/* Main Content Container */}
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
        
        {/* Header / Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] mb-4 ring-2 ring-white/10">
            <span className="text-3xl">🚛</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">Water Transport</h1>
          <p className="text-emerald-400 text-xs mt-1.5 font-bold tracking-widest uppercase drop-shadow-sm">Fleet Management</p>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-5">Welcome Back</h2>
          
          {err && (
            <div className="mb-5 rounded-xl bg-rose-500/20 border border-rose-500/50 px-4 py-2.5 text-sm text-rose-200 backdrop-blur-sm flex items-center gap-2">
              <span>⚠️</span> {err}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-slate-300 uppercase mb-1.5">Email Address</label>
              <input 
                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-400 focus:bg-white/10 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all shadow-inner" 
                type="email" 
                placeholder="admin@company.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} 
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-slate-300 uppercase mb-1.5">Password</label>
              <div className="relative">
                <input 
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-400 focus:bg-white/10 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 pr-12 transition-all shadow-inner" 
                  type={showPass ? "text" : "password"} 
                  placeholder="••••••••"
                  value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} 
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button onClick={handleLogin} disabled={loading}
            className="w-full mt-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]">
            {loading ? "Authenticating…" : "Sign In →"}
          </button>
          
          <div className="mt-6 text-center">
            <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
              Designed by <span className="text-emerald-400">Cyber Vision Lab</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
