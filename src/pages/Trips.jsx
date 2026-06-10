import { useState, useMemo } from "react";
import { tripService } from "../services/trips";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Modal } from "../components/ui";
import { fmt, summarize } from "../utils/helpers";
import { exportVoucher } from "../utils/export";
import TripForm from "../components/TripForm";

// ─── Approval Helpers ────────────────────────────────────────────────────────

const APPROVAL_BADGE = {
  pending:      { color: "amber", label: "⏳ Awaiting Approval" },
  pending_edit: { color: "amber", label: "⚠️ Edit Pending" },
  rejected:     { color: "red",   label: "❌ Rejected" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TripsPage({ trips, locations, vehicles, personnel = [] }) {
  const { isAdmin, canAddTrips, userId } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [delTrip, setDelTrip] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [search, setSearch] = useState("");
  const [filterLorry, setFilterLorry] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(true);

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
    // Driver/Conductor/Viewer: approved trips + their own pending/rejected submissions
    return trips.filter(t =>
      (!t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit") ||
      (t.submittedBy === userId && (t.approvalStatus === "pending" || t.approvalStatus === "rejected"))
    );
  }, [trips, isAdmin, userId]);

  const groupedTrips = useMemo(() => {
    const filtered = visibleTrips.filter(t => {
      if (filterLorry !== "All" && t.lorry !== filterLorry) return false;
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

    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => ({
      date,
      trips: groups[date],
      // Summary only counts approved trips (not pending/rejected)
      summary: summarize(groups[date].filter(t => !t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit")),
    }));
  }, [visibleTrips, filterLorry, filterDate, search]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAdd  = (form) => tripService.add(form, { userId, isAdmin });
  const handleEdit = (form) => tripService.update(editTrip.id, form, { isAdmin });

  const handleApprove = async (trip) => {
    try { await tripService.approve(trip.id, trip); }
    catch (e) { alert(e.message); }
  };

  const handleReject = async (trip) => {
    try { await tripService.reject(trip.id, trip); }
    catch (e) { alert(e.message); }
  };

  const handleStatusChange = async (trip, newStatus) => {
    setMarkingPaid(trip.id);
    try {
      const amountPaid = newStatus === "Paid" ? Number(trip.revenue)
        : newStatus === "Pending" ? 0
        : Number(trip.amountPaid || 0);
      await tripService.markPaid(trip.id, amountPaid, newStatus);
    }
    catch (e) { alert(e.message); }
    finally { setMarkingPaid(null); }
  };

  const handleDel = async () => {
    setDeleting(true);
    try { await tripService.delete(delTrip.id); setDelTrip(null); }
    catch (e) { alert(e.message); }
    finally { setDeleting(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800">Trips</h2>
        {canAddTrips && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
            {isAdmin ? "+ Add Trip" : "＋ Submit Trip"}
          </button>
        )}
      </div>

      {/* Admin — Pending Approvals Panel */}
      {isAdmin && (pendingNewTrips.length + pendingEditTrips.length > 0) && (
        <ApprovalsPanel
          newTrips={pendingNewTrips}
          editTrips={pendingEditTrips}
          open={approvalsOpen}
          onToggle={() => setApprovalsOpen(v => !v)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Driver/Conductor — info banner */}
      {!isAdmin && canAddTrips && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 font-medium">
          ℹ️ Trips you submit will be reviewed and approved by an admin before they appear in reports.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none w-40"
          placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          value={filterLorry} onChange={e => setFilterLorry(e.target.value)}>
          <option>All</option>
          {(vehicles || []).map(v => <option key={v.id} value={v.plate}>{v.plate}</option>)}
          {(!vehicles || vehicles.length === 0) && <><option>KBZ</option><option>KBL</option></>}
        </select>
        <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        {(filterLorry !== "All" || filterDate || search) && (
          <button onClick={() => { setFilterLorry("All"); setFilterDate(""); setSearch(""); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
            Clear
          </button>
        )}
      </div>

      {/* Trip List */}
      <div className="space-y-4">
        {groupedTrips.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400">
            No trips found
          </div>
        ) : groupedTrips.map(group => (
          <TripGroup
            key={group.date}
            group={group}
            isAdmin={isAdmin}
            onEdit={setEditTrip}
            onDel={setDelTrip}
            onStatusChange={handleStatusChange}
            markingPaid={markingPaid}
            onApprove={handleApprove}
            onReject={handleReject}
            userId={userId}
            canAddTrips={canAddTrips}
          />
        ))}
      </div>

      {/* Modals */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)}
        title={isAdmin ? "Add New Trip" : "Submit Trip for Approval"} wide>
        <TripForm locations={locations} personnel={personnel} vehicles={vehicles} onSave={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editTrip} onClose={() => setEditTrip(null)}
        title={isAdmin ? "Edit Trip" : "Propose Trip Edit (requires approval)"} wide>
        {editTrip && <TripForm locations={locations} personnel={personnel} vehicles={vehicles} initial={editTrip} onSave={handleEdit} onCancel={() => setEditTrip(null)} />}
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
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden shadow-sm">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-amber-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⏳</span>
          <h3 className="font-bold text-amber-900">Pending Approvals</h3>
          <span className="inline-flex items-center justify-center rounded-full bg-amber-600 text-white text-xs font-black w-6 h-6">{total}</span>
        </div>
        <span className="text-amber-400 text-sm">{open ? "▼" : "▶"}</span>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* New trip submissions */}
          {newTrips.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">New Trip Submissions</p>
              {newTrips.map(t => (
                <div key={t.id} className="rounded-xl bg-white border border-amber-200 p-4 shadow-sm">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div>
                      <p className="font-bold text-slate-800">{t.date} · {t.lorry} · Trip #{t.tripNumber}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.location || "No location specified"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onApprove(t)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                        ✓ Approve
                      </button>
                      <button onClick={() => onReject(t)}
                        className="rounded-lg bg-white border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-slate-400">Revenue</p>
                      <p className="font-bold text-blue-600">{fmt(t.revenue)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-slate-400">Expenses</p>
                      <p className="font-bold text-rose-500">{fmt(t.totalExpenses)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-slate-400">Profit</p>
                      <p className={`font-bold ${Number(t.profit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(t.profit)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending edits */}
          {editTrips.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Proposed Trip Edits</p>
              {editTrips.map(t => {
                const p = t.pendingEdits || {};
                // Show key changed fields
                const LABELS = { date: "Date", lorry: "Lorry", location: "Location", revenue: "Revenue", amountPaid: "Amount Paid" };
                const changes = Object.entries(LABELS).filter(([key]) =>
                  p[key] !== undefined && String(p[key]) !== String(t[key])
                );
                return (
                  <div key={t.id} className="rounded-xl bg-white border border-amber-200 p-4 shadow-sm">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                      <div>
                        <p className="font-bold text-slate-800">{t.date} · {t.lorry} · Trip #{t.tripNumber}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Proposed edit awaiting review</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => onApprove(t)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                          ✓ Apply Edit
                        </button>
                        <button onClick={() => onReject(t)}
                          className="rounded-lg bg-white border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                          ✗ Discard
                        </button>
                      </div>
                    </div>
                    {changes.length > 0 ? (
                      <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Changes proposed:</p>
                        {changes.map(([key, label]) => (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-600 w-20">{label}</span>
                            <span className="text-rose-500 line-through">{String(t[key])}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-600 font-semibold">{String(p[key])}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Edit details not available for preview.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trip Group (date-grouped list) ──────────────────────────────────────────

export function TripGroup({ group, isAdmin, onEdit, onDel, onStatusChange, markingPaid, onApprove, onReject, userId, canAddTrips }) {
  const [expanded, setExpanded] = useState(true);

  // Who can edit/delete each trip row
  const canEditTrip = (t) =>
    isAdmin ||
    (canAddTrips && t.submittedBy === userId && t.approvalStatus === "approved");
  const canDelTrip = (t) =>
    isAdmin && (!t.approvalStatus || t.approvalStatus === "approved");

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between p-4 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-lg">{expanded ? "▼" : "▶"}</span>
          <h3 className="font-bold text-slate-800 text-lg">{group.date}</h3>
          <Badge color="slate">{group.trips.length} trips</Badge>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium mt-2 sm:mt-0">
          <span className="text-blue-600">Rev: {fmt(group.summary.revenue)}</span>
          <span className="text-rose-500">Exp: {fmt(group.summary.expenses)}</span>
          <span className={`font-bold ${group.summary.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            Net: {fmt(group.summary.profit)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-white">
                {["Lorry", "Trip #", "Location", "Revenue", "Expenses", "Profit", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.trips.map(t => {
                const approval = t.approvalStatus && t.approvalStatus !== "approved" ? t.approvalStatus : null;
                const isRejected = t.approvalStatus === "rejected";
                const isPendingEdit = t.approvalStatus === "pending_edit";
                const isPending = t.approvalStatus === "pending";

                return (
                  <tr key={t.id}
                    className={`border-b border-slate-50 transition-colors ${
                      isRejected ? "opacity-50 bg-rose-50/30" :
                      isPending  ? "bg-amber-50/40" :
                      "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Badge color={t.lorry === "KBZ" ? "blue" : "amber"}>{t.lorry}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">{t.tripNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{t.location || "N/A"}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{fmt(t.revenue)}</td>
                    <td className="px-4 py-3 font-semibold text-rose-500">{fmt(t.totalExpenses)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${Number(t.profit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {fmt(t.profit)}
                      </span>
                    </td>

                    {/* Status column: payment status + approval badge */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {isAdmin && !isRejected && !isPending ? (
                          <select
                            value={t.status}
                            disabled={markingPaid === t.id}
                            onChange={e => onStatusChange(t, e.target.value)}
                            className={`rounded-lg border px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60
                              ${t.status === "Paid"    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : t.status === "Partial" ? "border-amber-200 bg-amber-50 text-amber-700"
                              :                          "border-rose-200 bg-rose-50 text-rose-600"}`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Partial">Partial</option>
                            <option value="Paid">Paid</option>
                          </select>
                        ) : (
                          <Badge color={t.status === "Paid" ? "green" : t.status === "Partial" ? "amber" : "red"}>
                            {t.status}
                          </Badge>
                        )}
                        {/* Approval status indicator */}
                        {approval && APPROVAL_BADGE[approval] && (
                          <Badge color={APPROVAL_BADGE[approval].color}>
                            {APPROVAL_BADGE[approval].label}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Actions column */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {/* Print — always visible except for rejected */}
                        {!isRejected && (
                          <button onClick={() => exportVoucher(t)}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                            title="Print Receipt">🖨️</button>
                        )}

                        {/* Admin: inline approve/reject for pending_edit trips */}
                        {isAdmin && isPendingEdit && onApprove && onReject && (
                          <>
                            <button onClick={() => onApprove(t)}
                              className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-200"
                              title="Apply Edit">✓</button>
                            <button onClick={() => onReject(t)}
                              className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-200"
                              title="Discard Edit">✗</button>
                          </>
                        )}

                        {/* Edit — admin always; driver/conductor only for their own approved trips */}
                        {canEditTrip(t) && !isPendingEdit && onEdit && (
                          <button onClick={() => onEdit(t)}
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100">
                            Edit
                          </button>
                        )}

                        {/* Delete — admin only, approved trips only */}
                        {canDelTrip(t) && onDel && (
                          <button onClick={() => onDel(t)}
                            className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-100">
                            Del
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
