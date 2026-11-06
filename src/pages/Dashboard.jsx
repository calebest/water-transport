import { useMemo, useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";
import { getTripFinancials, isPaidTrip, today, getWeekRange, getMonthRange, filterByRange, summarize, fmt } from "../utils/helpers";
import { StatCard, Badge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { financeService } from "../services/finance";
import { getThemeById } from "../utils/dashboardThemes";

const dayDiff = (dateValue) => {
  if (!dateValue) return 0;
  const start = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  return Math.max(Math.floor((now - start) / (1000 * 60 * 60 * 24)), 0);
};

// ── Custom Tooltip for Area Chart ──────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md text-slate-800 shadow-2xl p-3.5 min-w-[200px]">
      <p className="text-xs font-bold text-slate-500 mb-2 pb-1.5 border-b border-slate-100 flex items-center justify-between">
        <span>📅 {label}</span>
        <span className="text-[10px] uppercase font-mono text-sky-600 font-bold">Daily Audit</span>
      </p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-slate-100" style={{ background: p.color }} />
            <span className="text-xs text-slate-600 font-medium">{p.name}</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-900">KES {fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Bar custom tooltip ─────────────────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md text-slate-800 shadow-2xl p-3.5 min-w-[190px]">
      <p className="text-xs font-bold text-slate-500 mb-2 pb-1.5 border-b border-slate-100 flex items-center justify-between">
        <span className="font-mono text-slate-900 font-black">{label}</span>
        <span className="text-[10px] uppercase text-sky-600 font-semibold">Monthly Fleet</span>
      </p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.fill }} />
            <span className="text-xs text-slate-600 font-medium">{p.name}</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-900">KES {fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Range Button ───────────────────────────────────────────────────────────────
