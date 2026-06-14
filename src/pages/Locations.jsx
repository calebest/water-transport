import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { locationService } from "../services/locations";
import { Modal } from "../components/ui";
import { fmt } from "../utils/helpers";

export default function LocationsPage({ locations }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [delLoc, setDelLoc] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-800">Locations</h2>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
            + Add Location
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="table-scroll-container">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-white">
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Location Name", "Revenue / Price", "Status", isAdmin ? "Actions" : ""].map(h => (
                  h ? <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th> : <th key="empty" className="px-4 py-3" />
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr><td colSpan={3} className="py-16 text-center text-slate-400">No locations found</td></tr>
              ) : locations.map(loc => (
                <tr key={loc.id} className="border-b border-slate-50 bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-700">{loc.name}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{fmt(loc.revenue)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${loc.status === 'Inactive' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                      {loc.status || 'Active'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditLoc(loc)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100">Edit</button>
                        <button onClick={() => setDelLoc(loc)}
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-100">Del</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Location">
        <LocationForm onSave={locationService.add} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editLoc} onClose={() => setEditLoc(null)} title="Edit Location">
        {editLoc && <LocationForm initial={editLoc} onSave={(data) => locationService.update(editLoc.id, data)} onCancel={() => setEditLoc(null)} />}
      </Modal>
      <Modal open={!!delLoc} onClose={() => setDelLoc(null)} title="Delete Location">
        {delLoc && (
          <div className="space-y-4">
            <p className="text-slate-600">
              Delete location <strong>{delLoc.name}</strong>?
              <br /><span className="text-rose-500 font-semibold">This will not delete existing trips to this location.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelLoc(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => {
                try {
                  await locationService.delete(delLoc.id);
                  setDelLoc(null);
                } catch (e) {
                  alert(e.message);
                }
              }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LocationForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [revenue, setRevenue] = useState(initial?.revenue || "");
  const [status, setStatus] = useState(initial?.status || "Active");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !revenue) {
      alert("Name and price are required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), revenue: Number(revenue), status });
      onCancel();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Location Name *</label>
        <input className={inp} placeholder="e.g. Mombasa" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Price/Revenue (KES) *</label>
        <input type="number" className={inp} placeholder="e.g. 15000" value={revenue} onChange={e => setRevenue(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
        <select className={inp} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2 mobile-action-stack sm:flex-row">
        <button onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save Location"}
        </button>
      </div>
    </div>
  );
}
