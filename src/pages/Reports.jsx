import { useMemo, useState } from "react";
import {
  today,
  getWeekRange,
  getMonthRange,
  filterByRange,
  summarize,
  collectDeductionKeys,
  collectExpenseKeys,
  isPaidTrip,
  sumDeductionKey,
  sumExpenseKey,
  fmt,
  locationMatchesFilter,
  parseLocationName
} from "../utils/helpers";
import { exportCSV, exportPDF, handleShareText } from "../utils/export";
import { Badge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { complaintService } from "../services/complaints";

const REPORT_TABS = [
  { id: "reports", label: "Reports" },
  { id: "complaints", label: "Complaints" },
];

const COMPLAINT_CATEGORIES = [
  "General",
  "Vehicle",
  "Trip",
  "Conduct",
  "Payment",
  "Safety",
  "Other",
];

const REPORT_TYPES = [
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "vehicle", label: "Vehicle" },
  { id: "route", label: "Route" },
  { id: "all", label: "Full" },
];

const REPORT_VIEWS = [
  { id: "summary", label: "Summary" },
  { id: "breakdown", label: "Breakdown" },
  { id: "trends", label: "Trends" },
  { id: "performance", label: "Performance" },
];

const formatComplaintDate = (value) => {
  if (!value) return "Just now";
  if (typeof value.toDate === "function") return value.toDate().toLocaleString();
  if (typeof value.toMillis === "function") return new Date(value.toMillis()).toLocaleString();
  return "Just now";
};

