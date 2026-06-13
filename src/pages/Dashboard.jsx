import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { today, getWeekRange, getMonthRange, filterByRange, summarize, fmt } from "../utils/helpers";
import { StatCard, Badge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardPage({ trips, vehicles = [], settings }) {
  const { profile, isAdmin } = useAuth();
  const todayStr = today();
  const [weekStart, weekEnd] = getWeekRange();
  const [monthStart, monthEnd] = getMonthRange();

  const todayTrips = useMemo(() => filterByRange(trips, todayStr, todayStr), [trips, todayStr]);
  const weekTrips = useMemo(() => filterByRange(trips, weekStart, weekEnd), [trips, weekStart, weekEnd]);
  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);

  const todaySummary = useMemo(() => summarize(todayTrips), [todayTrips]);
  const weekSummary = useMemo(() => summarize(weekTrips), [weekTrips]);
  const monthSummary = useMemo(() => summarize(monthTrips), [monthTrips]);

  const chartData = useMemo(() => {
    const days = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key.slice(5), revenue: 0, expenses: 0, profit: 0 };
    }
    trips.forEach(t => {
      if (days[t.date]) {
        days[t.date].revenue += Number(t.revenue || 0);
        days[t.date].expenses += Number(t.totalExpenses || 0);
        days[t.date].profit += Number(t.profit || 0);
      }
    });
    return Object.values(days);
  }, [trips]);

  const vehicleTodayStats = useMemo(() => {
    return vehicles.map(v => ({
      ...v,
      summary: summarize(todayTrips.filter(t => t.lorry === v.plate))
    }));
  }, [vehicles, todayTrips]);

  const vehicleMonthStats = useMemo(() => {
    return vehicles.map(v => ({
      name: v.plate,
      ...summarize(monthTrips.filter(t => t.lorry === v.plate))
    }));
  }, [vehicles, monthTrips]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const pendingTrips = trips.filter(t => t.approvalStatus === "pending" || t.approvalStatus === "pending_edit");
  const unpaidTrips = trips.filter(t => t.status !== "Paid" && t.approvalStatus === "approved" && t.revenue > 0);
  const outstandingBalance = unpaidTrips.reduce((acc, t) => acc + ((t.revenue || 0) - (t.amountPaid || 0)), 0);

  const toggleDirectApproval = async () => {
    if (!isAdmin) return;
    try {
      await settingsService.update({ directApproval: !settings?.directApproval });
    } catch (e) {
      console.error(e);
      alert("Failed to update settings");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{greeting}, {profile?.name?.split(' ')[0]}!</h2>
          <p className="text-slate-500 text-sm mt-1">Here is what's happening with your trips today.</p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-3 bg-slate-50 py-2 px-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-700">Direct Approval</p>
              <p className="text-[10px] text-slate-500">Auto-approve driver submissions</p>
            </div>
            <button 
              onClick={toggleDirectApproval}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings?.directApproval ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings?.directApproval ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        )}
      </div>

      {(isAdmin && (pendingTrips.length > 0 || outstandingBalance > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingTrips.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4">
              <div className="h-10 w-10 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center text-xl">⏳</div>
              <div>
                <p className="font-bold text-amber-900">{pendingTrips.length} Trips Pending Approval</p>
                <p className="text-xs text-amber-700">Review driver submissions</p>
              </div>
            </div>
          )}
          {outstandingBalance > 0 && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
              <div className="h-10 w-10 bg-rose-200 text-rose-700 rounded-full flex items-center justify-center text-xl">💸</div>
              <div>
                <p className="font-bold text-rose-900">KES {fmt(outstandingBalance)} Outstanding</p>
                <p className="text-xs text-rose-700">From {unpaidTrips.length} unpaid trips</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Driver vs Admin View Separation */}
      {isAdmin ? (
        <>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Today — {todayStr}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Revenue" value={fmt(todaySummary.revenue)} icon="💰" color="blue" />
              <StatCard label="Expenses" value={fmt(todaySummary.expenses)} icon="📉" color="red" />
              <StatCard label="Profit" value={fmt(todaySummary.profit)} icon="📈" color="green"
                sub={`${todaySummary.count} trips`} />
              <StatCard label="Trips" value={todaySummary.count} icon="🚛" color="amber" />
            </div>
          </div>

          <div className={`grid grid-cols-2 ${vehicleTodayStats.length > 2 ? 'lg:grid-cols-4' : ''} gap-3`}>
            {vehicleTodayStats.map(v => (
              <div key={v.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{v.plate} Today</p>
                <p className="text-xl font-black text-slate-800">{fmt(v.summary.profit)}</p>
                <p className="text-xs text-slate-500 mt-1">{v.summary.count} trips · Rev {fmt(v.summary.revenue)}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-700 mb-4">14-Day Profit Trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, n) => [fmt(v), n]} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} dot={false} name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} dot={false} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">This Week</p>
              <p className="text-xl font-black text-slate-800">{fmt(weekSummary.profit)}</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Revenue</span><span className="font-semibold">{fmt(weekSummary.revenue)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Expenses</span><span className="font-semibold text-rose-500">{fmt(weekSummary.expenses)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">This Month</p>
              <p className="text-xl font-black text-slate-800">{fmt(monthSummary.profit)}</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Revenue</span><span className="font-semibold">{fmt(monthSummary.revenue)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Expenses</span><span className="font-semibold text-rose-500">{fmt(monthSummary.expenses)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-700 mb-4">Monthly Lorry Comparison</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={vehicleMonthStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, n) => [fmt(v), n]} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        /* DRIVER VIEW */
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Trips Today" value={todaySummary.count} icon="🚛" color="blue" />
            <StatCard label="Trips This Week" value={weekSummary.count} icon="📅" color="amber" />
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Your Recent Trips</h3>
            {trips.slice(0, 5).map(t => (
              <div key={t.id} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-slate-700">{t.date} · {t.lorry}</p>
                  <p className="text-xs text-slate-500">{t.location || 'N/A'}</p>
                </div>
                <Badge color={t.approvalStatus === 'approved' ? 'green' : t.approvalStatus === 'rejected' ? 'red' : 'amber'}>
                  {t.approvalStatus === 'approved' ? 'Approved' : t.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                </Badge>
              </div>
            ))}
            {trips.length === 0 && <p className="text-sm text-slate-400">No trips recorded yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
