import { useState, useMemo } from "react";
import { today, getWeekRange, getMonthRange, filterByRange, summarize, collectExpenseKeys, sumExpenseKey, fmt } from "../utils/helpers";
import { exportCSV, exportPDF } from "../utils/export";
import { StatCard } from "../components/ui";

export default function ReportsPage({ trips }) {
  const [range, setRange] = useState("daily");
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());

  const rangeTrips = useMemo(() => {
    if (range === "daily") return filterByRange(trips, today(), today());
    if (range === "weekly") { const [s, e] = getWeekRange(); return filterByRange(trips, s, e); }
    if (range === "monthly") { const [s, e] = getMonthRange(); return filterByRange(trips, s, e); }
    return filterByRange(trips, customStart, customEnd);
  }, [trips, range, customStart, customEnd]);

  const sum = useMemo(() => summarize(rangeTrips), [rangeTrips]);
  const kbzSum = useMemo(() => summarize(rangeTrips.filter(t => t.lorry === "KBZ")), [rangeTrips]);
  const kblSum = useMemo(() => summarize(rangeTrips.filter(t => t.lorry === "KBL")), [rangeTrips]);

  const { fixed, custom: customLabels } = useMemo(() => collectExpenseKeys(rangeTrips), [rangeTrips]);

  const title = range === "custom"
    ? `Report ${customStart} to ${customEnd}`
    : `${range.charAt(0).toUpperCase() + range.slice(1)} Report`;

  const btnCls = (v) =>
    `px-4 py-2 rounded-xl text-sm font-bold transition-all ${range === v
      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-black text-slate-800">Reports</h2>

      <div className="flex flex-wrap gap-2">
        {["daily", "weekly", "monthly", "custom"].map(v => (
          <button key={v} className={btnCls(v)} onClick={() => setRange(v)}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">From</label>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">To</label>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={fmt(sum.revenue)} icon="💰" color="blue" />
        <StatCard label="Expenses" value={fmt(sum.expenses)} icon="📉" color="red" />
        <StatCard label="Profit" value={fmt(sum.profit)} icon="📈" color="green" />
        <StatCard label="Trips" value={sum.count} icon="🚛" color="amber" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">KBZ</p>
          <p className="text-lg font-black text-slate-800">{fmt(kbzSum.profit)}</p>
          <p className="text-xs text-slate-500">{kbzSum.count} trips · Rev {fmt(kbzSum.revenue)} · Exp {fmt(kbzSum.expenses)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">KBL</p>
          <p className="text-lg font-black text-slate-800">{fmt(kblSum.profit)}</p>
          <p className="text-xs text-slate-500">{kblSum.count} trips · Rev {fmt(kblSum.revenue)} · Exp {fmt(kblSum.expenses)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-4">Expense Breakdown</p>
        {[...fixed.map(k => ({ key: k, isCustom: false })),
        ...customLabels.map(k => ({ key: k, isCustom: true }))]
          .map(({ key, isCustom }) => {
            const total = sumExpenseKey(rangeTrips, key, isCustom);
            const pct = sum.expenses > 0 ? (total / sum.expenses * 100).toFixed(1) : 0;
            return (
              <div key={key} className="flex items-center gap-3 mb-2">
                <span className="w-24 text-xs font-semibold capitalize text-slate-500 flex items-center gap-1">
                  {key}
                  {isCustom && (
                    <span className="rounded bg-emerald-100 px-1 text-emerald-600 text-[9px] font-bold">custom</span>
                  )}
                </span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-28 text-right text-xs font-bold text-slate-700">{fmt(total)}</span>
                <span className="w-10 text-right text-xs text-slate-400">{pct}%</span>
              </div>
            );
          })}
        {[...fixed, ...customLabels].length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No expense data in this period</p>
        )}
      </div>

      {rangeTrips.length > 0 ? (
        <div className="flex gap-3">
          <button onClick={() => exportCSV(rangeTrips, title.replace(/\s+/g, "-"))}
            className="flex-1 rounded-xl border-2 border-emerald-600 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-colors">
            ⬇ Export CSV
          </button>
          <button onClick={() => exportPDF(rangeTrips, title)}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
            📄 Export PDF
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
          No trips in this period
        </div>
      )}
    </div>
  );
}