export default function ReportsPage({ trips, vehicles, complaints = [], globalVehicle, setGlobalVehicle }) {
  const { user, profile, isAdmin, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState("reports");
  const [range, setRange] = useState("daily");
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());
  const [reportType, setReportType] = useState("pending");
  const [filterRoute, setFilterRoute] = useState("All Routes");
  const [filterDetailedRoute, setFilterDetailedRoute] = useState("All Detailed Routes");
  const [filterTripStatus, setFilterTripStatus] = useState("All Trip Statuses");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("All Payment Statuses");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [reportView, setReportView] = useState("summary");

  const [complaintCategory, setComplaintCategory] = useState("General");
  const [complaintVehicle, setComplaintVehicle] = useState("");
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintDetails, setComplaintDetails] = useState("");
  const [complaintAnonymous, setComplaintAnonymous] = useState(false);
  const [complaintSaving, setComplaintSaving] = useState(false);
  const [moderatingId, setModeratingId] = useState("");
  const [complaintNote, setComplaintNote] = useState("");

  const resetAllFilters = () => {
    setGlobalVehicle("all");
    setFilterRoute("All Routes");
    setFilterDetailedRoute("All Detailed Routes");
    setFilterTripStatus("All Trip Statuses");
    setFilterPaymentStatus("All Payment Statuses");
  };

  const rangeTrips = useMemo(() => {
    let filtered = trips;
    if (globalVehicle !== "all") {
      filtered = filtered.filter(t => t.lorry === globalVehicle);
    }
    if (filterRoute !== "All Routes") {
      filtered = filtered.filter(t => locationMatchesFilter(t.location, filterRoute));
    }
    if (filterDetailedRoute !== "All Detailed Routes") {
      filtered = filtered.filter(t => (t.location || "N/A") === filterDetailedRoute);
    }
    if (filterTripStatus !== "All Trip Statuses") {
      filtered = filtered.filter(t => (t.approvalStatus || "approved") === filterTripStatus);
    }
    if (filterPaymentStatus !== "All Payment Statuses") {
      filtered = filtered.filter(t => (t.status || "Pending") === filterPaymentStatus);
    }
    if (reportType === "pending") {
      filtered = filtered.filter(t => !isPaidTrip(t));
    } else if (reportType === "paid") {
      filtered = filtered.filter(isPaidTrip);
    } else if (reportType === "vehicle" && filterVehicle === "All Vehicles") {
      filtered = filtered.filter(t => t.lorry);
    } else if (reportType === "route" && filterRoute === "All Routes") {
      filtered = filtered.filter(t => t.location);
    }
    if (range === "daily") return filterByRange(filtered, today(), today());
    if (range === "weekly") { const [s, e] = getWeekRange(); return filterByRange(filtered, s, e); }
    if (range === "monthly") { const [s, e] = getMonthRange(); return filterByRange(filtered, s, e); }
    return filterByRange(filtered, customStart, customEnd);
  }, [trips, range, customStart, customEnd, reportType, filterVehicle, filterRoute, filterDetailedRoute, filterTripStatus, filterPaymentStatus]);

  const sum = useMemo(() => summarize(rangeTrips), [rangeTrips]);

  const activeLorryPlates = useMemo(() => {
    return [...new Set(rangeTrips.map(t => t.lorry))].sort();
  }, [rangeTrips]);

  const { fixed, custom: customLabels } = useMemo(() => collectExpenseKeys(rangeTrips), [rangeTrips]);
  const { fixed: deductionFixed, custom: deductionCustomLabels } = useMemo(() => collectDeductionKeys(rangeTrips), [rangeTrips]);

  const routeOptions = useMemo(() => {
    const options = new Set();
    trips.forEach(t => {
      const raw = t.location || "N/A";
      const parsed = parseLocationName(raw);
      options.add(parsed.parent || raw);
    });
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [trips]);

  const detailedRouteOptions = useMemo(() => {
    return [...new Set(trips.map(t => t.location || "N/A"))].sort((a, b) => a.localeCompare(b));
  }, [trips]);

  const routeStats = useMemo(() => {
    const byRoute = {};
    rangeTrips.forEach(t => {
      const raw = t.location || "N/A";
      const route = parseLocationName(raw).parent || raw;
      if (!byRoute[route]) byRoute[route] = [];
      byRoute[route].push(t);
    });
    return Object.keys(byRoute).sort().map(route => ({
      route,
      ...summarize(byRoute[route])
    }));
  }, [rangeTrips]);
  const dailyStats = useMemo(() => {
    const byDate = {};
    rangeTrips.forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = [];
      byDate[t.date].push(t);
    });
    return Object.keys(byDate).sort().map(date => ({ date, ...summarize(byDate[date]) }));
  }, [rangeTrips]);
  const monthlyStats = useMemo(() => {
    const byMonth = {};
    rangeTrips.forEach(t => {
      const month = (t.date || "").slice(0, 7) || "No date";
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(t);
    });
    return Object.keys(byMonth).sort().map(month => ({ month, ...summarize(byMonth[month]) }));
  }, [rangeTrips]);

  const visibleComplaints = useMemo(() => {
    if (isAdmin) return complaints;
    if (isOwner) return complaints.filter(c => c.status === "approved");
    return complaints.filter(c => c.reporterId === user?.uid);
  }, [complaints, isAdmin, isOwner, user?.uid]);

  const pendingComplaints = useMemo(() => complaints.filter(c => !c.status || c.status === "open"), [complaints]);

  const dateTitle = range === "custom"
    ? `${customStart} to ${customEnd}`
    : `${range.charAt(0).toUpperCase() + range.slice(1)}`;

  const reportTypeLabel = {
    pending: "Pending Trips",
    paid: "Paid Trips",
    all: "Full Financial",
    vehicle: "Vehicle",
    route: "Route",
  }[reportType] || "Financial";

  const title = `${dateTitle} ${reportTypeLabel} Report${globalVehicle !== "all" ? ` - ${globalVehicle}` : ""}${filterRoute !== "All Routes" ? ` - ${filterRoute}` : ""}${filterDetailedRoute !== "All Detailed Routes" ? ` - ${filterDetailedRoute}` : ""}`;

  const btnCls = (v) =>
    `px-4 py-2 rounded-xl text-sm font-bold transition-all ${range === v
      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  const tabCls = (tabId) =>
    `px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tabId
      ? "bg-slate-800 text-white shadow-md shadow-slate-800/20"
      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  const submitComplaint = async () => {
    if (isOwner) {
      setComplaintNote("Owner accounts can view approved complaints but cannot submit new ones.");
      return;
    }
    if (!complaintSubject.trim() || !complaintDetails.trim()) {
      setComplaintNote("Subject and details are required.");
      return;
    }
    setComplaintSaving(true);
    setComplaintNote("");
    try {
      await complaintService.add({
        category: complaintCategory,
        subject: complaintSubject.trim(),
        details: complaintDetails.trim(),
        relatedVehicle: complaintVehicle || "",
        anonymous: complaintAnonymous,
        reporterId: user?.uid || null,
        reporterName: profile?.name || user?.email || "Unknown",
        reporterEmail: user?.email || "",
        reporterRole: profile?.role || "user",
        status: "open",
      });
      setComplaintCategory("General");
      setComplaintVehicle("");
      setComplaintSubject("");
      setComplaintDetails("");
      setComplaintAnonymous(false);
      setComplaintNote("Complaint submitted successfully.");
      setActiveTab("complaints");
    } catch (e) {
      console.error(e);
      setComplaintNote("Failed to submit complaint.");
    } finally {
      setComplaintSaving(false);
    }
  };

  const moderateComplaint = async (complaint, status) => {
    if (!isAdmin || !complaint?.id) return;
    setModeratingId(complaint.id);
    try {
      await complaintService.update(complaint.id, {
        status,
        reviewedBy: profile?.name || user?.email || "Admin",
        reviewedById: user?.uid || null,
      });
      setComplaintNote(status === "approved" ? "Complaint approved." : "Complaint rejected.");
    } catch (e) {
      console.error(e);
      setComplaintNote("Failed to update complaint.");
    } finally {
      setModeratingId("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-800">Reports</h2>
        <div className="flex items-center gap-2 mobile-control-rail">
          {REPORT_TABS.map(tab => (
            <button key={tab.id} className={tabCls(tab.id)} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "reports" ? (
        <>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap gap-2 mobile-control-rail">
              {REPORT_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setReportType(type.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${reportType === type.id ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mobile-control-rail">
              {["daily", "weekly", "monthly", "custom"].map(v => (
                <button key={v} className={btnCls(v)} onClick={() => setRange(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <select
                  value={globalVehicle}
                  onChange={e => setGlobalVehicle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Vehicles</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.plate}>{v.plate} ({v.name})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setGlobalVehicle("all")}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none">
                  <option value="All Routes">All General Routes</option>
                  {routeOptions.map(route => <option key={route} value={route}>{route}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setFilterRoute("All Routes")}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(v => !v)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                {showAdvancedFilters ? "Hide advanced filters" : "Advanced filters"}
              </button>
              <button
                type="button"
                onClick={resetAllFilters}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
              >
                Reset all filters
              </button>
            </div>

            {showAdvancedFilters && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <select value={filterTripStatus} onChange={e => setFilterTripStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none">
                    <option value="All Trip Statuses">All Trip Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending Approval</option>
                    <option value="pending_edit">Pending Edit</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setFilterTripStatus("All Trip Statuses")}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select value={filterPaymentStatus} onChange={e => setFilterPaymentStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none">
                    <option value="All Payment Statuses">All Payment Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setFilterPaymentStatus("All Payment Statuses")}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <select value={filterDetailedRoute} onChange={e => setFilterDetailedRoute(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none">
                    <option value="All Detailed Routes">All Specific Routes</option>
                    {detailedRouteOptions.map(route => <option key={route} value={route}>{route}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFilterDetailedRoute("All Detailed Routes")}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {range === "custom" && (
            <div className="flex flex-wrap gap-3 items-center">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">From</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">To</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {[
                ["Gross Revenue", sum.revenue, "text-blue-700"],
                ["Operating Expenses", sum.operatingExpenses, "text-rose-600"],
                ["Operating Profit", sum.operatingProfit, sum.operatingProfit >= 0 ? "text-emerald-700" : "text-rose-600"],
                ["Deductions", sum.deductions, "text-amber-700"],
                ["Net Profit", sum.netProfit, sum.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"],
              ].map(([label, value, tone], index) => (
                <div key={label} className="relative rounded-xl bg-slate-50 p-3">
                  {index > 0 && <span className="absolute -left-2 top-1/2 hidden -translate-y-1/2 text-slate-300 md:block">→</span>}
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <p className={`mt-1 text-lg font-black ${tone}`}>{fmt(value)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-slate-100 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Trips</p>
                <p className="font-black text-slate-800">{sum.count}</p>
              </div>
              <div className="rounded-xl border border-slate-100 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Paid</p>
                <p className="font-black text-emerald-700">{sum.paidCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Pending</p>
                <p className="font-black text-amber-700">{sum.pendingCount}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {REPORT_VIEWS.map(view => (
              <button
                key={view.id}
                type="button"
                onClick={() => setReportView(view.id)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${reportView === view.id ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {view.label}
              </button>
            ))}
          </div>

          {reportView === "performance" && globalVehicle === "all" && activeLorryPlates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mobile-card-rail mobile-card-rail--wide">
              {activeLorryPlates.map(plate => {
                const vehSum = summarize(rangeTrips.filter(t => t.lorry === plate));
                return (
                  <div key={plate} className="responsive-card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{plate}</p>
                    <p className="text-lg font-black text-slate-800">{fmt(vehSum.netProfit)}</p>
                    <p className="mt-1 text-xs text-slate-500">{vehSum.count} trips · Rev {fmt(vehSum.revenue)} · Op profit {fmt(vehSum.operatingProfit)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {reportView === "performance" && routeStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mobile-card-rail mobile-card-rail--wide">
              {routeStats.map(item => (
                <div key={item.route} className="responsive-card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{item.route}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Revenue</p>
                      <p className="font-black text-blue-700">{fmt(item.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Net Profit</p>
                      <p className={`font-black ${item.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmt(item.netProfit)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {reportView === "breakdown" && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-bold text-slate-700">Operating Expense Breakdown</p>
              {[...fixed.map(k => ({ key: k, isCustom: false })), ...customLabels.map(k => ({ key: k, isCustom: true }))].map(({ key, isCustom }) => {
                const total = sumExpenseKey(rangeTrips, key, isCustom);
                const pct = sum.operatingExpenses > 0 ? (total / sum.operatingExpenses * 100).toFixed(1) : 0;
                return (
                  <div key={key} className="mobile-expense-row mb-2 flex items-center gap-3">
                    <span className="mobile-expense-label w-24 flex items-center gap-1 text-xs font-semibold capitalize text-slate-500">
                      {key}
                      {isCustom && <span className="rounded bg-emerald-100 px-1 text-[9px] font-bold text-emerald-600">custom</span>}
                    </span>
                    <div className="mobile-expense-bar h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mobile-expense-total w-28 text-right text-xs font-bold text-slate-700">{fmt(total)}</span>
                    <span className="mobile-expense-pct w-10 text-right text-xs text-slate-400">{pct}%</span>
                  </div>
                );
              })}
              {[...fixed, ...customLabels].length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">No expense data in this period</p>
              )}
            </div>
          )}

          {reportView === "breakdown" && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-bold text-slate-700">Deduction Summary</p>
              {[...deductionFixed.map(k => ({ key: k, isCustom: false })), ...deductionCustomLabels.map(k => ({ key: k, isCustom: true }))].map(({ key, isCustom }) => {
                const total = sumDeductionKey(rangeTrips, key, isCustom);
                const pct = sum.deductions > 0 ? (total / sum.deductions * 100).toFixed(1) : 0;
                return (
                  <div key={key} className="mobile-expense-row mb-2 flex items-center gap-3">
                    <span className="mobile-expense-label w-32 flex items-center gap-1 text-xs font-semibold capitalize text-slate-500">
                      {key.replace(/([A-Z])/g, " $1")}
                      {isCustom && <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">legacy</span>}
                    </span>
                    <div className="mobile-expense-bar h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mobile-expense-total w-28 text-right text-xs font-bold text-slate-700">{fmt(total)}</span>
                    <span className="mobile-expense-pct w-10 text-right text-xs text-slate-400">{pct}%</span>
                  </div>
                );
              })}
              {[...deductionFixed, ...deductionCustomLabels].every((key) => {
                const isCustom = deductionCustomLabels.includes(key);
                return sumDeductionKey(rangeTrips, key, isCustom) === 0;
              }) && (
                  <p className="py-4 text-center text-sm text-slate-400">No deductions in this period</p>
                )}
            </div>
          )}

          {reportView === "trends" && (dailyStats.length > 0 || monthlyStats.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="mb-4 text-sm font-bold text-slate-700">Daily Profit Trends</p>
                <div className="space-y-2">
                  {dailyStats.slice(-10).map(item => (
                    <div key={item.date} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-xs font-semibold text-slate-500">{item.date}</span>
                      <span className={`text-sm font-black ${item.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmt(item.netProfit)}</span>
                    </div>
                  ))}
                  {dailyStats.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No daily data</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="mb-4 text-sm font-bold text-slate-700">Monthly Summaries</p>
                <div className="space-y-2">
                  {monthlyStats.map(item => (
                    <div key={item.month} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-xs font-semibold text-slate-500">{item.month}</span>
                      <span className="text-sm font-black text-slate-800">{fmt(item.netProfit)}</span>
                    </div>
                  ))}
                  {monthlyStats.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No monthly data</p>}
                </div>
              </div>
            </div>
          )}

          {rangeTrips.length > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => exportCSV(rangeTrips, title.replace(/\s+/g, "-"))}
                className="flex-1 rounded-xl border-2 border-emerald-600 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50">
                ⬇ Export CSV
              </button>
              <button onClick={() => exportPDF(rangeTrips, title)}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700">
                📄 Export PDF
              </button>
              <button onClick={() => handleShareText(rangeTrips, filterVehicle, dateTitle)}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white shadow-lg shadow-slate-800/20 transition-colors hover:bg-slate-900">
                💬 Share Text
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
              No trips in this period
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Complaints</p>
                <h3 className="mt-1 text-lg font-black text-slate-800">Report anything</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Use this space to flag a problem, raise a concern, or send feedback from the field.
                </p>
              </div>
              <Badge color="slate">{visibleComplaints.length} submitted</Badge>
            </div>

            {complaintNote && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {complaintNote}
              </div>
            )}

            <div className="space-y-4">
              {!isOwner && (
                <div className="grid grid-cols-2 gap-3 mobile-form-grid">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
                    <select
                      value={complaintCategory}
                      onChange={e => setComplaintCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      {COMPLAINT_CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Related Vehicle</label>
                    <select
                      value={complaintVehicle}
                      onChange={e => setComplaintVehicle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">None</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.plate}>{v.plate} ({v.name})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {!isOwner && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Subject</label>
                  <input
                    value={complaintSubject}
                    onChange={e => setComplaintSubject(e.target.value)}
                    placeholder="Short summary of the issue"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {!isOwner && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Details</label>
                  <textarea
                    rows="5"
                    value={complaintDetails}
                    onChange={e => setComplaintDetails(e.target.value)}
                    placeholder="Explain what happened, where, and anything that would help us understand it."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {!isOwner && (
                <label className="flex items-center gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={complaintAnonymous}
                    onChange={e => setComplaintAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Submit anonymously in the complaint feed
                </label>
              )}

              {!isOwner && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={submitComplaint}
                    disabled={complaintSaving}
                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {complaintSaving ? "Submitting..." : "Submit Complaint"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComplaintCategory("General");
                      setComplaintVehicle("");
                      setComplaintSubject("");
                      setComplaintDetails("");
                      setComplaintAnonymous(false);
                      setComplaintNote("");
                    }}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-400">
                Logged in as {profile?.name || user?.email || "Unknown"}.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Moderation Queue</p>
                  <h4 className="mt-1 text-base font-black text-amber-900">Pending complaints</h4>
                </div>
                <Badge color="amber">{pendingComplaints.length}</Badge>
              </div>
              {pendingComplaints.length === 0 ? (
                <p className="text-sm text-amber-800">No complaints waiting for review.</p>
              ) : (
                <div className="space-y-3">
                  {pendingComplaints.map((item) => (
                    <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-slate-800">{item.subject}</h4>
                            <Badge color="amber">{item.category || "General"}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {item.anonymous ? "Anonymous" : (item.reporterName || item.reporterEmail || "Unknown")} · {formatComplaintDate(item.createdAt)}
                          </p>
                        </div>
                        {item.relatedVehicle ? <Badge color="blue">{item.relatedVehicle}</Badge> : null}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.details}</p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => moderateComplaint(item, "approved")}
                          disabled={moderatingId === item.id}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {moderatingId === item.id ? "Working..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => moderateComplaint(item, "rejected")}
                          disabled={moderatingId === item.id}
                          className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-700">
                {isAdmin ? "All Complaints" : isOwner ? "Approved Complaints" : "Your Complaints"}
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {visibleComplaints.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No complaints submitted yet.
                </div>
              ) : visibleComplaints.map(item => {
                const reporter = item.anonymous ? "Anonymous" : (item.reporterName || item.reporterEmail || "Unknown");
                return (
                  <div key={item.id} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-800">{item.subject}</h4>
                          <Badge color="amber">{item.category || "General"}</Badge>
                          <Badge color={item.status === "resolved" ? "green" : "slate"}>{item.status || "open"}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {reporter} {item.reporterRole ? `· ${item.reporterRole}` : ""} · {formatComplaintDate(item.createdAt)}
                        </p>
                      </div>
                      {item.relatedVehicle ? <Badge color="blue">{item.relatedVehicle}</Badge> : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-600">{item.details}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
