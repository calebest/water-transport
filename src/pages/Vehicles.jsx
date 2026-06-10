import { useState } from "react";
import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { vehicleService } from "../services/vehicles";
import { Badge, Modal, StatCard } from "../components/ui";
import { fmt, summarize } from "../utils/helpers";
import TripGroup from "../components/TripGroup";

export default function VehiclesPage({ vehicles, trips }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editVeh, setEditVeh] = useState(null);
  const [delVeh, setDelVeh] = useState(null);
  const [selectedVeh, setSelectedVeh] = useState(null);

  // If a vehicle is selected, show its profile
  if (selectedVeh) {
    const vehTrips = trips.filter(t => t.lorry === selectedVeh.plate);
    const sum = summarize(vehTrips);

    const groupedTrips = useMemo(() => {
      const groups = {};
      vehTrips.forEach(t => {
        if (!groups[t.date]) groups[t.date] = [];
        groups[t.date].push(t);
      });
      return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => ({
        date,
        trips: groups[date],
        summary: summarize(groups[date])
      }));
    }, [vehTrips]);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedVeh(null)} className="text-slate-400 hover:text-slate-800 transition-colors">
            ← Back
          </button>
          <h2 className="text-xl font-black text-slate-800">{selectedVeh.name} ({selectedVeh.plate})</h2>
          <Badge color={selectedVeh.status === "Active" ? "green" : "red"}>{selectedVeh.status}</Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Trips" value={sum.count} icon="🚛" color="blue" />
          <StatCard label="Total Revenue" value={fmt(sum.revenue)} icon="💰" color="green" />
          <StatCard label="Total Expenses" value={fmt(sum.expenses)} icon="📉" color="red" />
          <StatCard label="Total Profit" value={fmt(sum.profit)} icon="📈" color={sum.profit >= 0 ? "green" : "red"} />
        </div>

        <div className="mt-6">
          <h3 className="font-bold text-slate-800 mb-2 px-1">Trip History</h3>
          {groupedTrips.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-12 text-center text-slate-400">
              No trips logged yet
            </div>
          ) : (
            <div className="space-y-4">
              {groupedTrips.map(group => (
                <TripGroup key={group.date} group={group} isAdmin={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800">Vehicles</h2>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
            + Add Vehicle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map(v => {
          const vehTrips = trips.filter(t => t.lorry === v.plate);
          const sum = summarize(vehTrips);
          return (
            <div key={v.id} 
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
              onClick={() => setSelectedVeh(v)}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">{v.plate}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{v.name}</p>
                </div>
                <Badge color={v.status === "Active" ? "green" : "slate"}>{v.status}</Badge>
              </div>
              <div className="space-y-2 mt-4 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Total Trips:</span>
                  <span className="font-bold text-slate-800">{sum.count}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Revenue:</span>
                  <span className="font-bold text-emerald-600">{fmt(sum.revenue)}</span>
                </div>
                {v.notes && (
                  <p className="text-xs text-slate-400 mt-2 truncate border-t border-slate-50 pt-2">{v.notes}</p>
                )}
              </div>
              
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-2" onClick={e => e.stopPropagation()}>
                   {/* We stop propagation so clicking edit doesn't open the profile */}
                   <button onClick={() => setEditVeh(v)} className="text-blue-500 hover:text-blue-700 p-1">✏️</button>
                   <button onClick={() => setDelVeh(v)} className="text-rose-500 hover:text-rose-700 p-1">🗑️</button>
                </div>
              )}
            </div>
          );
        })}
        {vehicles.length === 0 && (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
            <p className="mb-4">No vehicles registered</p>
            {isAdmin && (
              <button onClick={async () => {
                await vehicleService.add({ plate: "KBZ", name: "Lorry KBZ", status: "Active", notes: "Legacy migrated vehicle" });
                await vehicleService.add({ plate: "KBL", name: "Lorry KBL", status: "Active", notes: "Legacy migrated vehicle" });
              }} className="rounded-lg bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-200 transition-colors">
                Auto-Add KBZ & KBL
              </button>
            )}
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Vehicle">
        <VehicleForm onSave={vehicleService.add} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editVeh} onClose={() => setEditVeh(null)} title="Edit Vehicle">
        {editVeh && <VehicleForm initial={editVeh} onSave={(data) => vehicleService.update(editVeh.id, data)} onCancel={() => setEditVeh(null)} />}
      </Modal>
      <Modal open={!!delVeh} onClose={() => setDelVeh(null)} title="Delete Vehicle">
        {delVeh && (
          <div className="space-y-4">
            <p className="text-slate-600">
              Delete vehicle <strong>{delVeh.plate}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelVeh(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => {
                try { await vehicleService.delete(delVeh.id); setDelVeh(null); } 
                catch (e) { alert(e.message); }
              }} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function VehicleForm({ initial, onSave, onCancel }) {
  const [plate, setPlate] = useState(initial?.plate || "");
  const [name, setName] = useState(initial?.name || "");
  const [status, setStatus] = useState(initial?.status || "Active");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!plate.trim() || !name.trim()) return alert("Plate and name required.");
    setSaving(true);
    try {
      await onSave({ plate: plate.trim().toUpperCase(), name: name.trim(), status, notes: notes.trim() });
      onCancel();
    } catch (e) { alert(e.message); } 
    finally { setSaving(false); }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Registration Plate *</label>
        <input className={inp} placeholder="e.g. KCA 123A" value={plate} onChange={e => setPlate(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Vehicle Name/Alias *</label>
        <input className={inp} placeholder="e.g. Lorry KBZ" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
        <select className={inp} value={status} onChange={e => setStatus(e.target.value)}>
          <option>Active</option>
          <option>Inactive</option>
          <option>Maintenance</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea className={inp} rows="2" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? "Saving…" : "Save Vehicle"}</button>
      </div>
    </div>
  );
}
