export function StatCard({ label, value, icon, color = "green", sub }) {
  const colorMap = {
    green: { icon: "bg-emerald-100 text-emerald-600", glow: "bg-emerald-400" },
    red: { icon: "bg-rose-100 text-rose-600", glow: "bg-rose-400" },
    blue: { icon: "bg-blue-100 text-blue-600", glow: "bg-blue-400" },
    amber: { icon: "bg-amber-100 text-amber-600", glow: "bg-amber-400" },
    slate: { icon: "bg-slate-100 text-slate-600", glow: "bg-slate-400" },
  };
  
  const theme = colorMap[color] || colorMap.green;
  
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex min-w-0 items-start justify-between gap-3 relative z-10">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="mt-1.5 break-words text-2xl font-black tracking-tight text-slate-800">{value}</p>
          {sub && <p className="mt-1 text-xs font-medium text-slate-400">{sub}</p>}
        </div>
        <div className={`shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-transform group-hover:scale-110 ${theme.icon}`}>
          {icon}
        </div>
      </div>
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${theme.glow}`} />
    </div>
  );
}

export function Badge({ children, color = "green" }) {
  const c = {
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-100 text-slate-600"
  };
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c[color]}`}>
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className={`relative w-[calc(100vw-2rem)] max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
