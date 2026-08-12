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
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() =>
    personnel.filter(p => (filterRole === "All" || p.role === filterRole || p.role === "Both") && (showInactive || p.status !== "Inactive")),
    [personnel, filterRole, showInactive]
  );

  // Person profile view
  if (selected) {
    const personTrips = trips.filter(t =>
      t.driverId === selected.id || t.conductorId === selected.id
    );
    const sum = summarize(personTrips);
    return (
      <div className="space-y-6">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-emerald-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Directory
        </button>

        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-xl border border-slate-800 p-6 lg:p-8">
          {/* Subtle background glow */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none"></div>
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-3xl font-black text-white shadow-lg border-2 border-emerald-400/50 flex-shrink-0">
                {selected.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-3xl font-black text-white tracking-tight truncate">{selected.name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selected.role === "Driver" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : selected.role === "Conductor" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"}`}>{selected.role}</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selected.status === "Active" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-500/30 text-slate-300 border border-slate-500/30"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selected.status === "Active" ? "bg-emerald-400" : "bg-slate-400"}`}></span>
                    {selected.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 lg:gap-8 bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total Trips</p>
                <p className="text-2xl font-black text-white">{sum.count}</p>
              </div>
              <div className="w-px bg-slate-700/50"></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Generated</p>
                <p className="text-2xl font-black text-emerald-400">{fmt(sum.revenue)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Phone Number</p>
              <p className="text-lg font-bold text-slate-800">{selected.phone || "Not provided"}</p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">ID Number</p>
              <p className="text-lg font-bold text-slate-800">{selected.idNumber || "Not provided"}</p>
            </div>
          </div>
        </div>

        {selected.notes && (
          <div className="rounded-3xl border border-slate-100 bg-amber-50 p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600/80 mb-2">Internal Notes</p>
            <p className="text-sm font-medium text-amber-900 leading-relaxed">{selected.notes}</p>
          </div>
        )}

        <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 lg:p-6 bg-slate-50/50 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-800">Trip History</h3>
          </div>
          <div className="table-scroll-container">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  {["Date", "Vehicle", "Trip #", "Location", "Role Played", "Revenue"].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {personTrips.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-slate-400 font-medium">No trips logged yet for this person</td></tr>
                ) : personTrips.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{t.date}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        🚛 {t.lorry}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{t.tripNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{t.location || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-md">
                        {t.driverId === selected.id && t.conductorId === selected.id ? "Driver & Cond" :
                         t.driverId === selected.id ? "Driver" : "Conductor"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-emerald-600">{fmt(t.revenue)}</td>
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 lg:p-6 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Personnel Directory</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage drivers, conductors, and staff.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
            Add Person
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex p-1.5 space-x-1.5 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto hide-scrollbar max-w-full">
          {["All", ...ROLES].map(r => (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`relative px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 ease-out whitespace-nowrap ${
                filterRole === r 
                  ? "bg-slate-800 text-white shadow-md" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}>
              {r}
            </button>
          ))}
        </div>
        <button onClick={() => setShowInactive(v => !v)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold border transition-all ${
            showInactive 
              ? "bg-rose-50 text-rose-700 border-rose-200 shadow-sm" 
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800 shadow-sm"
          }`}>
          <span className={`w-2 h-2 rounded-full ${showInactive ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
          {showInactive ? "Hiding Inactive" : "Show Inactive"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map(p => {
          const pTrips = trips.filter(t => t.driverId === p.id || t.conductorId === p.id);
          return (
            <div key={p.id}
              className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full"
              onClick={() => setSelected(p)}>
              
              <div className="flex justify-between items-start mb-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center text-2xl font-black text-emerald-700 shadow-sm border border-emerald-100/50">
                  {p.name.charAt(0)}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => personnelService.update(p.id, { ...p, status: p.status === "Active" ? "Inactive" : "Active" })}
                      title={p.status === "Active" ? "Mark as Inactive" : "Mark as Active"}
                      className={`p-2 rounded-xl transition-colors ${
                        p.status === "Active" ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                      }`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={p.status === "Active" ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} />
                      </svg>
                    </button>
                    <button onClick={() => setEditPerson(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Edit Person">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => setDelPerson(p)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Delete Person">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-800 truncate">{p.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge color={p.role === "Driver" ? "blue" : p.role === "Conductor" ? "amber" : "emerald"}>{p.role}</Badge>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${p.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.status === "Active" ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                    {p.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-500 font-medium truncate pr-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span className="truncate">{p.phone || "No phone"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 font-bold bg-slate-50 px-2.5 py-1 rounded-lg flex-shrink-0">
                  <span className="text-emerald-600">🚛</span> {pTrips.length}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 py-20 text-center flex flex-col items-center">
             <span className="text-4xl mb-3 opacity-50">👥</span>
             <h3 className="text-lg font-bold text-slate-600">No personnel found</h3>
             <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or add a new person.</p>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Person">
        <PersonnelForm onSave={personnelService.add} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editPerson} onClose={() => setEditPerson(null)} title="Edit Person">
        {editPerson && <PersonnelForm initial={editPerson} onSave={d => personnelService.update(editPerson.id, d)} onCancel={() => setEditPerson(null)} />}
      </Modal>
      <Modal open={!!delPerson} onClose={() => setDelPerson(null)} title="Delete Person">
        {delPerson && (
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
              <p className="text-sm font-bold text-rose-700 mb-1">⚠️ This action is permanent and cannot be undone.</p>
              <p className="text-sm text-rose-600">Deleting <strong>{delPerson.name}</strong> will:</p>
              <ul className="text-sm text-rose-600 list-disc list-inside mt-1 space-y-0.5">
                <li>Remove all their ledger earnings & payment history</li>
                <li>Remove any loans linked to them</li>
                <li>Unlink them from historical trip records (trips remain, driver/conductor will show as blank)</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDelPerson(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => { await personnelService.delete(delPerson.id); setDelPerson(null); }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Delete Permanently</button>
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
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
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
      <div className="flex gap-3 pt-2 mobile-action-stack sm:flex-row">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
