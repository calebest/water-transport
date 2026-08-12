import { useMemo, useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";
import { getTripFinancials, isPaidTrip, today, getWeekRange, getMonthRange, filterByRange, summarize, fmt } from "../utils/helpers";
import { StatCard, Badge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { financeService } from "../services/finance";

const dayDiff = (dateValue) => {
  if (!dateValue) return 0;
  const start = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  return Math.max(Math.floor((now - start) / (1000 * 60 * 60 * 24)), 0);
};

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-xl p-3 min-w-[180px]">
      <p className="text-xs font-bold text-slate-500 mb-2 pb-2 border-b border-slate-100">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-slate-500">{p.name}</span>
          </div>
          <span className="text-xs font-bold text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Bar custom tooltip ─────────────────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-xl p-3 min-w-[160px]">
      <p className="text-xs font-bold text-slate-500 mb-2 pb-2 border-b border-slate-100">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-xs text-slate-500">{p.name}</span>
          </div>
          <span className="text-xs font-bold text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── MiniStat ──────────────────────────────────────────────────────────────────
const MiniRow = ({ label, value, color = "slate" }) => {
  const colors = {
    slate: "text-slate-700",
    blue: "text-blue-600",
    green: "text-emerald-600",
    red: "text-rose-500",
    amber: "text-amber-600",
  };
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-bold ${colors[color]}`}>{fmt(value)}</span>
    </div>
  );
};

// ── Range Button ───────────────────────────────────────────────────────────────
const RangeBtn = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
      active
        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
    }`}
  >
    {label}
  </button>
);

// ── Legend Dot ─────────────────────────────────────────────────────────────────
const LegendDot = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    <span className="text-xs text-slate-500">{label}</span>
  </div>
);

