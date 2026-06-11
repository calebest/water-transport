import { useMemo } from "react";
import { getMonthRange, filterByRange, fmt } from "../../utils/helpers";
import { StatCard } from "../../components/ui";

export default function OwnerRoutesPage({ trips }) {
  const [monthStart, monthEnd] = getMonthRange();
  
  const d = new Date();
  const lastMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);

  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);
  const lastMonthTrips = useMemo(() => filterByRange(trips, lastMonthStart, lastMonthEnd), [trips, lastMonthStart, lastMonthEnd]);

  const routeStats = useMemo(() => {
    const stats = {};
    const lastStats = {};

    lastMonthTrips.forEach(t => {
      const loc = t.locationName || "Unknown";
      if (!lastStats[loc]) lastStats[loc] = 0;
      lastStats[loc] += Number(t.revenue || 0);
    });

    monthTrips.forEach(t => {
      const loc = t.locationName || "Unknown";
      if (!stats[loc]) {
        stats[loc] = { name: loc, trips: 0, revenue: 0, profit: 0 };
      }
      stats[loc].trips += 1;
      stats[loc].revenue += Number(t.revenue || 0);
      stats[loc].profit += Number(t.profit || 0);
    });

    const arr = Object.values(stats).map(s => {
      const prevRev = lastStats[s.name] || 0;
      let changeStr = "—";
      let changeColor = "text-slate-400";
      
      if (prevRev > 0) {
        if (s.revenue > prevRev) {
          changeStr = "▲";
          changeColor = "text-emerald-500";
        } else if (s.revenue < prevRev) {
          changeStr = "▼";
          changeColor = "text-rose-500";
        }
      } else if (s.revenue > 0) {
        changeStr = "▲ (New)";
        changeColor = "text-emerald-500";
      }

      return {
        ...s,
        margin: s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0,
        changeStr,
        changeColor
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return arr.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [monthTrips, lastMonthTrips]);

  const summary = useMemo(() => {
    if (routeStats.length === 0) return { count: 0, topRev: "-", topMargin: "-" };
    
    const topMarginRoute = [...routeStats].sort((a, b) => b.margin - a.margin)[0];
    
    return {
      count: routeStats.length,
      topRev: routeStats[0].name,
      topMargin: topMarginRoute.name
    };
  }, [routeStats]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Route Analytics</h2>
        <p className="text-sm text-slate-500">Destination performance and month-over-month comparisons.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Active Routes (Month)" value={summary.count.toString()} />
        <StatCard title="Highest Revenue Route" value={summary.topRev} />
        <StatCard title="Highest Margin Route" value={summary.topMargin} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Rank</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Destination</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Trips</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Revenue</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Profit</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">MoM Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routeStats.map(r => (
                <tr key={r.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    {r.rank === 1 ? (
                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm shadow-sm border border-amber-200">
                        1
                      </div>
                    ) : r.rank === 2 ? (
                      <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                    ) : r.rank === 3 ? (
                      <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-slate-400 text-sm">
                        {r.rank}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {r.name}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">
                    {r.trips}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-emerald-600">{fmt(r.revenue)}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">
                    {fmt(r.profit)}
                    <div className="text-[10px] text-slate-400 mt-0.5">{r.margin.toFixed(1)}% margin</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-bold ${r.changeColor}`}>{r.changeStr}</span>
                  </td>
                </tr>
              ))}
              {routeStats.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No route activity recorded this month.
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
