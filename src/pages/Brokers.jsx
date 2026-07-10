import { useState } from "react";
import { brokerService } from "../services/brokers";
import { Badge, Modal } from "../components/ui";

const EMPTY = { name: "", phone: "", company: "", notes: "", status: "Active" };

export default function BrokersPage({ brokers = [] }) {
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', data: {} }
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const openAdd = () => { setForm(EMPTY); setModal({ mode: "add" }); };
  const openEdit = (b) => { setForm({ ...b }); setModal({ mode: "edit", id: b.id }); };
  const closeModal = () => { setModal(null); setSaving(false); };

  const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Broker name is required.");
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await brokerService.addBroker({ name: form.name.trim(), phone: form.phone, company: form.company, notes: form.notes, status: form.status });
      } else {
        await brokerService.updateBroker(modal.id, { name: form.name.trim(), phone: form.phone, company: form.company, notes: form.notes, status: form.status });
      }
      closeModal();
    } catch (err) {
      alert("Error: " + err.message);
      setSaving(false);
    }
  };

  const handleToggleStatus = async (b) => {
    try {
      await brokerService.updateBroker(b.id, { status: b.status === "Active" ? "Inactive" : "Active" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const active = brokers.filter(b => b.status === "Active");
  const inactive = brokers.filter(b => b.status !== "Active");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">Brokers</h2>
          <p className="text-sm text-slate-500 mt-0.5">{active.length} active broker{active.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
        >
          + Add Broker
        </button>
      </div>

      {/* Info Banner */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> Add your broker contacts here. When logging a trip, you can select which broker the trip belongs to. Each broker gets their own separate ledger on the <strong>Broker Ledger</strong> page.
        </p>
      </div>

      {/* Broker Cards */}
      {brokers.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <div>
            <div className="text-5xl mb-3">🤝</div>
            <h3 className="font-bold text-slate-700">No brokers yet</h3>
            <p className="text-sm text-slate-400 mt-1">Add a broker to start tracking per-broker financials.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...active, ...inactive].map(b => (
            <div key={b.id} className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 transition-all ${b.status === "Active" ? "border-slate-100" : "border-slate-100 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700 shrink-0">
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{b.name}</p>
                      {b.company && <p className="text-xs text-slate-500 truncate">{b.company}</p>}
                    </div>
                  </div>
                </div>
                <Badge color={b.status === "Active" ? "green" : "slate"}>{b.status}</Badge>
              </div>

              {b.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="text-slate-400">📞</span>
                  <span>{b.phone}</span>
                </div>
              )}
              {b.notes && (
                <p className="text-xs text-slate-400 line-clamp-2">{b.notes}</p>
              )}

              <div className="flex gap-2 mt-auto pt-2 border-t border-slate-50">
                <button
                  onClick={() => openEdit(b)}
                  className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleStatus(b)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${b.status === "Active" ? "border border-rose-200 text-rose-500 hover:bg-rose-50" : "border border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                >
                  {b.status === "Active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={!!modal} onClose={closeModal} title={modal?.mode === "add" ? "Add Broker" : "Edit Broker"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
            <input className={inp} placeholder="e.g. John Kamau" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Company / Agency</label>
            <input className={inp} placeholder="e.g. Kamau Logistics Ltd" value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
            <input className={inp} placeholder="e.g. 0712 345 678" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
            <textarea className={inp} rows="2" placeholder="Any notes about this broker..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}></textarea>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
            <select className={inp} value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving ? "Saving…" : modal?.mode === "add" ? "Add Broker" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