export default function DashboardPage({ trips, vehicles = [], earningsConfig = { ratePerTrip: 200 }, onOpenTripReview, onMarkTripPaid, onGoToTrips }) {
  const { profile, isAdmin, isOwner } = useAuth();
  const [pendingOpen, setPendingOpen] = useState(true);
  const [brokerLedger, setBrokerLedger] = useState([]);
  const [personnelLedger, setPersonnelLedger] = useState([]);
  const [chartRange, setChartRange] = useState(14); // 7, 14, 30

  useEffect(() => {
    let unsub1, unsub2;
    if (isAdmin || isOwner) {
      unsub1 = financeService.subscribeBrokerLedger(setBrokerLedger);
      unsub2 = financeService.subscribeAllPersonnelLedger(setPersonnelLedger);
    } else if (profile?.personnelId) {
      unsub2 = financeService.subscribePersonnelLedger(profile.personnelId, setPersonnelLedger);
    }
    return () => {
      if (unsub1) unsub1();
      if (unsub2) unsub2();
    };
  }, [isAdmin, isOwner, profile?.personnelId]);

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
    for (let i = chartRange - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key.slice(5), revenue: 0, expenses: 0, operatingProfit: 0, netProfit: 0 };
    }
    trips.forEach(t => {
      if (days[t.date]) {
        const f = getTripFinancials(t);
        days[t.date].revenue += f.revenue;
        days[t.date].expenses += f.operatingExpenses;
        days[t.date].operatingProfit += f.operatingProfit;
        days[t.date].netProfit += f.netPayable;
      }
    });
    return Object.values(days);
  }, [trips, chartRange]);

  const vehicleTodayStats = useMemo(() =>
    vehicles.map(v => ({ ...v, summary: summarize(todayTrips.filter(t => t.lorry === v.plate)) })),
    [vehicles, todayTrips]
  );

  const vehicleMonthStats = useMemo(() =>
    vehicles.map(v => ({ name: v.plate, ...summarize(monthTrips.filter(t => t.lorry === v.plate)) })),
    [vehicles, monthTrips]
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const approvalPendingTrips = trips.filter(t => t.approvalStatus === "pending" || t.approvalStatus === "pending_edit");
  const paymentPendingTrips = trips.filter(t => !isPaidTrip(t) && t.approvalStatus !== "rejected");
  const dailyCommissionAmount = Number(earningsConfig?.dailyCommissionAmount ?? earningsConfig?.ratePerTrip ?? 200);

  const brokerBalance = brokerLedger.reduce((sum, e) => {
    if (e.type === "revenue") return sum + Number(e.amount);
    if (e.type === "expense_paid" || e.type === "remittance") return sum - Number(e.amount);
    return sum;
  }, 0);
  const brokerRemitted = brokerLedger.filter(e => e.type === "remittance").reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingPersonnel = personnelLedger.reduce((sum, e) => sum + (e.type === "earning" ? Number(e.amount) : -Number(e.amount)), 0);
  const totalLiabilities = brokerBalance + pendingPersonnel;

  // Bar chart colors per vehicle
  const VEHICLE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{greeting}, {profile?.name?.split(' ')[0]}</h2>
          <p className="text-slate-500 text-sm mt-1">Here is your operational overview for today, {todayStr}.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
             <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
               <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
               System Online
             </span>
          </div>
        )}
      </div>

      {(isAdmin || isOwner) ? (
        <>
          {/* ── HERO SECTION ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main KPI */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 to-teal-900 p-8 text-white shadow-xl shadow-teal-900/20">
              <div className="relative z-10">
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-100/80 mb-2">Today's Net Profit</p>
                <div className="flex items-end gap-4">
                  <h3 className="text-5xl sm:text-7xl font-black tracking-tighter">
                    <span className="text-3xl sm:text-4xl text-emerald-300 mr-1">KES</span>
                    {fmt(todaySummary.netProfit)}
                  </h3>
                </div>
                
                <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-emerald-200/70 font-medium mb-1">Revenue</p>
                    <p className="text-xl font-bold">{fmt(todaySummary.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-200/70 font-medium mb-1">Expenses</p>
                    <p className="text-xl font-bold">{fmt(todaySummary.operatingExpenses)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-200/70 font-medium mb-1">Trips</p>
                    <p className="text-xl font-bold">{todaySummary.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-200/70 font-medium mb-1">Paid</p>
                    <p className="text-xl font-bold">{todaySummary.paidCount}</p>
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>
              <div className="absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"></div>
            </div>

            {/* Action Center & Alerts */}
            <div className="flex flex-col gap-4">
              <div className="flex-1 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-center">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Action Center</h3>
                
                <div className="space-y-3">
                  {approvalPendingTrips.length > 0 ? (
                    <div className="flex items-center gap-4 rounded-2xl bg-amber-50 p-4 border border-amber-100/50">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-amber-200/50 flex items-center justify-center text-xl shadow-inner text-amber-700">⏳</div>
                      <div>
                        <p className="font-bold text-amber-900">{approvalPendingTrips.length} Pending Approval</p>
                        <p className="text-xs text-amber-700/70">Trips waiting in the log</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200/50 flex items-center justify-center text-xl text-slate-400">✓</div>
                      <div>
                        <p className="font-bold text-slate-600">All Caught Up</p>
                        <p className="text-xs text-slate-400">No trips pending approval</p>
                      </div>
                    </div>
                  )}

                  {brokerBalance > 0 && (
                    <div className="flex items-center gap-4 rounded-2xl bg-rose-50 p-4 border border-rose-100/50">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-rose-200/50 flex items-center justify-center text-xl shadow-inner text-rose-700">💸</div>
                      <div>
                        <p className="font-bold text-rose-900">KES {fmt(brokerBalance)}</p>
                        <p className="text-xs text-rose-700/70">Broker Outstanding</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── VEHICLE TODAY STRIP ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Live Fleet Performance</h3>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar snap-x">
              {vehicleTodayStats.map(v => (
                <div key={v.id} className="snap-start shrink-0 w-64 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <p className="font-black text-slate-800 text-lg">{v.plate}</p>
                    <Badge color={v.summary.netProfit > 0 ? "green" : v.summary.netProfit < 0 ? "red" : "slate"}>
                      {v.summary.count} trips
                    </Badge>
                  </div>
                  <p className={`text-2xl font-black tracking-tight ${v.summary.netProfit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {fmt(v.summary.netProfit)}
                  </p>
                  <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Net Profit Today</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CHARTS ROW ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Profit Trend Chart */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Profit Trend</h3>
                  <p className="text-xs text-slate-400 mt-1">Revenue vs Expenses over time</p>
                </div>
                <div className="flex gap-2 bg-slate-50 p-1 rounded-full border border-slate-100">
                  <RangeBtn label="7D" active={chartRange === 7} onClick={() => setChartRange(7)} />
                  <RangeBtn label="14D" active={chartRange === 14} onClick={() => setChartRange(14)} />
                  <RangeBtn label="30D" active={chartRange === 30} onClick={() => setChartRange(30)} />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 mb-6">
                <LegendDot color="#3b82f6" label="Revenue" />
                <LegendDot color="#f43f5e" label="Expenses" />
                <LegendDot color="#10b981" label="Op. Profit" />
                <LegendDot color="#0f766e" label="Net Profit" />
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e2e8f0", strokeWidth: 1.5, strokeDasharray: "4 4" }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradRevenue)" dot={false} activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gradExpenses)" dot={false} activeDot={{ r: 6, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="operatingProfit" stroke="#10b981" strokeWidth={2.5} fill="url(#gradProfit)" dot={false} activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="netProfit" stroke="#0f766e" strokeWidth={3} fill="url(#gradNet)" dot={false} activeDot={{ r: 6, fill: "#0f766e", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Lorry Comparison Chart */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800">Monthly Fleet Comparison</h3>
                <p className="text-xs text-slate-400 mt-1">Vehicle performance this month</p>
              </div>
              <div className="flex flex-wrap gap-4 mb-6">
                <LegendDot color="#3b82f6" label="Revenue" />
                <LegendDot color="#10b981" label="Op. Profit" />
                <LegendDot color="#0f766e" label="Net Profit" />
              </div>
              <div className="flex-1 min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vehicleMonthStats} barGap={6} barCategoryGap="25%" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} dx={-10} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: "#f1f5f9", opacity: 0.5 }} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="operatingProfit" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="netProfit" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── SECONDARY METRICS ROW ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liabilities */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-5">Outstanding Liabilities</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-widest">Total Liabilities</p>
                  <p className={`text-xl font-black ${totalLiabilities > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{fmt(totalLiabilities)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-widest">Pending Personnel</p>
                  <p className="text-xl font-black text-slate-700">{fmt(pendingPersonnel)}</p>
                </div>
              </div>
            </div>

            {/* Pending Payment Trips */}
            {paymentPendingTrips.length > 0 && (
              <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/30 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 uppercase tracking-widest">Unpaid Trips</h3>
                    <p className="text-xs text-amber-700/70 mt-1">{paymentPendingTrips.length} trips awaiting settlement</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingOpen(v => !v)}
                    className="px-4 py-2 rounded-full bg-amber-200/50 text-amber-800 text-xs font-bold hover:bg-amber-200 transition-colors"
                  >
                    {pendingOpen ? "Hide Details" : "View List"}
                  </button>
                </div>
                
                {pendingOpen && (
                  <div className="space-y-3 mt-4">
                    {paymentPendingTrips.slice(0, 4).map((trip) => {
                      const days = dayDiff(trip.date);
                      return (
                        <div
                          key={trip.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenTripReview?.(trip)}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 p-3 hover:bg-white transition-colors border border-amber-100/50"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{trip.lorry} · {trip.location || "N/A"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{trip.date}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-black text-amber-700">{fmt((trip.revenue || 0) - (trip.amountPaid || 0))}</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMarkTripPaid?.(trip); }}
                                className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 shadow-sm"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {paymentPendingTrips.length > 4 && (
                      <button onClick={onGoToTrips} className="w-full py-3 mt-2 text-xs font-bold text-amber-800 text-center hover:bg-amber-100/50 rounded-xl transition-colors">
                        View all {paymentPendingTrips.length} unpaid trips →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── DRIVER VIEW (Modernized) ── */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">My Outstanding Balance</p>
              <p className={`text-3xl font-black ${pendingPersonnel > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{fmt(pendingPersonnel)}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Trips Today</p>
              <p className="text-3xl font-black text-blue-600">{todaySummary.count}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Trips This Week</p>
              <p className="text-3xl font-black text-emerald-600">{weekSummary.count}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 text-lg">Your Recent Trips</h3>
            <div className="space-y-3">
              {trips.slice(0, 5).map(t => (
                <button key={t.id} type="button" onClick={() => onOpenTripReview?.(t)} className="flex w-full items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 hover:bg-slate-100/50 transition-all text-left">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{t.date} <span className="text-slate-300 mx-2">|</span> {t.lorry}</p>
                    <p className="text-sm text-slate-500 mt-1">{t.location || 'N/A'}</p>
                  </div>
                  <Badge color={t.approvalStatus === 'approved' ? 'green' : t.approvalStatus === 'rejected' ? 'red' : 'amber'}>
                    {t.approvalStatus === 'approved' ? 'Approved' : t.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                  </Badge>
                </button>
              ))}
              {trips.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-400">No trips recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
