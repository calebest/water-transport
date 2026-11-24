import { useState, useMemo, useEffect } from "react";
import { tripService } from "../services/trips";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Modal } from "../components/ui";
import { fmt, getTripFinancials, summarize } from "../utils/helpers";
import { exportVoucher } from "../utils/export";
import TripForm from "../components/TripForm";

// ─── Approval Helpers ────────────────────────────────────────────────────────

const APPROVAL_BADGE = {
  pending:      { color: "amber", label: "⏳ Awaiting Approval" },
  pending_edit: { color: "amber", label: "⚠️ Edit Pending" },
  rejected:     { color: "red",   label: "❌ Rejected" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TripsPage({ trips, locations, vehicles, personnel = [], brokers = [], settings, onOpenTripReview, refreshTrips, globalVehicle, setGlobalVehicle }) {
  const { isAdmin, isOwner, isPrivileged, canAddTrips, userId } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [delTrip, setDelTrip] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [rejectPending, setRejectPending] = useState(null); // { trip } — awaiting reason input
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [search, setSearch] = useState(() => localStorage.getItem("wt_trips_search") || "");
  const [filterDate, setFilterDate] = useState(() => localStorage.getItem("wt_trips_filterDate") || "");
  const [deleting, setDeleting] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(() => localStorage.getItem("wt_trips_approvalsOpen") !== "false");

  // Persist state
  useEffect(() => {
    localStorage.setItem("wt_trips_search", search);
    localStorage.setItem("wt_trips_filterDate", filterDate);
    localStorage.setItem("wt_trips_approvalsOpen", approvalsOpen);
  }, [search, filterDate, approvalsOpen]);

  // Pending new trips for admin approval panel
  const pendingNewTrips = useMemo(() =>
    isAdmin ? trips.filter(t => t.approvalStatus === "pending") : [],
    [trips, isAdmin]);

  // Pending edits for admin approval panel
  const pendingEditTrips = useMemo(() =>
    isAdmin ? trips.filter(t => t.approvalStatus === "pending_edit") : [],
    [trips, isAdmin]);

  // Trips to display in the main grouped table
  const visibleTrips = useMemo(() => {
    if (isAdmin) {
      // Admin: approved trips + pending_edit trips (shown inline with indicator)
      return trips.filter(t => !t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit");
    }
    if (isOwner) {
      return trips;
    }
    // Driver/Conductor/Viewer: approved trips + their own pending/rejected submissions
    return trips.filter(t =>
      (!t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit") ||
      (t.submittedBy === userId && (t.approvalStatus === "pending" || t.approvalStatus === "rejected"))
    );
  }, [trips, isAdmin, isOwner, userId]);

  const groupedTrips = useMemo(() => {
    const filtered = visibleTrips.filter(t => {
      if (globalVehicle !== "all" && t.lorry !== globalVehicle) return false;
      if (filterDate && t.date !== filterDate) return false;
      if (search) {
        const s = search.toLowerCase();
        return t.tripNumber?.toString().includes(s) ||
               t.lorry?.toLowerCase().includes(s) ||
               t.date?.includes(s) ||
               t.location?.toLowerCase().includes(s);
      }
      return true;
    });

    const groups = {};
    filtered.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });

    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
      // Sort trips: first by vehicle plate (A→Z), then by trip number numerically
      const sorted = groups[date].slice().sort((a, b) => {
        const lorryCompare = (a.lorry || "").localeCompare(b.lorry || "");
        if (lorryCompare !== 0) return lorryCompare;
        const numA = parseInt(String(a.tripNumber || "0").replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(String(b.tripNumber || "0").replace(/\D/g, ""), 10) || 0;
        return numA - numB;
      });
      return {
        date,
        trips: sorted,
        // Admin summary excludes unapproved submissions; owner sees the full log breakdown.
        summary: summarize(
          isAdmin
            ? sorted.filter(t => !t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit")
            : sorted
        ),
      };
    });
  }, [visibleTrips, globalVehicle, filterDate, search, isAdmin]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAdd = async (form) => {
    await tripService.add(form, { userId, isAdmin: isPrivileged, directApproval: settings?.directApproval });
    if (refreshTrips) refreshTrips();
  };

  const handleEdit = async (form) => {
    await tripService.update(editTrip.id, form, { 
      isAdmin: isPrivileged, 
      directApproval: settings?.directApproval,
      isPending: editTrip?.approvalStatus === "pending" || editTrip?.approvalStatus === "rejected",
    });
    if (refreshTrips) refreshTrips();
  };

  const handleApprove = async (trip) => {
    try { 
      await tripService.approve(trip.id, trip, {}); 
      if (refreshTrips) refreshTrips();
    }
    catch (e) { alert(e.message); }
  };

  const handleReject = async (trip, reason) => {
    try { 
      await tripService.reject(trip.id, trip, reason || "Rejected by administrator."); 
      if (refreshTrips) refreshTrips();
    }
    catch (e) { alert(e.message); }
  };

  // Opens the reject reason modal
  const openRejectModal = (trip) => {
    setRejectPending(trip);
    setRejectReason("");
  };

  // Confirms rejection with the entered reason
  const confirmReject = async () => {
    if (!rejectPending) return;
    setRejecting(true);
    try {
      await handleReject(rejectPending, rejectReason.trim() || "Rejected by administrator.");
      setRejectPending(null);
      setRejectReason("");
    } finally {
      setRejecting(false);
    }
  };

  const handleStatusChange = async (trip, newStatus) => {
    setMarkingPaid(trip.id);
    try {
      const amountPaid = newStatus === "Paid" ? Number(trip.revenue)
        : newStatus === "Pending" ? 0
        : Number(trip.amountPaid || 0);
      await tripService.markPaid(trip.id, amountPaid, newStatus);
      if (refreshTrips) refreshTrips();
    }
    catch (e) { alert(e.message); }
    finally { setMarkingPaid(null); }
  };

  const handleDel = async () => {
    setDeleting(true);
    try { 
      await tripService.delete(delTrip.id); 
      setDelTrip(null); 
      if (refreshTrips) refreshTrips();
    }
    catch (e) { alert(e.message); }
    finally { setDeleting(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 lg:p-6 rounded-3xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight break-words">Trips & Logs</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Record, track, and reconcile all vehicle trips.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {canAddTrips && (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 sm:py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              <span>{isPrivileged ? "Record Trip" : "Submit Trip"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin — Pending Approvals Panel */}
      {isAdmin && (pendingNewTrips.length + pendingEditTrips.length > 0) && (
        <ApprovalsPanel
          newTrips={pendingNewTrips}
          editTrips={pendingEditTrips}
          open={approvalsOpen}
          onToggle={() => setApprovalsOpen(v => !v)}
          onApprove={handleApprove}
          onReject={openRejectModal}
        />
      )}

      {/* Driver/Conductor — info banner */}
      {!isAdmin && canAddTrips && (
        <div className="rounded-2xl bg-blue-50/80 border border-blue-200/60 p-4 flex items-center gap-3.5 text-sm text-blue-800 font-medium shadow-xs">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="min-w-0 break-words leading-relaxed">
            Trips you submit will be reviewed and approved by an administrator before appearing in final financial reconciliations.
          </p>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/70 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 border border-slate-200/60 outline-none transition-all placeholder-slate-400"
              placeholder="Search location, trip #, lorry…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Vehicle Dropdown */}
          <div className="relative">
            <select
              className="px-3.5 py-2 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 border border-slate-200/60 outline-none transition-all cursor-pointer"
              value={globalVehicle}
              onChange={e => setGlobalVehicle(e.target.value)}
            >
              <option value="all">All Vehicles</option>
              {(vehicles || []).map(v => (
                <option key={v.id} value={v.plate}>{v.plate}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              className="px-3 py-2 bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 border border-slate-200/60 outline-none transition-all cursor-pointer"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </div>

          {/* Clear Filters */}
          {(globalVehicle !== "all" || filterDate || search) && (
            <button
              onClick={() => { setGlobalVehicle("all"); setFilterDate(""); setSearch(""); }}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Global Expand/Collapse Toggle */}
        {groupedTrips.length > 0 && (
          <div className="shrink-0 self-end sm:self-center">
            <CollapseAllButton />
          </div>
        )}
      </div>

      {/* Trip List */}
      <div>
        {groupedTrips.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm p-12 sm:p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-3">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-base font-bold text-slate-700">No trips found</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              {search || filterDate || globalVehicle !== "all"
                ? "No trips match your active filters. Try clearing the search or date."
                : "No trip records have been created yet. Click 'Record Trip' to start."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTrips.map(group => (
              <TripGroup
                key={group.date}
                group={group}
                isAdmin={isPrivileged}
                onEdit={setEditTrip}
                onDel={setDelTrip}
                onStatusChange={handleStatusChange}
                markingPaid={markingPaid}
                onApprove={handleApprove}
                onReject={handleReject}
                userId={userId}
                canAddTrips={canAddTrips}
                onOpenTripReview={onOpenTripReview}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rejection reason modal */}
      <Modal open={!!rejectPending} onClose={() => setRejectPending(null)} title="Reject Trip">
        {rejectPending && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              You are rejecting trip <strong>#{rejectPending.tripNumber}</strong> ({rejectPending.lorry}, {rejectPending.date}).
              Please provide a reason so the driver/conductor can make corrections.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Revenue amount doesn't match records, please verify and resubmit..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRejectPending(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={rejecting}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {rejecting ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={addOpen} onClose={() => setAddOpen(false)}
        title={isAdmin ? "Add New Trip" : "Submit Trip for Approval"} wide>
        <TripForm locations={locations} personnel={personnel} vehicles={vehicles} brokers={brokers} onSave={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editTrip} onClose={() => setEditTrip(null)}
        title={
          isPrivileged ? "Edit Trip" 
          : editTrip?.approvalStatus === "rejected" ? "Resubmit Trip (Rejected — Edit & Resubmit for Approval)"
          : editTrip?.approvalStatus === "pending" ? "Edit Pending Trip (Submit for Approval)"
          : "Propose Trip Edit (requires approval)"
        } wide>
        {editTrip && <TripForm locations={locations} personnel={personnel} vehicles={vehicles} brokers={brokers} initial={editTrip} onSave={handleEdit} onCancel={() => setEditTrip(null)} />}
      </Modal>
      <Modal open={!!delTrip} onClose={() => setDelTrip(null)} title="Delete Trip">
        {delTrip && (
          <div className="space-y-4">
            <p className="text-slate-600">
              Delete trip <strong>{delTrip.tripNumber}</strong> on {delTrip.date} ({delTrip.lorry})?
              <br /><span className="text-rose-500 font-semibold">This cannot be undone.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelTrip(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleDel} disabled={deleting}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Approvals Panel (admin only) ────────────────────────────────────────────

function ApprovalsPanel({ newTrips, editTrips, open, onToggle, onApprove, onReject }) {
  const total = newTrips.length + editTrips.length;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      
      <div
        className="relative z-10 flex items-center justify-between p-5 lg:p-6 cursor-pointer hover:bg-white/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-900">Pending Approvals</h3>
            <p className="text-sm font-medium text-amber-700/70">{total} items require your attention</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-black w-8 h-8 shadow-sm">{total}</span>
          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-amber-600">
            <svg className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      <div className={`relative z-10 grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-5 lg:px-6 pb-6 space-y-6">
            {/* New trip submissions */}
            {newTrips.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-amber-800/60 flex items-center gap-2">
                  <span className="w-4 h-px bg-amber-300/50"></span>
                  New Submissions ({newTrips.length})
                </h4>
                {newTrips.map(t => (
                  <div key={t.id} className="rounded-2xl bg-white/70 backdrop-blur-md border border-white p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black font-mono tracking-wide bg-slate-100 text-slate-800 border border-slate-200">
                            🚛 {t.lorry}
                          </span>
                          <span className="text-sm font-bold text-slate-400">Trip #{t.tripNumber}</span>
                        </div>
                        <p className="text-lg font-black text-slate-800">{t.date}</p>
                        <p className="text-sm text-slate-500 font-medium">{t.location || "No location specified"}</p>
                      </div>
                      
                      <div className="flex bg-white rounded-xl p-2 border border-slate-100 shadow-sm self-start md:self-center gap-6">
                         <div className="px-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Revenue</p>
                            <p className="font-black text-slate-700">{fmt(t.revenue)}</p>
                         </div>
                         <div className="px-2 border-l border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Expenses</p>
                            <p className="font-black text-rose-500">{fmt(getTripFinancials(t).operatingExpenses)}</p>
                         </div>
                         <div className="px-2 border-l border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Net Payable</p>
                            <p className={`font-black ${getTripFinancials(t).netPayable >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmt(getTripFinancials(t).netPayable)}</p>
                         </div>
                      </div>

                      <div className="flex gap-2 self-start md:self-center w-full md:w-auto">
                        <button onClick={() => onApprove(t)}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          Approve
                        </button>
                        <button onClick={() => onReject(t)}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 shadow-sm hover:bg-rose-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending edits */}
            {editTrips.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-amber-800/60 flex items-center gap-2">
                  <span className="w-4 h-px bg-amber-300/50"></span>
                  Proposed Edits ({editTrips.length})
                </h4>
                {editTrips.map(t => {
                  const p = t.pendingEdits || {};
                  const LABELS = { date: "Date", lorry: "Lorry", location: "Location", revenue: "Revenue", amountPaid: "Amount Paid" };
                  const changes = Object.entries(LABELS).filter(([key]) =>
                    p[key] !== undefined && String(p[key]) !== String(t[key])
                  );
                  return (
                    <div key={t.id} className="rounded-2xl bg-white/70 backdrop-blur-md border border-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black font-mono tracking-wide bg-slate-100 text-slate-800 border border-slate-200">
                              🚛 {t.lorry}
                            </span>
                            <span className="text-sm font-bold text-slate-400">Trip #{t.tripNumber}</span>
                          </div>
                          <p className="text-lg font-black text-slate-800">{t.date}</p>
                          
                          {changes.length > 0 ? (
                            <div className="mt-4 bg-white rounded-xl border border-amber-100 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-3">Proposed Changes</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                {changes.map(([key, label]) => (
                                  <div key={key} className="flex items-center text-sm">
                                    <span className="font-semibold text-slate-400 w-24 flex-shrink-0">{label}</span>
                                    <span className="text-rose-500 line-through decoration-rose-300 truncate w-20">{String(t[key])}</span>
                                    <svg className="w-4 h-4 text-slate-300 mx-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    <span className="text-emerald-600 font-bold truncate">{String(p[key])}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 mt-2">Edit details not available.</p>
                          )}
                        </div>

                        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                          <button onClick={() => onApprove(t)}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            Apply Edit
                          </button>
                          <button onClick={() => onReject(t)}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 shadow-sm hover:bg-rose-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            Discard
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Collapse All Button (controls all TripGroups via a shared ref map) ────────
function CollapseAllButton() {
  const [allExpanded, setAllExpanded] = useState(true);
  return (
    <button
      onClick={() => {
        // Dispatch a custom event that TripGroups listen to
        window.dispatchEvent(new CustomEvent("trips:setAllExpanded", { detail: !allExpanded }));
        setAllExpanded(!allExpanded);
      }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
    >
      <svg className={`w-3.5 h-3.5 transition-transform ${allExpanded ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      {allExpanded ? "Collapse All" : "Expand All"}
    </button>
  );
}

// ─── Trip Group (date-grouped list) ──────────────────────────────────────────
export function TripGroup({ group, isAdmin, onEdit, onDel, onStatusChange, markingPaid, onApprove, onReject, userId, canAddTrips, onOpenTripReview }) {
  const [expanded, setExpanded] = useState(true);

  // Listen to global collapse/expand events
  useEffect(() => {
    const handler = (e) => setExpanded(e.detail);
    window.addEventListener("trips:setAllExpanded", handler);
    return () => window.removeEventListener("trips:setAllExpanded", handler);
  }, []);

  // Who can edit/delete each trip row
  const canEditTrip = (t) =>
    isAdmin ||
    (canAddTrips && t.submittedBy === userId && (t.approvalStatus === "approved" || t.approvalStatus === "pending" || t.approvalStatus === "rejected"));
  const canDelTrip = (t) =>
    isAdmin || (canAddTrips && t.submittedBy === userId && (t.approvalStatus === "pending" || t.approvalStatus === "rejected"));

  const paymentBadgeColor = (status) =>
    status === "Paid" ? "green" : status === "Partial" ? "amber" : "red";

  const paymentSelectClass = (status) =>
    status === "Paid"    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70"
    : status === "Partial" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/70"
    :                        "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/70";

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden transition-all">
      {/* Group Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100 select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left: Date + count */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 shrink-0 ${expanded ? "bg-slate-800 text-white shadow-xs" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-800 break-words">{group.date}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                {group.trips.length} {group.trips.length === 1 ? 'trip' : 'trips'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Summary pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rev</span>
            <span className="text-xs sm:text-sm font-black font-mono text-blue-600">{fmt(group.summary.revenue)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Exp</span>
            <span className="text-xs sm:text-sm font-black font-mono text-rose-500">{fmt(group.summary.operatingExpenses)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ded</span>
            <span className="text-xs sm:text-sm font-black font-mono text-amber-500">{fmt(group.summary.deductions)}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
            group.summary.operatingProfit >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Profit</span>
            <span className="text-xs sm:text-sm font-black font-mono">{fmt(group.summary.operatingProfit)}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-slate-100">
          {group.trips.map((t) => {
            const approval = t.approvalStatus && t.approvalStatus !== "approved" ? t.approvalStatus : null;
            const isRejected = t.approvalStatus === "rejected";
            const isPendingEdit = t.approvalStatus === "pending_edit";
            const isPending = t.approvalStatus === "pending";
            const financials = getTripFinancials(t);

            return (
              <div
                key={t.id}
                className={`group flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 transition-colors ${
                  isRejected ? "bg-rose-50/30" :
                  isPending ? "bg-amber-50/30" :
                  "hover:bg-slate-50/70 bg-white"
                }`}
              >
                {/* 1. Identity & Destination */}
                <div className="flex flex-col gap-1.5 min-w-0 lg:max-w-xs xl:max-w-sm flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black font-mono tracking-wide bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                      🚛 {t.lorry}
                    </span>
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      #{t.tripNumber}
                    </span>
                    {approval && APPROVAL_BADGE[approval] && (
                      <Badge color={APPROVAL_BADGE[approval].color}>
                        {APPROVAL_BADGE[approval].label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-800 min-w-0">
                    <span className="text-emerald-600 shrink-0 text-sm">📍</span>
                    <p className="text-sm sm:text-base font-bold text-slate-800 break-words leading-tight" title={t.location || "No location"}>
                      {t.location || "No location"}
                    </p>
                  </div>
                </div>

                {/* 2. Financial Metrics Grid (4 compact cards) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
                  <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl min-w-[95px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Revenue</p>
                    <p className="text-xs sm:text-sm font-black font-mono text-slate-800 break-words">{fmt(financials.revenue)}</p>
                  </div>
                  <div className="bg-rose-50/50 border border-rose-100/70 px-3 py-1.5 rounded-xl min-w-[95px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400">Expenses</p>
                    <p className="text-xs sm:text-sm font-bold font-mono text-rose-600 break-words">{fmt(financials.operatingExpenses)}</p>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-100/70 px-3 py-1.5 rounded-xl min-w-[95px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500">Deductions</p>
                    <p className="text-xs sm:text-sm font-bold font-mono text-amber-600 break-words">{fmt(financials.totalDeductions)}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border min-w-[95px] ${
                    financials.netPayable >= 0 ? "bg-emerald-50/60 border-emerald-200/80" : "bg-rose-50/60 border-rose-200/80"
                  }`}>
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${financials.netPayable >= 0 ? "text-emerald-600" : "text-rose-500"}`}>Net Payable</p>
                    <p className={`text-xs sm:text-sm font-black font-mono break-words ${financials.netPayable >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {fmt(financials.netPayable)}
                    </p>
                  </div>
                </div>

                {/* 3. Status & Action Buttons */}
                <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t border-slate-100 lg:border-t-0">
                  {/* Status Dropdown / Badge */}
                  <div className="flex items-center">
                    {isAdmin && !isRejected && !isPending ? (
                      <select
                        value={t.status}
                        disabled={markingPaid === t.id}
                        onChange={e => onStatusChange(t, e.target.value)}
                        className={`rounded-xl border px-2.5 py-1 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 cursor-pointer transition-colors shadow-2xs ${paymentSelectClass(t.status)}`}
                        aria-label={`Payment status for trip ${t.tripNumber}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Partial">Partial</option>
                        <option value="Paid">Paid</option>
                      </select>
                    ) : (
                      <Badge color={paymentBadgeColor(t.status)}>{t.status}</Badge>
                    )}
                  </div>

                  {/* Action Button Rail */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isRejected && (
                      <button
                        type="button"
                        onClick={() => exportVoucher(t)}
                        className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
                        title="Print Receipt"
                        aria-label="Print Receipt"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </button>
                    )}

                    {onOpenTripReview && (
                      <button
                        type="button"
                        onClick={() => onOpenTripReview(t)}
                        className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                        title="View Trip Review"
                        aria-label="View Trip Review"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    )}

                    {isAdmin && (isPending || isPendingEdit) && onApprove && onReject && (
                      <>
                        <button
                          type="button"
                          onClick={() => onApprove(t)}
                          className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/70 rounded-xl transition-all cursor-pointer"
                          title={isPendingEdit ? "Apply Proposed Edit" : "Approve Trip"}
                          aria-label="Approve Trip"
                        >
                          <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(t)}
                          className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-rose-600 hover:text-rose-700 hover:bg-rose-100/70 rounded-xl transition-all cursor-pointer"
                          title={isPendingEdit ? "Discard Edit" : "Reject Trip"}
                          aria-label="Reject Trip"
                        >
                          <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}

                    {canEditTrip(t) && !isPendingEdit && onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(t)}
                        className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all cursor-pointer"
                        title="Edit Trip"
                        aria-label="Edit Trip"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}

                    {canDelTrip(t) && onDel && (
                      <button
                        type="button"
                        onClick={() => onDel(t)}
                        className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Delete Trip"
                        aria-label="Delete Trip"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
