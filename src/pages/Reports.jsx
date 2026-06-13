import { useState, useMemo } from "react";
import { today, getWeekRange, getMonthRange, filterByRange, summarize, collectExpenseKeys, sumExpenseKey, fmt } from "../utils/helpers";
import { exportCSV, exportPDF, handleShareText } from "../utils/export";
import { StatCard } from "../components/ui";

export default function ReportsPage({ trips, vehicles }) {
  const [range, setRange] = useState("daily");
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());
  const [filterVehicle, setFilterVehicle] = useState("All Vehicles");

  const rangeTrips = useMemo(() => {
    let filtered = trips;
    if (filterVehicle !== "All Vehicles") {
      filtered = filtered.filter(t => t.lorry === filterVehicle);
    }
    if (range === "daily") return filterByRange(filtered, today(), today());
    if (range === "weekly") { const [s, e] = getWeekRange(); return filterByRange(filtered, s, e); }
    if (range === "monthly") { const [s, e] = getMonthRange(); return filterByRange(filtered, s, e); }
    return filterByRange(filtered, customStart, customEnd);
  }, [trips, range, customStart, customEnd, filterVehicle]);

  const sum = useMemo(() => summarize(rangeTrips), [rangeTrips]);

  // Identify all unique vehicles that have trips in this filtered range
  const activeLorryPlates = useMemo(() => {
    return [...new Set(rangeTrips.map(t => t.lorry))].sort();
  }, [rangeTrips]);

  const { fixed, custom: customLabels } = useMemo(() => collectExpenseKeys(rangeTrips), [rangeTrips]);

  const dateTitle = range === "custom"
    ? `${customStart} to ${customEnd}`
    : `${range.charAt(0).toUpperCase() + range.slice(1)}`;
    
  const title = `${dateTitle} Report${filterVehicle !== "All Vehicles" ? ` - ${filterVehicle}` : ""}`;

  const btnCls = (v) =>
    `px-4 py-2 rounded-xl text-sm font-bold transition-all ${range === v
      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-black text-slate-800">Reports</h2>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {["daily", "weekly", "monthly", "custom"].map(v => (
            <button key={v} className={btnCls(v)} onClick={() => setRange(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <select 
          value={filterVehicle} 
          onChange={e => setFilterVehicle(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none"
        >
          <option value="All Vehicles">All Vehicles</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.plate}>{v.plate} ({v.name})</option>
          ))}
        </select>
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

      {filterVehicle === "All Vehicles" && activeLorryPlates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeLorryPlates.map(plate => {
            const vehSum = summarize(rangeTrips.filter(t => t.lorry === plate));
            return (
              <div key={plate} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{plate}</p>
                <p className="text-lg font-black text-slate-800">{fmt(vehSum.profit)}</p>
                <p className="text-xs text-slate-500 mt-1">{vehSum.count} trips · Rev {fmt(vehSum.revenue)} · Exp {fmt(vehSum.expenses)}</p>
              </div>
            );
          })}
        </div>
      )}

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
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => exportCSV(rangeTrips, title.replace(/\s+/g, "-"))}
            className="flex-1 rounded-xl border-2 border-emerald-600 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-colors">
            ⬇ Export CSV
          </button>
          <button onClick={() => exportPDF(rangeTrips, title)}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
            📄 Export PDF
          </button>
          <button onClick={() => handleShareText(rangeTrips, filterVehicle, dateTitle)}
            className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white shadow-lg shadow-slate-800/20 hover:bg-slate-900 transition-colors">
            💬 Share Text
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
