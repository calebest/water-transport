import { useMemo } from "react";
import { getMonthRange, filterByRange, fmt, fmtN } from "../../utils/helpers";

export default function OwnerDriversPage({ trips, personnel }) {
  const [monthStart, monthEnd] = getMonthRange();
  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);

  const driverStats = useMemo(() => {
    const stats = {};
    
    monthTrips.forEach(t => {
      // Find name either through personnel matching or legacy driverName field
      let dName = "Unassigned";
      if (t.driverId) {
        const p = personnel.find(p => p.id === t.driverId);
        if (p) dName = p.name;
      } else if (t.driverName) {
        dName = t.driverName;
      }
      
      if (!stats[dName]) {
        stats[dName] = { name: dName, trips: 0, revenue: 0, driverExpense: 0 };
      }
      
      stats[dName].trips += 1;
      stats[dName].revenue += Number(t.revenue || 0);
      stats[dName].driverExpense += Number(t.expenses?.driver || 0);
    });

    // Calculate averages and sort by revenue
    const arr = Object.values(stats).map(s => ({
      ...s,
      avgRev: s.trips > 0 ? s.revenue / s.trips : 0
    })).sort((a, b) => b.revenue - a.revenue);

    // Assign rank and calculate performance bar relative to top driver
    const topRevenue = arr[0]?.revenue || 1;
    return arr.map((s, i) => ({
      ...s,
      rank: i + 1,
      performancePct: (s.revenue / topRevenue) * 100
    }));
  }, [monthTrips, personnel]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Driver Performance</h2>
        <p className="text-sm text-slate-500">Rankings based on revenue generated this month.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Rank</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Driver Name</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Trips</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Revenue</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Avg / Trip</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Driver Claims</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs w-48">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {driverStats.map(d => (
                <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    {d.rank === 1 ? (
                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm shadow-sm border border-amber-200">
                        1
                      </div>
                    ) : d.rank === 2 ? (
                      <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                    ) : d.rank === 3 ? (
                      <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-slate-400 text-sm">
                        {d.rank}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {d.name}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">
                    {d.trips}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-emerald-600">{fmt(d.revenue)}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">
                    {fmt(d.avgRev)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-rose-600">{fmt(d.driverExpense)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden shrink-0">
                        <div 
                          className={`h-full rounded-full ${d.rank === 1 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${d.performancePct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-500 w-8">{Math.round(d.performancePct)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {driverStats.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No driver activity recorded this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
