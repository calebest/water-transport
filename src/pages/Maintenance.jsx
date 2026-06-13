import { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { maintenanceService } from "../services/maintenance";
import { Badge, Modal } from "../components/ui";
import { fmt, today } from "../utils/helpers";

const TYPES = ["Routine", "Repair"];

export default function MaintenancePage({ maintenance, vehicles }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const [filterLorry, setFilterLorry] = useState("All");

  const lorryList = useMemo(() => {
    const fromRecords = [...new Set(maintenance.map(m => m.lorry))];
    const fromVehicles = vehicles.map(v => v.plate);
    return [...new Set([...fromVehicles, ...fromRecords])].sort();
  }, [maintenance, vehicles]);

  const filtered = useMemo(() =>
    maintenance.filter(m =>
      (filterType === "All" || m.type === filterType) &&
      (filterLorry === "All" || m.lorry === filterLorry)
    ),
    [maintenance, filterType, filterLorry]
  );

  const totalCost = useMemo(() => filtered.reduce((sum, m) => sum + Number(m.cost || 0), 0), [filtered]);
  const routineCost = useMemo(() => maintenance.filter(m => m.type === "Routine").reduce((s, m) => s + Number(m.cost || 0), 0), [maintenance]);
  const repairCost = useMemo(() => maintenance.filter(m => m.type === "Repair").reduce((s, m) => s + Number(m.cost || 0), 0), [maintenance]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-800">Maintenance</h2>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
            + Log Maintenance
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mobile-card-rail mobile-card-rail--wide">
        <div className="responsive-card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total Cost</p>
          <p className="text-xl font-black text-slate-800">{fmt(totalCost)}</p>
          <p className="text-xs text-slate-400 mt-1">{filtered.length} records</p>
        </div>
        <div className="responsive-card rounded-2xl border border-blue-50 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">Routine</p>
          <p className="text-xl font-black text-blue-700">{fmt(routineCost)}</p>
          <p className="text-xs text-blue-400 mt-1">{maintenance.filter(m => m.type === "Routine").length} records</p>
        </div>
        <div className="responsive-card rounded-2xl border border-rose-50 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-1">Repairs</p>
          <p className="text-xl font-black text-rose-600">{fmt(repairCost)}</p>
          <p className="text-xs text-rose-400 mt-1">{maintenance.filter(m => m.type === "Repair").length} records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="flex gap-1 mobile-control-rail">
          {["All", ...TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filterType === t ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {t}
            </button>
          ))}
        </div>
        <select className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none sm:w-auto"
          value={filterLorry} onChange={e => setFilterLorry(e.target.value)}>
          <option value="All">All Vehicles</option>
          {lorryList.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {/* Records table */}
      <div className="table-scroll-container rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-white">
            <tr className="border-b border-slate-100 bg-slate-50">
                {["Date", "Lorry", "Type", "Description", "Cost", "Vendor", "Odometer", isAdmin ? "Actions" : ""].map(h => (
                  h ? <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                    : <th key="empty" className="px-4 py-3" />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400">No maintenance records found</td></tr>
              ) : filtered.map(m => (
                <tr key={m.id} className="border-b border-slate-50 bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700">{m.date}</td>
                  <td className="px-4 py-3"><Badge color={m.lorry === "KBZ" ? "blue" : "amber"}>{m.lorry}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge color={m.type === "Routine" ? "green" : "rose"}>{m.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{m.description}</td>
                  <td className="px-4 py-3 font-bold text-rose-600">{fmt(m.cost)}</td>
                  <td className="px-4 py-3 text-slate-500">{m.vendor || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{m.odometer ? `${m.odometer.toLocaleString()} km` : "—"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditItem(m)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100">Edit</button>
                        <button onClick={() => setDelItem(m)}
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-100">Del</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
          {filtered.length} of {maintenance.length} records · Total: {fmt(totalCost)}
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log Maintenance">
        <MaintenanceForm vehicles={vehicles} onSave={maintenanceService.add} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Record">
        {editItem && <MaintenanceForm vehicles={vehicles} initial={editItem} onSave={d => maintenanceService.update(editItem.id, d)} onCancel={() => setEditItem(null)} />}
      </Modal>
      <Modal open={!!delItem} onClose={() => setDelItem(null)} title="Delete Record">
        {delItem && (
          <div className="space-y-4">
            <p className="text-slate-600">Delete maintenance record for <strong>{delItem.lorry}</strong> on {delItem.date}?<br /><span className="text-rose-500 font-semibold">This cannot be undone.</span></p>
            <div className="flex gap-3">
              <button onClick={() => setDelItem(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => { await maintenanceService.delete(delItem.id); setDelItem(null); }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MaintenanceForm({ initial, vehicles, onSave, onCancel }) {
  const [date, setDate] = useState(initial?.date || today());
  const [lorry, setLorry] = useState(initial?.lorry || (vehicles[0]?.plate || "KBZ"));
  const [type, setType] = useState(initial?.type || "Routine");
  const [description, setDescription] = useState(initial?.description || "");
  const [cost, setCost] = useState(initial?.cost || "");
  const [vendor, setVendor] = useState(initial?.vendor || "");
  const [odometer, setOdometer] = useState(initial?.odometer || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const handleSubmit = async () => {
    if (!date || !lorry || !description || cost === "") return alert("Date, vehicle, description, and cost are required.");
    setSaving(true);
    try { await onSave({ date, lorry, type, description, cost, vendor, odometer, notes }); onCancel(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Date *</label>
          <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Vehicle *</label>
          <select className={inp} value={lorry} onChange={e => setLorry(e.target.value)}>
            {vehicles.length > 0
              ? vehicles.map(v => <option key={v.id} value={v.plate}>{v.plate}</option>)
              : <><option>KBZ</option><option>KBL</option></>}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Type *</label>
          <select className={inp} value={type} onChange={e => setType(e.target.value)}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Cost (KES) *</label>
          <input type="number" className={inp} placeholder="0" value={cost} onChange={e => setCost(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Description *</label>
        <input className={inp} placeholder="e.g. Oil change, Tyre replacement, Engine repair…" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor / Garage</label>
          <input className={inp} placeholder="e.g. ABC Garage" value={vendor} onChange={e => setVendor(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Odometer (km)</label>
          <input type="number" className={inp} placeholder="e.g. 125000" value={odometer} onChange={e => setOdometer(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea className={inp} rows="2" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2 mobile-action-stack sm:flex-row">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save Record"}
        </button>
      </div>
    </div>
  );
}
