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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-slate-800">{greeting}, {profile?.name?.split(' ')[0]}!</h2>
          <p className="text-slate-500 text-sm mt-1">Here is what's happening with your trips today.</p>
        </div>
      </div>

      {/* Alert Banners */}
      {((isAdmin || isOwner) && (approvalPendingTrips.length > 0 || brokerBalance > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {approvalPendingTrips.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex min-w-0 items-center gap-4">
              <div className="h-10 w-10 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center text-xl">⏳</div>
              <div className="min-w-0">
                <p className="font-bold text-amber-900">{approvalPendingTrips.length} Trips Pending Approval</p>
                <p className="text-xs text-amber-700">New trip entries waiting in the log</p>
              </div>
            </div>
          )}
          {brokerBalance > 0 && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex min-w-0 items-center gap-4">
              <div className="h-10 w-10 bg-rose-200 text-rose-700 rounded-full flex items-center justify-center text-xl">💸</div>
              <div className="min-w-0">
                <p className="font-bold text-rose-900">KES {fmt(brokerBalance)} Broker Balance</p>
                <p className="text-xs text-rose-700">Awaiting settlement from broker</p>
              </div>
            </div>
          )}
        </div>
      )}

      {(isAdmin || isOwner) ? (
        <>
          {/* Finance Stats */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Overall Finances</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mobile-card-rail mobile-card-rail--compact mb-6">
              <StatCard label="Broker Outstanding" value={fmt(brokerBalance)} icon="💸" color={brokerBalance > 0 ? "red" : "slate"} />
              <StatCard label="Amount Remitted" value={fmt(brokerRemitted)} icon="🏦" color="green" />
              <StatCard label="Pending Personnel" value={fmt(pendingPersonnel)} icon="💳" color="amber" />
              <StatCard label="Total Liabilities" value={fmt(totalLiabilities)} icon="⚖️" color={totalLiabilities > 0 ? "amber" : "slate"} />
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Today — {todayStr}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mobile-card-rail mobile-card-rail--compact">
              <StatCard label="Revenue" value={fmt(todaySummary.revenue)} icon="💰" color="blue" />
              <StatCard label="Expenses" value={fmt(todaySummary.operatingExpenses)} icon="📉" color="red" />
              <StatCard label="Operating Profit" value={fmt(todaySummary.operatingProfit)} icon="📈" color="green" />
              <StatCard label="Deductions" value={fmt(todaySummary.deductions)} icon="💸" color="amber" />
              <StatCard label="Net Profit" value={fmt(todaySummary.netProfit)} icon="✓" color={todaySummary.netProfit >= 0 ? "green" : "red"} />
              <StatCard label="Total Trips" value={todaySummary.count} icon="🚛" color="slate" />
              <StatCard label="Pending Trips" value={todaySummary.pendingCount} icon="…" color="amber" />
              <StatCard label="Paid Trips" value={todaySummary.paidCount} icon="✓" color="green" />
            </div>
          </div>

          {/* Vehicle Today Cards */}
          <div className={`grid grid-cols-2 ${vehicleTodayStats.length > 2 ? 'lg:grid-cols-4' : ''} gap-3 mobile-card-rail mobile-card-rail--wide`}>
            {vehicleTodayStats.map((v, i) => (
              <div key={v.id} className="responsive-card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{v.plate} Today</p>
                <p className={`text-xl font-black ${v.summary.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmt(v.summary.netProfit)}</p>
                <p className="text-xs text-slate-500 mt-1">{v.summary.count} trips · Rev {fmt(v.summary.revenue)}</p>
              </div>
            ))}
          </div>

          {/* Pending Trips */}
          {paymentPendingTrips.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setPendingOpen(v => !v)}
                className="flex w-full items-center justify-between gap-3 border-b border-amber-100 px-4 py-4 text-left hover:bg-amber-100/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl">⏳</span>
                    <h3 className="font-black text-amber-900">Pending Trips</h3>
                    <Badge color="amber">{paymentPendingTrips.length}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-amber-700">Remaining trip settlements.</p>
                </div>
                <span className="text-amber-500 text-sm font-bold">{pendingOpen ? "Hide" : "Show"}</span>
              </button>
              {pendingOpen && (
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    {paymentPendingTrips.slice(0, 5).map((trip) => {
                      const days = dayDiff(trip.date);
                      return (
                        <div
                          key={trip.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenTripReview?.(trip)}
                          className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800">{trip.date} · {trip.lorry} · {trip.location || "N/A"}</p>
                            <p className="text-xs text-slate-400">Trip #{trip.tripNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge color={days > 3 ? "amber" : "slate"}>{days} days pending</Badge>
                            <span className="text-sm font-bold text-amber-700">{fmt((trip.revenue || 0) - (trip.amountPaid || 0))}</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMarkTripPaid?.(trip); }}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-xl bg-amber-100 px-4 py-3">
                    <p className="text-sm font-bold text-amber-900">Daily commission setting: {fmt(dailyCommissionAmount)} per paid vehicle day.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToTrips}
                    className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-50"
                  >
                    View all trips
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PROFIT TREND CHART ──────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <p className="font-bold text-slate-800">Profit Trend</p>
                <p className="text-xs text-slate-400 mt-0.5">Revenue, expenses & profit over time</p>
              </div>
              <div className="flex gap-2">
                <RangeBtn label="7D" active={chartRange === 7} onClick={() => setChartRange(7)} />
                <RangeBtn label="14D" active={chartRange === 14} onClick={() => setChartRange(14)} />
                <RangeBtn label="30D" active={chartRange === 30} onClick={() => setChartRange(30)} />
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4">
              <LegendDot color="#3b82f6" label="Revenue" />
              <LegendDot color="#f43f5e" label="Expenses" />
              <LegendDot color="#10b981" label="Op. Profit" />
              <LegendDot color="#0f766e" label="Net Profit" />
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e2e8f0", strokeWidth: 1.5 }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#gradRevenue)" dot={false} activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#gradExpenses)" dot={false} activeDot={{ r: 5, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }} name="Expenses" />
                <Area type="monotone" dataKey="operatingProfit" stroke="#10b981" strokeWidth={2} fill="url(#gradProfit)" dot={false} activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} name="Op. Profit" />
                <Area type="monotone" dataKey="netProfit" stroke="#0f766e" strokeWidth={2.5} fill="url(#gradNet)" dot={false} activeDot={{ r: 5, fill: "#0f766e", stroke: "#fff", strokeWidth: 2 }} name="Net Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── WEEK / MONTH SUMMARY CARDS ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mobile-card-rail mobile-card-rail--wide">
            <div className="responsive-card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">This Week</p>
              <p className={`text-2xl font-black mb-3 ${weekSummary.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmt(weekSummary.netProfit)}</p>
              <MiniRow label="Revenue" value={weekSummary.revenue} color="blue" />
              <MiniRow label="Expenses" value={weekSummary.expenses} color="red" />
              <MiniRow label="Deductions" value={weekSummary.deductions} color="amber" />
            </div>
            <div className="responsive-card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">This Month</p>
              <p className={`text-2xl font-black mb-3 ${monthSummary.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmt(monthSummary.netProfit)}</p>
              <MiniRow label="Revenue" value={monthSummary.revenue} color="blue" />
              <MiniRow label="Expenses" value={monthSummary.expenses} color="red" />
              <MiniRow label="Deductions" value={monthSummary.deductions} color="amber" />
            </div>
          </div>

          {/* ── LORRY COMPARISON CHART ──────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="font-bold text-slate-800">Monthly Lorry Comparison</p>
              <p className="text-xs text-slate-400 mt-0.5">Revenue vs operating profit per vehicle this month</p>
            </div>
            <div className="flex flex-wrap gap-4 mb-4">
              <LegendDot color="#3b82f6" label="Revenue" />
              <LegendDot color="#10b981" label="Op. Profit" />
              <LegendDot color="#0f766e" label="Net Profit" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vehicleMonthStats} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="operatingProfit" fill="#10b981" name="Op. Profit" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="netProfit" fill="#0f766e" name="Net Profit" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        /* DRIVER VIEW */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="My Outstanding Balance" value={fmt(pendingPersonnel)} icon="💸" color={pendingPersonnel > 0 ? "amber" : "slate"} />
            <StatCard label="Trips Today" value={todaySummary.count} icon="🚛" color="blue" />
            <StatCard label="Trips This Week" value={weekSummary.count} icon="📅" color="green" />
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Your Recent Trips</h3>
            {trips.slice(0, 5).map(t => (
              <button key={t.id} type="button" onClick={() => onOpenTripReview?.(t)} className="flex min-w-0 w-full justify-between gap-3 items-center py-3 border-b border-slate-50 last:border-0 text-left">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{t.date} · {t.lorry}</p>
                  <p className="text-xs text-slate-500">{t.location || 'N/A'}</p>
                </div>
                <Badge color={t.approvalStatus === 'approved' ? 'green' : t.approvalStatus === 'rejected' ? 'red' : 'amber'}>
                  {t.approvalStatus === 'approved' ? 'Approved' : t.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                </Badge>
              </button>
            ))}
            {trips.length === 0 && <p className="text-sm text-slate-400">No trips recorded yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
