import { useState, useMemo } from "react";
import { tripService } from "../services/trips";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Modal } from "../components/ui";
import { fmt, summarize } from "../utils/helpers";
import { exportVoucher } from "../utils/export";
import TripForm from "../components/TripForm";
import TripGroup from "../components/TripGroup";

export default function TripsPage({ trips, locations, vehicles, personnel = [] }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [delTrip, setDelTrip] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [search, setSearch] = useState("");
  const [filterLorry, setFilterLorry] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Group trips by Date and then apply filters
  const groupedTrips = useMemo(() => {
    const filtered = trips.filter(t => {
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

    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
      return {
        date,
        trips: groups[date],
        summary: summarize(groups[date])
      };
    });
  }, [trips, filterLorry, filterDate, search]);

  const handleAdd = (form) => tripService.add(form);
  const handleEdit = (form) => tripService.update(editTrip.id, form);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800">Trips</h2>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
            + Add Trip
          </button>
        )}
      </div>

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

      <div className="space-y-4">
        {groupedTrips.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm py-16 text-center text-slate-400">
            No trips found
          </div>
        ) : groupedTrips.map(group => (
          <TripGroup key={group.date} group={group} isAdmin={isAdmin} onEdit={setEditTrip} onDel={setDelTrip} onStatusChange={handleStatusChange} markingPaid={markingPaid} />
        ))}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Trip" wide>
        <TripForm locations={locations} personnel={personnel} vehicles={vehicles} onSave={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editTrip} onClose={() => setEditTrip(null)} title="Edit Trip" wide>
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

