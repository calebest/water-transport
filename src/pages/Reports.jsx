import { useMemo, useState } from "react";
import { today, getWeekRange, getMonthRange, filterByRange, summarize, collectExpenseKeys, sumExpenseKey, fmt } from "../utils/helpers";
import { exportCSV, exportPDF, handleShareText } from "../utils/export";
import { StatCard, Badge } from "../components/ui";
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

const formatComplaintDate = (value) => {
  if (!value) return "Just now";
  if (typeof value.toDate === "function") return value.toDate().toLocaleString();
  if (typeof value.toMillis === "function") return new Date(value.toMillis()).toLocaleString();
  return "Just now";
};

export default function ReportsPage({ trips, vehicles, complaints = [] }) {
  const { user, profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("reports");
  const [range, setRange] = useState("daily");
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());
  const [filterVehicle, setFilterVehicle] = useState("All Vehicles");

  const [complaintCategory, setComplaintCategory] = useState("General");
  const [complaintVehicle, setComplaintVehicle] = useState("");
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintDetails, setComplaintDetails] = useState("");
  const [complaintAnonymous, setComplaintAnonymous] = useState(false);
  const [complaintSaving, setComplaintSaving] = useState(false);
  const [complaintNote, setComplaintNote] = useState("");

  const rangeTrips = useMemo(() => {
    let filtered = trips;
    if (filterVehicle !== "All Vehicles") {
      filtered = filtered.filter(t => t.lorry === filterVehicle);
    }
    if (range === "daily") return filterByRange(filtered, today(), today());
    if (range === "weekly") { const [s, e] = getWeekRange(); return filterByRange(filtered, s, e); }
    if (range === "monthly") { const [s, e] = getMonthRange(); return filterByRange(filtered, s, e); }
    return filterByRange(filtered, customStart, customEnd);
  }, [trips, range, customStart, customEnd, filterVehicle]);

  const sum = useMemo(() => summarize(rangeTrips), [rangeTrips]);

  const activeLorryPlates = useMemo(() => {
    return [...new Set(rangeTrips.map(t => t.lorry))].sort();
  }, [rangeTrips]);

  const { fixed, custom: customLabels } = useMemo(() => collectExpenseKeys(rangeTrips), [rangeTrips]);

  const visibleComplaints = useMemo(() => {
    if (isAdmin) return complaints;
    return complaints.filter(c => c.reporterId === user?.uid);
  }, [complaints, isAdmin, user?.uid]);

  const dateTitle = range === "custom"
    ? `${customStart} to ${customEnd}`
    : `${range.charAt(0).toUpperCase() + range.slice(1)}`;

  const title = `${dateTitle} Report${filterVehicle !== "All Vehicles" ? ` - ${filterVehicle}` : ""}`;

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 mobile-control-rail">
              {["daily", "weekly", "monthly", "custom"].map(v => (
                <button key={v} className={btnCls(v)} onClick={() => setRange(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={filterVehicle}
              onChange={e => setFilterVehicle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none sm:w-auto"
            >
              <option value="All Vehicles">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.plate}>{v.plate} ({v.name})</option>
              ))}
            </select>
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mobile-card-rail mobile-card-rail--compact">
            <StatCard label="Revenue" value={fmt(sum.revenue)} icon="💰" color="blue" />
            <StatCard label="Expenses" value={fmt(sum.expenses)} icon="📉" color="red" />
            <StatCard label="Profit" value={fmt(sum.profit)} icon="📈" color="green" />
            <StatCard label="Trips" value={sum.count} icon="🚛" color="amber" />
          </div>

          {filterVehicle === "All Vehicles" && activeLorryPlates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mobile-card-rail mobile-card-rail--wide">
              {activeLorryPlates.map(plate => {
                const vehSum = summarize(rangeTrips.filter(t => t.lorry === plate));
                return (
                  <div key={plate} className="responsive-card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{plate}</p>
                    <p className="text-lg font-black text-slate-800">{fmt(vehSum.profit)}</p>
                    <p className="mt-1 text-xs text-slate-500">{vehSum.count} trips · Rev {fmt(vehSum.revenue)} · Exp {fmt(vehSum.expenses)}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-bold text-slate-700">Expense Breakdown</p>
            {[...fixed.map(k => ({ key: k, isCustom: false })), ...customLabels.map(k => ({ key: k, isCustom: true }))].map(({ key, isCustom }) => {
              const total = sumExpenseKey(rangeTrips, key, isCustom);
              const pct = sum.expenses > 0 ? (total / sum.expenses * 100).toFixed(1) : 0;
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

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Subject</label>
                <input
                  value={complaintSubject}
                  onChange={e => setComplaintSubject(e.target.value)}
                  placeholder="Short summary of the issue"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

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

              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={complaintAnonymous}
                  onChange={e => setComplaintAnonymous(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Submit anonymously in the complaint feed
              </label>

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
              <p className="text-xs text-slate-400">
                Logged in as {profile?.name || user?.email || "Unknown"}.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-700">
                {isAdmin ? "All Complaints" : "Your Complaints"}
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
