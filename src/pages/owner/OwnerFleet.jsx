import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getMonthRange, filterByRange, summarize, fmt, fmtN } from "../../utils/helpers";
import { Badge } from "../../components/ui";

export default function OwnerFleetPage({ trips, vehicles, targets }) {
  const [monthStart, monthEnd] = getMonthRange();
  const currentMonthStr = monthStart.slice(0, 7);

  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);

  // Target Cards Logic
  const getVehicleTargetData = (plate) => {
    const lTrips = monthTrips.filter(t => t.lorry === plate);
    const lSummary = summarize(lTrips);
    const tObj = targets.find(t => t.lorry === plate && t.month === currentMonthStr);
    const targetVal = tObj?.target || 0;
    const pct = targetVal ? (lSummary.revenue / targetVal) * 100 : 0;
    
    const lastTrip = trips.filter(t => t.lorry === plate)[0];
    const idleDays = lastTrip ? Math.floor((new Date() - new Date(lastTrip.date)) / (1000 * 60 * 60 * 24)) : 0;
    
    return {
      plate,
      summary: lSummary,
      target: targetVal,
      pct,
      avgRev: lTrips.length ? lSummary.revenue / lTrips.length : 0,
      expRatio: lSummary.revenue ? (lSummary.expenses / lSummary.revenue) * 100 : 0,
      paidCount: lTrips.filter(t => t.status === "Paid").length,
      idleDays
    };
  };

  const kbzData = getVehicleTargetData("KBZ");
  const kblData = getVehicleTargetData("KBL");

  // 6-Month Revenue Comparison
  const sixMonthData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date();
      dt.setMonth(dt.getMonth() - i);
      const start = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);
      
      const monTrips = filterByRange(trips, start, end);
      const kbzRev = monTrips.filter(t => t.lorry === "KBZ").reduce((s, t) => s + Number(t.revenue || 0), 0);
      const kblRev = monTrips.filter(t => t.lorry === "KBL").reduce((s, t) => s + Number(t.revenue || 0), 0);
      
      data.push({
        month: dt.toLocaleString('default', { month: 'short' }),
        KBZ: kbzRev,
        KBL: kblRev
      });
    }
    return data;
  }, [trips]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Fleet Performance</h2>
        <p className="text-sm text-slate-500">Monitor vehicle targets and revenue history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[kbzData, kblData].map(v => (
          <div key={v.plate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{v.plate} Target</h3>
                <p className="text-sm text-slate-500">{currentMonthStr}</p>
              </div>
              <Badge color={v.plate === "KBZ" ? "blue" : "amber"}>{v.plate}</Badge>
            </div>

            {v.target === 0 ? (
              <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50 text-slate-400 font-semibold text-sm">
                No target set for this month
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-emerald-600">{fmt(v.summary.revenue)}</span>
                  <span className="text-slate-400">/ {fmtN(v.target)}</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${v.pct >= 80 ? 'bg-emerald-500' : v.pct >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(v.pct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-right">{v.pct.toFixed(1)}% achieved</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Avg Rev / Trip</p>
                <p className="font-bold text-slate-700">{fmt(v.avgRev)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Expense Ratio</p>
                <p className="font-bold text-slate-700">{v.expRatio.toFixed(1)}%</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Paid / Total Trips</p>
                <p className="font-bold text-slate-700">{v.paidCount} / {v.summary.count}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Idle Status</p>
                <p className={`font-bold ${v.idleDays > 2 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {v.idleDays === 0 ? "Active today" : `${v.idleDays} days idle`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 6-Month Comparison Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">6-Month Revenue Comparison</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sixMonthData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{fontSize: 12, fontWeight: 'bold'}} stroke="#94a3b8" />
              <YAxis tickFormatter={fmtN} tick={{fontSize: 10}} stroke="#94a3b8" />
              <Tooltip formatter={(v) => fmt(v)} cursor={{fill: '#f8fafc'}} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="KBZ" name="KBZ Lorry" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="KBL" name="KBL Lorry" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
