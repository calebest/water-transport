import { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { personnelService } from "../services/personnel";
import { Badge, Modal } from "../components/ui";
import { fmt, summarize } from "../utils/helpers";

const ROLES = ["Driver", "Conductor", "Both"];

export default function PersonnelPage({ personnel, trips }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editPerson, setEditPerson] = useState(null);
  const [delPerson, setDelPerson] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filterRole, setFilterRole] = useState("All");

  const filtered = useMemo(() =>
    personnel.filter(p => filterRole === "All" || p.role === filterRole || p.role === "Both"),
    [personnel, filterRole]
  );

  // Person profile view
  if (selected) {
    const personTrips = trips.filter(t =>
      t.driverId === selected.id || t.conductorId === selected.id
    );
    const sum = summarize(personTrips);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-800 transition-colors">
            ← Back
          </button>
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-black text-emerald-700">
            {selected.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">{selected.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge color={selected.role === "Driver" ? "blue" : selected.role === "Conductor" ? "amber" : "emerald"}>{selected.role}</Badge>
              <Badge color={selected.status === "Active" ? "green" : "slate"}>{selected.status}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total Trips</p>
            <p className="text-2xl font-black text-slate-800">{sum.count}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Phone</p>
            <p className="text-sm font-bold text-slate-800">{selected.phone || "N/A"}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">ID Number</p>
            <p className="text-sm font-bold text-slate-800">{selected.idNumber || "N/A"}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Revenue Generated</p>
            <p className="text-sm font-bold text-emerald-600">{fmt(sum.revenue)}</p>
          </div>
        </div>

        {selected.notes && (
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Notes</p>
            <p className="text-sm text-slate-600">{selected.notes}</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Trip History</h3>
          </div>
          <div className="table-scroll-container">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-white">
                <tr className="border-b border-slate-100 bg-white">
                  {["Date", "Lorry", "Trip #", "Location", "Revenue", "Role on Trip"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personTrips.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">No trips logged yet for this person</td></tr>
                ) : personTrips.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 bg-white hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">{t.date}</td>
                    <td className="px-4 py-3"><Badge color={t.lorry === "KBZ" ? "blue" : "amber"}>{t.lorry}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{t.tripNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{t.location || "N/A"}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{fmt(t.revenue)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-semibold">
                      {t.driverId === selected.id && t.conductorId === selected.id ? "Driver & Conductor" :
                       t.driverId === selected.id ? "Driver" : "Conductor"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800">Personnel</h2>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
            + Add Person
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {["All", ...ROLES].map(r => (
          <button key={r} onClick={() => setFilterRole(r)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filterRole === r ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {r}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => {
          const pTrips = trips.filter(t => t.driverId === p.id || t.conductorId === p.id);
          return (
            <div key={p.id}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
              onClick={() => setSelected(p)}>
              <div className="flex flex-wrap justify-between items-start mb-3 gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-11 w-11 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-black text-emerald-700 flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-slate-800 truncate w-full">{p.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge color={p.role === "Driver" ? "blue" : p.role === "Conductor" ? "amber" : "emerald"}>{p.role}</Badge>
                      <Badge color={p.status === "Active" ? "green" : "slate"}>{p.status}</Badge>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditPerson(p)} className="text-blue-500 hover:text-blue-700 p-1" title="Edit Person">✏️</button>
                    <button onClick={() => setDelPerson(p)} className="text-rose-500 hover:text-rose-700 p-1" title="Delete Person">🗑️</button>
                  </div>
                )}
              </div>
              <div className="space-y-1 text-sm mt-3">
                {p.phone && (
                  <p className="text-slate-500 text-xs">📞 {p.phone}</p>
                )}
                <p className="text-slate-500 text-xs">🚛 {pTrips.length} trips logged</p>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
            No personnel found
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Person">
        <PersonnelForm onSave={personnelService.add} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editPerson} onClose={() => setEditPerson(null)} title="Edit Person">
        {editPerson && <PersonnelForm initial={editPerson} onSave={d => personnelService.update(editPerson.id, d)} onCancel={() => setEditPerson(null)} />}
      </Modal>
      <Modal open={!!delPerson} onClose={() => setDelPerson(null)} title="Remove Person">
        {delPerson && (
          <div className="space-y-4">
            <p className="text-slate-600">Remove <strong>{delPerson.name}</strong> from the system? This will not affect existing trip records.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelPerson(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => { await personnelService.delete(delPerson.id); setDelPerson(null); }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Remove</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PersonnelForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [role, setRole] = useState(initial?.role || "Driver");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [idNumber, setIdNumber] = useState(initial?.idNumber || "");
  const [status, setStatus] = useState(initial?.status || "Active");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const handleSubmit = async () => {
    if (!name.trim()) return alert("Name is required.");
    setSaving(true);
    try { await onSave({ name: name.trim(), role, phone, idNumber, status, notes }); onCancel(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name *</label>
        <input className={inp} placeholder="e.g. John Doe" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
          <select className={inp} value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
          <select className={inp} value={status} onChange={e => setStatus(e.target.value)}>
            <option>Active</option><option>Inactive</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
          <input className={inp} placeholder="e.g. 0712345678" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">ID Number</label>
          <input className={inp} placeholder="National ID" value={idNumber} onChange={e => setIdNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea className={inp} rows="2" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
