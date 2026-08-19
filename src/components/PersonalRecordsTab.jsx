import React, { useState, useEffect, useMemo } from "react";
import { personalRecordsService } from "../services/personalRecords";
import { useAuth } from "../contexts/AuthContext";
import { fmt, today } from "../utils/helpers";
import { Modal, StatCard, Badge } from "./ui";

/**
 * PersonalRecordsTab
 *
 * Props:
 *   personnelId  – The personnel table ID (used to fetch linked trips)
 *   targetUserId – Override which auth user's records are shown.
 *                  When an admin selects a driver/conductor, pass their auth user_id here.
 *                  Defaults to the logged-in user's own ID.
 *   personnelName – Display name for the banner when admin is viewing someone else.
 */
export default function PersonalRecordsTab({ personnelId, targetUserId, personnelName }) {
  const { user, isAdmin, isOwner } = useAuth();
  const isPrivileged = isAdmin || isOwner;

  const [effectiveUserId, setEffectiveUserId] = useState(targetUserId || user?.id);
  const isViewingOther = isPrivileged && effectiveUserId && effectiveUserId !== user?.id;

  const [records, setRecords] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [tripId, setTripId] = useState("");

  const openAdd = () => {
    setEditingRecord(null);
    setType("expense");
    setAmount("");
    setDate(today());
    setNotes("");
    setTripId("");
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditingRecord(r);
    setType(r.type);
    setAmount(r.amount || "");
    setDate(r.date || today());
    setNotes(r.notes || "");
    setTripId(r.trip_id || "");
    setModalOpen(true);
  };

  const loadData = async () => {
    setLoading(true);

    let targetId = targetUserId || user?.id;
    if (isPrivileged && personnelId && !targetUserId) {
      const fetchedId = await personalRecordsService.fetchUserIdByPersonnelId(personnelId);
      if (fetchedId) {
        targetId = fetchedId;
      }
    }
    
    setEffectiveUserId(targetId);

    if (!targetId) {
      setLoading(false);
      return;
    }

    try {
      const recs = await personalRecordsService.fetchAll(targetId);
      setRecords(recs);
    } catch (e) {
      console.error("[PersonalRecords] Failed to load records:", e.message);
    }

    try {
      const linkedTrips = await personalRecordsService.fetchLinkedTrips(personnelId);
      setTrips(linkedTrips);
    } catch (e) {
      console.warn("[PersonalRecords] Could not load linked trips (RLS?):", e.message);
      setTrips([]);
    }

    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [personnelId, targetUserId]);

  const handleSave = async () => {
    if (!notes.trim()) return alert("Please enter notes/description");
    if (type !== "note" && (!amount || Number(amount) <= 0)) return alert("Please enter a valid amount");

    setSaving(true);
    try {
      if (editingRecord) {
        await personalRecordsService.update(editingRecord.id, {
          type,
          amount: type === "note" ? 0 : Number(amount),
          date,
          notes,
          trip_id: tripId || null,
        });
      } else {
        await personalRecordsService.create({
          user_id: effectiveUserId,
          type,
          amount: type === "note" ? 0 : Number(amount),
          date,
          notes,
          trip_id: tripId || null,
        });
      }
      setModalOpen(false);
      loadData();
    } catch (e) {
      alert("Error saving record: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await personalRecordsService.delete(id);
      loadData();
    } catch (e) {
      alert("Error deleting record: " + e.message);
    }
  };

  const totals = useMemo(() => {
    return records.reduce((acc, r) => {
      if (r.type === "expense") acc.expenses += Number(r.amount || 0);
      if (r.type === "income") acc.income += Number(r.amount || 0);
      return acc;
    }, { expenses: 0, income: 0 });
  }, [records]);

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-6">
      {/* Admin viewing banner */}
      {isViewingOther && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="text-amber-500 text-lg">👁️</span>
          <div>
            <p className="text-sm font-bold text-amber-800">
              Viewing {personnelName ? `${personnelName}'s` : "Personnel"} Personal Records
            </p>
            <p className="text-xs text-amber-600">You can add, edit, and delete records on their behalf.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            {isViewingOther ? `${personnelName || "Personnel"}'s Personal Log` : "My Personal Log"}
          </h2>
          <p className="text-xs font-semibold text-slate-500">Track notes, expenses, and incomes.</p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          + Add Record
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Total Personal Expenses" value={fmt(totals.expenses)} color="rose" />
        <StatCard title="Total Personal Income" value={fmt(totals.income)} color="emerald" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Date</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Type</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Notes</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Trip</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">No personal records yet.</td></tr>
              ) : (
                records.map(r => {
                  const linkedTrip = trips.find(t => t.id === r.trip_id);
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-600">{new Date(r.date + "T00:00:00").toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {r.type === "expense" && <Badge color="rose">Expense</Badge>}
                        {r.type === "income" && <Badge color="emerald">Income</Badge>}
                        {r.type === "note" && <Badge color="slate">Note</Badge>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium max-w-[200px] truncate" title={r.notes}>{r.notes}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {linkedTrip ? (
                          <div className="max-w-[150px] truncate" title={linkedTrip.location}>
                            {new Date(linkedTrip.date + "T00:00:00").toLocaleDateString()} — {linkedTrip.lorry}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {r.type === "note" ? "—" : fmt(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(r)} className="text-slate-400 hover:text-blue-500 transition-colors text-sm" title="Edit">✏️</button>
                          <button onClick={() => handleDelete(r.id)} className="text-slate-300 hover:text-rose-500 transition-colors text-lg" title="Delete">×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingRecord ? "Edit Personal Record" : "Add Personal Record"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Type</label>
              <select className={inp} value={type} onChange={e => setType(e.target.value)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="note">Note Only</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Date</label>
              <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {type !== "note" && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Amount (KES)</label>
              <input type="number" min="0" className={inp} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Linked Trip (Optional)</label>
            <select className={inp} value={tripId} onChange={e => setTripId(e.target.value)}>
              <option value="">— None —</option>
              {trips.map(t => (
                <option key={t.id} value={t.id}>
                  {new Date(t.date + "T00:00:00").toLocaleDateString()} — {t.location} ({t.lorry})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Notes / Description</label>
            <textarea className={inp} rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter details..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-60">
              {saving ? "Saving..." : editingRecord ? "Update Record" : "Save Record"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
