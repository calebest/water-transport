import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAuth } from "../../contexts/AuthContext";
import { today, getMonthRange, filterByRange, summarize, fmt, fmtN } from "../../utils/helpers";
import { StatCard, Badge } from "../../components/ui";

function getGreeting(name) {
  const hour = new Date().getHours();
  const firstName = name ? name.split(" ")[0] : "Owner";
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 18) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

export default function OwnerDashboardPage({ trips, vehicles, targets }) {
  const { profile } = useAuth();
  const greeting = getGreeting(profile?.name);

  const todayStr = today();
  const [monthStart, monthEnd] = getMonthRange();
  const currentMonthStr = monthStart.slice(0, 7); // YYYY-MM

  // Date boundaries for last month
  const d = new Date();
  const lastMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);

  // Trips data
  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);
  const lastMonthTrips = useMemo(() => filterByRange(trips, lastMonthStart, lastMonthEnd), [trips, lastMonthStart, lastMonthEnd]);

  const monthSummary = useMemo(() => summarize(monthTrips), [monthTrips]);
  const lastMonthSummary = useMemo(() => summarize(lastMonthTrips), [lastMonthTrips]);

  const calcChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const revChange = calcChange(monthSummary.revenue, lastMonthSummary.revenue);
  const expChange = calcChange(monthSummary.expenses, lastMonthSummary.expenses);
  const profitChange = calcChange(monthSummary.profit, lastMonthSummary.profit);

  // Outstanding Balance
  const outstandingBalance = useMemo(() => {
    return trips.reduce((sum, t) => {
      if (t.status === "Pending" || t.status === "Partial") {
        return sum + (Number(t.revenue || 0) - Number(t.amountPaid || 0));
      }
      return sum;
    }, 0);
  }, [trips]);

  // Alert Banner Conditions
  const alerts = useMemo(() => {
    const active = [];
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

    const hasOldPending = trips.some(t => t.status === "Pending" && t.date < twoDaysAgoStr);
    if (hasOldPending) active.push("Trips pending > 2 days");

    // Idle lorry check
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().slice(0, 10);

    const idleLorry = vehicles.some(v => {
      const lastTrip = trips.find(t => t.lorry === v.plate);
      return !lastTrip || lastTrip.date < threeDaysAgoStr;
    });
    if (idleLorry) active.push("Idle lorry > 3 days");

    // Target below 50% with > 10 days left
    const daysLeft = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
    if (daysLeft > 10) {
      const missingTarget = vehicles.some(v => {
        const tObj = targets.find(t => t.lorry === v.plate && t.month === currentMonthStr);
        if (!tObj || !tObj.target) return false;
        const lTrips = monthTrips.filter(t => t.lorry === v.plate);
        const lRev = lTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
        return (lRev / tObj.target) < 0.5;
      });
      if (missingTarget) active.push("Target < 50% with > 10 days left");
    }

    // Collection rate < 65%
    const totalRev = monthSummary.revenue;
    const totalCollected = monthTrips.reduce((s, t) => s + Number(t.amountPaid || 0), 0);
    if (totalRev > 0 && (totalCollected / totalRev) < 0.65) {
      active.push("Collection rate < 65%");
    }

    return active;
  }, [trips, vehicles, targets, monthTrips, monthSummary, currentMonthStr]);

  // Target Cards
  const getVehicleTargetData = (plate) => {
    const lTrips = monthTrips.filter(t => t.lorry === plate);
    const lSummary = summarize(lTrips);
    const tObj = targets.find(t => t.lorry === plate && t.month === currentMonthStr);
    const targetVal = tObj?.target || 0;
    const pct = targetVal ? (lSummary.revenue / targetVal) * 100 : 0;
    
    // Last trip date
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

  // Trend Chart (14-Day)
  const trendData = useMemo(() => {
    const days = {};
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      days[key] = { date: key.slice(5), revenue: 0, profit: 0 };
    }
    trips.forEach(t => {
      if (days[t.date]) {
        days[t.date].revenue += Number(t.revenue || 0);
        days[t.date].profit += Number(t.profit || 0);
      }
    });
    return Object.values(days);
  }, [trips]);

  // Month Comparison Chart
  const monthCompData = [
    { name: "KBZ", revenue: kbzData.summary.revenue, profit: kbzData.summary.profit },
    { name: "KBL", revenue: kblData.summary.revenue, profit: kblData.summary.profit }
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-slate-800">{greeting}</h1>
        <p className="text-sm text-slate-500">Here is your financial overview for the business.</p>
      </div>

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-rose-600">🚨</span>
            <h3 className="font-bold text-rose-800 text-sm">Action Required</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section A: KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue (Month)" value={fmt(monthSummary.revenue)} 
          change={`${revChange >= 0 ? "+" : ""}${revChange.toFixed(1)}%`} positive={revChange >= 0} />
        <StatCard title="Expenses (Month)" value={fmt(monthSummary.expenses)} 
          change={`${expChange >= 0 ? "+" : ""}${expChange.toFixed(1)}%`} positive={expChange <= 0} />
        <StatCard title="Net Profit (Month)" value={fmt(monthSummary.profit)} 
          change={`${profitChange >= 0 ? "+" : ""}${profitChange.toFixed(1)}%`} positive={profitChange >= 0} />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-700 mb-1">Outstanding Balance</p>
          <p className="text-2xl font-black text-amber-900">{fmt(outstandingBalance)}</p>
          <p className="text-xs font-semibold mt-2 text-amber-600">Across all pending trips</p>
        </div>
      </div>

      {/* Section C: Target Cards */}
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

      {/* Section D & E: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">14-Day Revenue & Profit Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{fontSize: 10}} tickMargin={10} stroke="#94a3b8" />
                <YAxis tickFormatter={fmtN} tick={{fontSize: 10}} stroke="#94a3b8" width={60} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend iconType="circle" />
                <Line type="monotone" name="Revenue" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{r: 6}} />
                <Line type="monotone" name="Profit" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Lorry Comparison (Month)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthCompData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 12, fontWeight: 'bold'}} stroke="#94a3b8" />
                <YAxis hide />
                <Tooltip formatter={(v) => fmt(v)} cursor={{fill: '#f8fafc'}} />
                <Legend iconType="circle" />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
