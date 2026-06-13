import { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { vehicleService } from "../services/vehicles";
import { tripService } from "../services/trips";
import { Badge, Modal, StatCard } from "../components/ui";
import { fmt, summarize } from "../utils/helpers";
import { TripGroup } from "./Trips";
import TripForm from "../components/TripForm";

export default function VehiclesPage({ vehicles, trips, locations, personnel }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editVeh, setEditVeh] = useState(null);
  const [delVeh, setDelVeh] = useState(null);
  const [selectedVeh, setSelectedVeh] = useState(null);

  // Trip management states
  const [editTrip, setEditTrip] = useState(null);
  const [delTrip, setDelTrip] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // If a vehicle is selected, show its profile
  if (selectedVeh) {
    const vehTrips = trips.filter(t => t.lorry === selectedVeh.plate);
    const sum = summarize(vehTrips);

    const groupedTrips = (() => {
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
    })();

    const handleEditTrip = (form) => tripService.update(editTrip.id, form);
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
    const handleDelTrip = async () => {
      setDeleting(true);
      try { await tripService.delete(delTrip.id); setDelTrip(null); }
      catch (e) { alert(e.message); }
      finally { setDeleting(false); }
    };

    return (
      <div className="space-y-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button onClick={() => setSelectedVeh(null)} className="text-slate-400 hover:text-slate-800 transition-colors">
            ← Back
          </button>
          <h2 className="min-w-0 text-xl font-black text-slate-800">{selectedVeh.name} ({selectedVeh.plate})</h2>
          <Badge color={selectedVeh.status === "Active" ? "green" : "red"}>{selectedVeh.status}</Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mobile-card-rail mobile-card-rail--compact">
          <StatCard label="Total Trips" value={sum.count} icon="🚛" color="blue" />
          <StatCard label="Total Revenue" value={fmt(sum.revenue)} icon="💰" color="green" />
          <StatCard label="Total Expenses" value={fmt(sum.expenses)} icon="📉" color="red" />
          <StatCard label="Total Profit" value={fmt(sum.profit)} icon="📈" color={sum.profit >= 0 ? "green" : "red"} />
        </div>

        <div className="space-y-4 mt-6">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <h3 className="font-bold text-slate-800">Trip History</h3>
          </div>
          {groupedTrips.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400">
              No trips logged yet
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
            />
          ))}
        </div>

        <Modal open={!!editTrip} onClose={() => setEditTrip(null)} title="Edit Trip" wide>
          {editTrip && <TripForm locations={locations} personnel={personnel} vehicles={vehicles} initial={editTrip} onSave={handleEditTrip} onCancel={() => setEditTrip(null)} />}
        </Modal>
        <Modal open={!!delTrip} onClose={() => setDelTrip(null)} title="Delete Trip">
          {delTrip && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Delete trip <strong>{delTrip.tripNumber}</strong> on {delTrip.date} ({delTrip.lorry})?
                <br /><span className="text-rose-500 font-semibold">This cannot be undone.</span>
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDelTrip(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleDelTrip} disabled={deleting} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
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
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedVeh(v)}>
              {/* Card header: info on left, action buttons on right — never overlapping */}
              <div className="flex items-start justify-between gap-3 mb-4">
                {/* Left: plate name + badge + vehicle name */}
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-800 text-lg leading-tight">{v.plate}</h3>
                    <Badge color={v.status === "Active" ? "green" : "slate"}>{v.status}</Badge>
                  </div>
                  <p className="truncate text-xs text-slate-500 font-semibold">{v.name}</p>
                </div>
                {/* Right: action buttons — always on top right, never touching badge */}
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditVeh(v)} className="rounded-lg bg-blue-50 p-2 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors" title="Edit Vehicle">✏️</button>
                    <button onClick={() => setDelVeh(v)} className="rounded-lg bg-rose-50 p-2 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-colors" title="Delete Vehicle">🗑️</button>
                  </div>
                )}
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
