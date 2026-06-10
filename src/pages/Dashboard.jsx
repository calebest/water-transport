import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { today, getWeekRange, getMonthRange, filterByRange, summarize, fmt } from "../utils/helpers";
import { StatCard } from "../components/ui";

const SYSTEM_FLOW_STEPS = [
  {
    step: "01",
    title: "Set routes and prices",
    text: "Locations store the standard price for each delivery route, so new trip revenue can be filled from the route list."
  },
  {
    step: "02",
    title: "Record each trip",
    text: "A trip captures the lorry, date, route, trip number, payment status, and all standard or extra expenses."
  },
  {
    step: "03",
    title: "Calculate profit",
    text: "The system totals expenses automatically, subtracts them from revenue, and keeps the dashboard figures current."
  },
  {
    step: "04",
    title: "Review and export",
    text: "Reports summarize daily, weekly, and monthly performance by lorry, with CSV and PDF exports ready for records."
  }
];

function SystemFlowHighlight() {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-blue-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">How the system works</p>
        <h2 className="mt-1 text-lg font-black text-slate-800">From route setup to profit reports</h2>
      </div>
      <div className="grid gap-0 md:grid-cols-4">
        {SYSTEM_FLOW_STEPS.map((item, index) => (
          <div
            key={item.step}
            className={`relative p-5 ${index < SYSTEM_FLOW_STEPS.length - 1 ? "border-b border-slate-100 md:border-b-0 md:border-r" : ""}`}
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white shadow-md shadow-emerald-600/20">
              {item.step}
            </div>
            <h3 className="text-sm font-black text-slate-800">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage({ trips }) {
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

  const kbzToday = useMemo(() => summarize(todayTrips.filter(t => t.lorry === "KBZ")), [todayTrips]);
  const kblToday = useMemo(() => summarize(todayTrips.filter(t => t.lorry === "KBL")), [todayTrips]);

  const kbzMonth = useMemo(() => summarize(monthTrips.filter(t => t.lorry === "KBZ")), [monthTrips]);
  const kblMonth = useMemo(() => summarize(monthTrips.filter(t => t.lorry === "KBL")), [monthTrips]);

  return (
    <div className="space-y-6">
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

      <SystemFlowHighlight />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">KBZ Today</p>
          <p className="text-xl font-black text-slate-800">{fmt(kbzToday.profit)}</p>
          <p className="text-xs text-slate-500 mt-1">{kbzToday.count} trips · Rev {fmt(kbzToday.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">KBL Today</p>
          <p className="text-xl font-black text-slate-800">{fmt(kblToday.profit)}</p>
          <p className="text-xs text-slate-500 mt-1">{kblToday.count} trips · Rev {fmt(kblToday.revenue)}</p>
        </div>
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
          <BarChart data={[
            { name: "KBZ", revenue: kbzMonth.revenue, profit: kbzMonth.profit },
            { name: "KBL", revenue: kblMonth.revenue, profit: kblMonth.profit },
          ]}>
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
    </div>
  );
}