const RangeBtn = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
      active
        ? "bg-slate-900 text-white shadow-xs"
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
    }`}
  >
    {label}
  </button>
);

// ── Legend Dot ─────────────────────────────────────────────────────────────────
const LegendDot = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="inline-block h-2.5 w-2.5 rounded-full shadow-2xs" style={{ background: color }} />
    <span className="text-xs font-medium text-slate-600">{label}</span>
  </div>
);

export default function DashboardPage({
  trips,
  vehicles = [],
  settings,
  onOpenTripReview,
  onMarkTripPaid,
  onGoToTrips,
  onGoToPayments,
  onGoToReconciliation,
  onGoToMarketing,
  onGoToSettings
}) {
  const { profile, isAdmin, isOwner } = useAuth();
  const [pendingOpen, setPendingOpen] = useState(() => localStorage.getItem("wt_dash_pendingOpen") !== "false");
  const [brokerLedger, setBrokerLedger] = useState([]);
  const [personnelLedger, setPersonnelLedger] = useState([]);
  const [chartRange, setChartRange] = useState(() => parseInt(localStorage.getItem("wt_dash_chartRange")) || 14);

  // Timeframe selector for Net Profit Hero: 'today' | 'week' | 'month'
  const [kpiPeriod, setKpiPeriod] = useState(() => localStorage.getItem("wt_dash_kpi_period") || "today");

  // Visual Theme resolution: Option 1 ("glacier") is default
  const themeKey = settings?.dashboardTheme || (typeof window !== "undefined" ? localStorage.getItem("wt_dashboard_theme") : "glacier") || "glacier";
  const currentTheme = getThemeById(themeKey);

  useEffect(() => {
    localStorage.setItem("wt_dash_pendingOpen", pendingOpen);
    localStorage.setItem("wt_dash_chartRange", chartRange);
    localStorage.setItem("wt_dash_kpi_period", kpiPeriod);
  }, [pendingOpen, chartRange, kpiPeriod]);

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

  // Only count approved trips in operational financials and revenue metrics
  const approvedTrips = useMemo(() =>
    trips.filter(t => !t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit"),
    [trips]
  );

  const todayTrips = useMemo(() => filterByRange(approvedTrips, todayStr, todayStr), [approvedTrips, todayStr]);
  const weekTrips = useMemo(() => filterByRange(approvedTrips, weekStart, weekEnd), [approvedTrips, weekStart, weekEnd]);
  const monthTrips = useMemo(() => filterByRange(approvedTrips, monthStart, monthEnd), [approvedTrips, monthStart, monthEnd]);

  const todaySummary = useMemo(() => summarize(todayTrips), [todayTrips]);
  const weekSummary = useMemo(() => summarize(weekTrips), [weekTrips]);
  const monthSummary = useMemo(() => summarize(monthTrips), [monthTrips]);

  // Active Summary based on selected Time Horizon pill (Today, Week, Month)
  const activeSummary = useMemo(() => {
    if (kpiPeriod === "week") {
      return {
        ...weekSummary,
        periodTitle: "This Week's Net Profit",
        timeRangeLabel: `${weekStart} to ${weekEnd}`,
        badgeText: "7-Day View",
      };
    }
    if (kpiPeriod === "month") {
      return {
        ...monthSummary,
        periodTitle: "This Month's Net Profit",
        timeRangeLabel: `${monthStart} to ${monthEnd}`,
        badgeText: "Monthly View",
      };
    }
    return {
      ...todaySummary,
      periodTitle: "Today's Net Profit",
      timeRangeLabel: `Today · ${todayStr}`,
      badgeText: "Live Today",
    };
  }, [kpiPeriod, todaySummary, weekSummary, monthSummary, todayStr, weekStart, weekEnd, monthStart, monthEnd]);

  // Net Profit Margin Percentage
  const netMarginPct = useMemo(() => {
    if (!activeSummary.revenue || activeSummary.revenue <= 0) return 0;
    return Math.round((activeSummary.netProfit / activeSummary.revenue) * 100);
  }, [activeSummary]);

  const chartData = useMemo(() => {
    const days = {};
    for (let i = chartRange - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key.slice(5), revenue: 0, expenses: 0, operatingProfit: 0, netProfit: 0 };
    }
    approvedTrips.forEach(t => {
      if (days[t.date]) {
        const f = getTripFinancials(t);
        days[t.date].revenue += f.revenue;
        days[t.date].expenses += f.operatingExpenses;
        days[t.date].operatingProfit += f.operatingProfit;
        days[t.date].netProfit += f.netPayable;
      }
    });
    return Object.values(days);
  }, [approvedTrips, chartRange]);

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

  const brokerBalance = brokerLedger.reduce((sum, e) => {
    if (e.type === "revenue") return sum + Number(e.amount);
    if (e.type === "expense_paid" || e.type === "remittance") return sum - Number(e.amount);
    return sum;
  }, 0);
  const pendingPersonnel = personnelLedger.reduce((sum, e) => sum + (e.type === "earning" ? Number(e.amount) : -Number(e.amount)), 0);
  const totalLiabilities = brokerBalance + pendingPersonnel;

  // Active actions count for the notification badge
  const activeAlertsCount = (approvalPendingTrips.length > 0 ? 1 : 0) + (brokerBalance > 0 ? 1 : 0) + (paymentPendingTrips.length > 0 ? 1 : 0);

  const styles = currentTheme.styles;

  return (
    <div className="space-y-8 pb-10">
      {/* ── TOP EXECUTIVE COMMAND BAR (Theme-Driven) ── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl relative overflow-hidden transition-all duration-300 ${styles.commandBar}`}>
        <div className="relative z-10 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${styles.commandBadge}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse"></span>
              Live Operations Control
            </span>
            <span className="text-slate-400 text-xs hidden sm:inline">·</span>
            <span className="text-slate-500 text-xs font-mono hidden sm:inline">{todayStr}</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 ${styles.commandTitle}`}>
            <span>{greeting}, {profile?.name?.split(' ')[0] || "Director"}</span>
            <span className="text-amber-400 text-xl hidden sm:inline">💧</span>
          </h1>
          <p className={`text-xs sm:text-sm mt-1 font-medium ${styles.commandSub}`}>
            Mount Kenya Water Logistics & Fleet Financial Performance Overview
          </p>
        </div>

        {/* Live Quick Indicators & Settings Theme Pill */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <div className={`px-3.5 py-2 rounded-2xl flex items-center gap-3 ${styles.indicatorCard}`}>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>
            <div className="text-left">
              <p className={`text-[10px] uppercase font-bold tracking-wider ${styles.indicatorLabel}`}>Fleet Status</p>
              <p className={`text-xs font-black ${styles.indicatorValue}`}>{vehicles.length} Tankers Active</p>
            </div>
          </div>

          <div className={`px-3.5 py-2 rounded-2xl flex items-center gap-2.5 ${styles.indicatorCard}`}>
            <span className="text-sm">💧</span>
            <div className="text-left">
              <p className={`text-[10px] uppercase font-bold tracking-wider ${styles.indicatorLabel}`}>Today's Deliveries</p>
              <p className={`text-xs font-black ${styles.indicatorValue}`}>{todaySummary.count} Completed</p>
            </div>
          </div>

          {onGoToSettings && (
            <button
              type="button"
              onClick={onGoToSettings}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all hover:scale-[1.02] cursor-pointer text-xs font-bold"
              title="Change Dashboard Appearance Theme in Settings"
            >
              <span>🎨</span>
              <span className="hidden sm:inline">Theme:</span>
              <span className="font-extrabold text-sky-700">{currentTheme.name.split(" ")[0]}</span>
              <span className="text-[10px] text-slate-400">⚙️</span>
            </button>
          )}
        </div>

        {/* Ambient subtle glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-sky-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {(isAdmin || isOwner) ? (
        <>
          {/* ── HERO FINANCIAL COMMAND & ACTION DOCK ── */}
          {/* items-start prevents vertical stretching: the cards remain compact and disciplined */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ── LEFT: RE-ORGANIZED NET PROFIT DISPLAY CARD (8 COLS) ── */}
            <div className={`lg:col-span-7 xl:col-span-8 relative overflow-hidden rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${styles.heroCard}`}>
              
              {/* Background ambient lighting */}
              <div className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl pointer-events-none ${styles.glow1}`}></div>
              <div className={`absolute -bottom-28 -left-10 h-72 w-72 rounded-full blur-3xl pointer-events-none ${styles.glow2}`}></div>

              <div className="relative z-10">
                {/* Header Row: Label & Time Horizon Pill Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/15">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-white shadow-xs"></span>
                      <p className={`text-xs font-bold uppercase tracking-widest ${styles.heroTitle}`}>
                        {activeSummary.periodTitle}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${styles.heroBadge}`}>
                        {activeSummary.badgeText}
                      </span>
                    </div>
                    <p className={`text-[11px] font-mono mt-0.5 ${styles.heroRange}`}>
                      {activeSummary.timeRangeLabel}
                    </p>
                  </div>

                  {/* Timeframe Switcher Tabs */}
                  <div className={`inline-flex p-1 rounded-2xl backdrop-blur-md self-start sm:self-auto shadow-inner ${styles.heroTabsContainer}`}>
                    {[
                      { key: "today", label: "Today" },
                      { key: "week", label: "This Week" },
                      { key: "month", label: "This Month" },
                    ].map((tab) => {
                      const isActive = kpiPeriod === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setKpiPeriod(tab.key)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? styles.heroTabActive
                              : styles.heroTabInactive
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Main Net Profit Number (Disciplined size, never stretches or breaks) */}
                <div className="my-5 sm:my-6 flex flex-wrap items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-90">
                      Net Realized Earnings
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl sm:text-3xl font-black font-mono ${styles.heroCurrency}`}>
                        KES
                      </span>
                      <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight font-mono text-white break-words">
                        {fmt(activeSummary.netProfit)}
                      </h2>
                    </div>
                  </div>

                  {activeSummary.revenue > 0 && (
                    <div className="flex flex-col items-start sm:items-end">
                      <div className={`px-3 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 border shadow-xs ${
                        activeSummary.netProfit >= 0
                          ? styles.heroMarginBadgePositive
                          : styles.heroMarginBadgeNegative
                      }`}>
                        <span>{activeSummary.netProfit >= 0 ? "▲" : "▼"}</span>
                        <span>{netMarginPct}% Net Margin</span>
                      </div>
                      <p className="text-[10px] mt-1 font-medium opacity-80">
                        After all trip operating costs
                      </p>
                    </div>
                  )}
                </div>

                {/* Sub-Metrics 4-Pill Structured Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/15">
                  <div className={`p-3 rounded-2xl border ${styles.heroSubCard}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">📈</span>
                      <p className={`text-[10.5px] font-bold uppercase tracking-wider ${styles.heroSubLabel}`}>Revenue</p>
                    </div>
                    <p className="text-base sm:text-lg font-black text-white font-mono">
                      {fmt(activeSummary.revenue)}
                    </p>
                    <p className="text-[9.5px] opacity-75 mt-0.5">Gross billed</p>
                  </div>

                  <div className={`p-3 rounded-2xl border ${styles.heroSubCard}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">⛽</span>
                      <p className={`text-[10.5px] font-bold uppercase tracking-wider ${styles.heroSubLabel}`}>Expenses</p>
                    </div>
                    <p className="text-base sm:text-lg font-black text-white font-mono">
                      {fmt(activeSummary.operatingExpenses)}
                    </p>
                    <p className="text-[9.5px] opacity-75 mt-0.5">Fuel & allowance</p>
                  </div>

                  <div className={`p-3 rounded-2xl border ${styles.heroSubCard}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">⚖️</span>
                      <p className={`text-[10.5px] font-bold uppercase tracking-wider ${styles.heroSubLabel}`}>Op. Profit</p>
                    </div>
                    <p className="text-base sm:text-lg font-black text-white font-mono">
                      {fmt(activeSummary.operatingProfit)}
                    </p>
                    <p className="text-[9.5px] opacity-75 mt-0.5">Before cuts</p>
                  </div>

                  <div className={`p-3 rounded-2xl border ${styles.heroSubCard}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">🚚</span>
                      <p className={`text-[10.5px] font-bold uppercase tracking-wider ${styles.heroSubLabel}`}>Trips Logged</p>
                    </div>
                    <p className="text-base sm:text-lg font-black text-white font-mono">
                      {activeSummary.count} <span className="text-xs font-normal font-sans opacity-90">({activeSummary.paidCount} paid)</span>
                    </p>
                    <p className="text-[9.5px] opacity-75 mt-0.5">
                      {activeSummary.count > 0 ? `${Math.round((activeSummary.paidCount / activeSummary.count) * 100)}% settled` : "No trips"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: OPERATIONS DOCK & QUICK ACTIONS (4-5 COLS) ── */}
            <div className="lg:col-span-5 xl:col-span-4 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">
                      Operations Dock
                    </h2>
                  </div>
                  {activeAlertsCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                      {activeAlertsCount} Action{activeAlertsCount > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ All Clear
                    </span>
                  )}
                </div>

                {/* Priority Status Alerts */}
                <div className="space-y-2.5">
                  {approvalPendingTrips.length > 0 && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={onGoToTrips}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/70 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-200/60 flex items-center justify-center text-base text-amber-800 group-hover:scale-105 transition-transform">
                          ⏳
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-amber-950 truncate">
                            {approvalPendingTrips.length} Pending Approval
                          </p>
                          <p className="text-[10px] text-amber-800/80">Review dispatcher logs</p>
                        </div>
                      </div>
                      <span className="text-amber-700 group-hover:translate-x-0.5 transition-transform text-xs font-black">→</span>
                    </div>
                  )}

                  {brokerBalance > 0 && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-rose-50/80 border border-rose-200/70">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 shrink-0 rounded-xl bg-rose-200/60 flex items-center justify-center text-base text-rose-800">
                          💸
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-rose-950 truncate">
                            KES {fmt(brokerBalance)} Due
                          </p>
                          <p className="text-[10px] text-rose-700">Broker balance payable</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-200/60 text-rose-800 rounded-md">Pending</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Launch Buttons (Distinct, modern card grid) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  System Shortcuts
                </p>

                {onGoToPayments && (
                  <button
                    type="button"
                    onClick={onGoToPayments}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-sky-50/80 border border-slate-200/60 hover:border-sky-300 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                        💰
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-sky-950 truncate">
                          Payment Records & Receipts
                        </p>
                        <p className="text-[10px] text-slate-400">Record settlements & export PDF statements</p>
                      </div>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-700 text-xs font-black">→</span>
                  </button>
                )}

                {onGoToReconciliation && (
                  <button
                    type="button"
                    onClick={onGoToReconciliation}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/60 hover:border-emerald-300 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                        ⚖️
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 truncate">
                          Financial Reconciliation
                        </p>
                        <p className="text-[10px] text-slate-400">Audit profits, deductions & boss balance</p>
                      </div>
                    </div>
                    <span className="text-slate-400 group-hover:text-emerald-700 text-xs font-black">→</span>
                  </button>
                )}

                {onGoToMarketing && (
                  <button
                    type="button"
                    onClick={onGoToMarketing}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-amber-50/80 border border-slate-200/60 hover:border-amber-300 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                        📇
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-amber-950 truncate">
                          Cards & Posters Studio
                        </p>
                        <p className="text-[10px] text-slate-400">Branded cards & water delivery posters</p>
                      </div>
                    </div>
                    <span className="text-slate-400 group-hover:text-amber-700 text-xs font-black">→</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── LIVE FLEET RADAR & TODAY'S VEHICLE STRIP ── */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🚛</span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                  Live Fleet Radar · Today
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 font-mono">
                {vehicles.length} Tankers
              </span>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar snap-x">
              {vehicleTodayStats.map(v => {
                const isProfitable = v.summary.netProfit > 0;
                const isLoss = v.summary.netProfit < 0;
                return (
                  <div
                    key={v.id}
                    className="snap-start shrink-0 w-72 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Lorry License Plate aesthetic */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-xs tracking-wider shadow-2xs border border-slate-700">
                            🇰🇪 {v.plate}
                          </span>
                        </div>
                        <Badge color={isProfitable ? "green" : isLoss ? "red" : "slate"}>
                          {v.summary.count} {v.summary.count === 1 ? "trip" : "trips"}
                        </Badge>
                      </div>

                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Net Profit Today
                      </p>
                      <p className={`text-2xl font-black font-mono tracking-tight mt-0.5 ${
                        isProfitable ? "text-emerald-600" : isLoss ? "text-rose-500" : "text-slate-400"
                      }`}>
                        <span className="text-xs font-normal text-slate-400 mr-1">KES</span>
                        {fmt(v.summary.netProfit)}
                      </p>
                    </div>

                    {/* Mini Revenue / Expense pills */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Rev: <strong className="text-slate-800 font-mono">{fmt(v.summary.revenue)}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>Exp: <strong className="text-rose-600 font-mono">{fmt(v.summary.operatingExpenses)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── CHARTS ROW: PROFIT TREND & FLEET MONTHLY COMPARISON ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Profit Trend Chart */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">📈</span>
                    <h3 className="text-base font-bold text-slate-900">Profit & Cash Flow Trend</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Continuous audit of Revenue, Expenses & Realized Profit</p>
                </div>
                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
                  <RangeBtn label="7 Days" active={chartRange === 7} onClick={() => setChartRange(7)} />
                  <RangeBtn label="14 Days" active={chartRange === 14} onClick={() => setChartRange(14)} />
                  <RangeBtn label="30 Days" active={chartRange === 30} onClick={() => setChartRange(30)} />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 mb-5 pb-3 border-b border-slate-100">
                <LegendDot color={styles.chartRevenue} label="Revenue" />
                <LegendDot color={styles.chartExpenses} label="Expenses" />
                <LegendDot color={styles.chartOpProfit} label="Op. Profit" />
                <LegendDot color={styles.chartNetProfit} label="Net Profit" />
              </div>

              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={styles.chartRevenue} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={styles.chartRevenue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={styles.chartExpenses} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={styles.chartExpenses} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={styles.chartOpProfit} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={styles.chartOpProfit} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={styles.chartNetProfit} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={styles.chartNetProfit} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1.5, strokeDasharray: "4 4" }} />
                  <Area type="monotone" dataKey="revenue" stroke={styles.chartRevenue} strokeWidth={2.5} fill="url(#gradRevenue)" dot={false} activeDot={{ r: 5, fill: styles.chartRevenue, stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="expenses" stroke={styles.chartExpenses} strokeWidth={2.5} fill="url(#gradExpenses)" dot={false} activeDot={{ r: 5, fill: styles.chartExpenses, stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="operatingProfit" stroke={styles.chartOpProfit} strokeWidth={2.5} fill="url(#gradProfit)" dot={false} activeDot={{ r: 5, fill: styles.chartOpProfit, stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="netProfit" stroke={styles.chartNetProfit} strokeWidth={3} fill="url(#gradNet)" dot={false} activeDot={{ r: 6, fill: styles.chartNetProfit, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Fleet Comparison Bar Chart */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-base">📊</span>
                  <h3 className="text-base font-bold text-slate-900">Monthly Fleet Leaderboard</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Comparative revenue vs profit performance by vehicle</p>
              </div>
              <div className="flex flex-wrap gap-4 mb-5 pb-3 border-b border-slate-100">
                <LegendDot color={styles.chartRevenue} label="Revenue" />
                <LegendDot color={styles.chartOpProfit} label="Op. Profit" />
                <LegendDot color={styles.chartNetProfit} label="Net Profit" />
              </div>
              <div className="flex-1 min-h-[270px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vehicleMonthStats} barGap={6} barCategoryGap="25%" margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} dy={8} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} dx={-10} />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: "#f8fafc", opacity: 0.8 }} />
                    <Bar dataKey="revenue" fill={styles.chartRevenue} radius={[6, 6, 0, 0]} maxBarSize={38} />
                    <Bar dataKey="operatingProfit" fill={styles.chartOpProfit} radius={[6, 6, 0, 0]} maxBarSize={38} />
                    <Bar dataKey="netProfit" fill={styles.chartNetProfit} radius={[6, 6, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── SECONDARY METRICS: LIABILITIES & UNPAID TRIPS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Outstanding Liabilities */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">💼</span>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    Outstanding Liabilities
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Current Position
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Total Liabilities</p>
                  <p className={`text-xl font-black font-mono ${totalLiabilities > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                    KES {fmt(totalLiabilities)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Broker balance + driver pay</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Pending Personnel</p>
                  <p className="text-xl font-black font-mono text-slate-800">
                    KES {fmt(pendingPersonnel)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Driver trip allowances</p>
                </div>
              </div>
            </div>

            {/* Pending Payment Trips */}
            <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-amber-50/50 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <h3 className="text-xs font-black text-amber-950 uppercase tracking-widest">
                      Unpaid Trips Watchlist
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    {paymentPendingTrips.length} {paymentPendingTrips.length === 1 ? "trip" : "trips"} awaiting settlement
                  </p>
                </div>
                {paymentPendingTrips.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPendingOpen(v => !v)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-200/70 hover:bg-amber-200 text-amber-950 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    {pendingOpen ? "Hide" : "Expand"} ({paymentPendingTrips.length})
                  </button>
                )}
              </div>
              
              {paymentPendingTrips.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/70 border border-amber-200/50 text-center">
                  <p className="text-xs font-bold text-emerald-800">✓ All delivered trips are fully settled!</p>
                </div>
              ) : pendingOpen ? (
                <div className="space-y-2.5 mt-3">
                  {paymentPendingTrips.slice(0, 4).map((trip) => (
                    <div
                      key={trip.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenTripReview?.(trip)}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 hover:bg-white p-3.5 transition-all border border-amber-200/60 shadow-2xs cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-xs truncate">
                          {trip.lorry} · {trip.location || "N/A"}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{trip.date}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-black font-mono text-amber-800">
                          KES {fmt((trip.revenue || 0) - (trip.amountPaid || 0))}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onMarkTripPaid?.(trip); }}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs cursor-pointer transition-colors"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {paymentPendingTrips.length > 4 && (
                    <button
                      type="button"
                      onClick={onGoToTrips}
                      className="w-full py-2.5 text-xs font-bold text-amber-900 hover:text-amber-950 text-center hover:bg-amber-100/60 rounded-xl transition-colors cursor-pointer"
                    >
                      View all {paymentPendingTrips.length} unpaid trips →
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        /* ── DRIVER VIEW (Modernized & Sleek) ── */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">My Outstanding Earnings</p>
              <p className={`text-3xl font-black font-mono ${pendingPersonnel > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                KES {fmt(pendingPersonnel)}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Trips Completed Today</p>
              <p className="text-3xl font-black font-mono text-blue-600">{todaySummary.count}</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Trips This Week</p>
              <p className="text-3xl font-black font-mono text-emerald-600">{weekSummary.count}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-5 text-base">Your Recent Deliveries</h3>
            <div className="space-y-2.5">
              {trips.slice(0, 5).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTripReview?.(t)}
                  className="flex w-full items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/60 hover:border-slate-300 hover:bg-slate-100/70 transition-all text-left cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{t.date} <span className="text-slate-300 mx-1.5">|</span> {t.lorry}</p>
                    <p className="text-xs text-slate-500 mt-1">{t.location || 'N/A'}</p>
                  </div>
                  <Badge color={t.approvalStatus === 'approved' ? 'green' : t.approvalStatus === 'rejected' ? 'red' : 'amber'}>
                    {t.approvalStatus === 'approved' ? 'Approved' : t.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'}
                  </Badge>
                </button>
              ))}
              {trips.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-xs">No trips recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
