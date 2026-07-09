import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Modal } from "../components/ui";

export default function UsersPage({ personnel = [] }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");

  const [editUser, setEditUser] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchProfiles = async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        if (active) setErr("Could not load users: " + error.message);
      } else if (active) {
        setUsers(data);
      }
    };
    
    fetchProfiles();

    const channel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
    } catch (e) {
      alert("Failed to update role: " + e.message);
    }
  };

  const handlePersonnelLink = async (userId, personnelId) => {
    try {
      const { error } = await supabase.from('profiles').update({ personnel_id: personnelId || null }).eq('id', userId);
      if (error) throw error;
    } catch (e) {
      alert("Failed to link personnel: " + e.message);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newName = formData.get("name");
    const newPhone = formData.get("phone");
    try {
      const { error } = await supabase.from('profiles').update({ name: newName, phone: newPhone }).eq('id', editUser.id);
      if (error) throw error;
      setEditUser(null);
    } catch(err) { alert(err.message); }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-800">Users</h2>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> To invite new users or remove existing user logins, please use the <a href="https://app.supabase.com/" target="_blank" rel="noreferrer" className="underline font-semibold">Supabase Dashboard (Authentication)</a>. You can manage roles and link personnel below.
        </p>
      </div>

      {err && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">{err}</div>}

      <div className="table-scroll-container rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-white">
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Name / Phone", "Role", "Linked Profile", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-slate-400">No users yet</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-slate-50 bg-white hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-800">
                  <div className="font-medium">{u.name || "Unknown"}</div>
                  <div className="text-xs text-slate-500">{u.phone || "No phone"}</div>
                </td>
                <td className="px-4 py-3">
                  {u.id === currentUser?.id ? (
                    <Badge color="green">{u.role}</Badge>
                  ) : (
                    <select
                      value={u.role || "viewer"}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:border-emerald-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="driver">Driver</option>
                      <option value="conductor">Conductor</option>
                      <option value="broker">Broker</option>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {(u.role === "driver" || u.role === "conductor") && u.id !== currentUser?.id ? (
                    <select
                      value={u.personnel_id || ""}
                      onChange={e => handlePersonnelLink(u.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-emerald-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[140px] truncate"
                      title={u.personnel_id ? (personnel.find(p => p.id === u.personnel_id)?.name || "Linked") : "Not linked"}
                    >
                      <option value="">— Not linked —</option>
                      {personnel.filter(p => p.role === "Driver" || p.role === "Conductor" || p.role === "Both").map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditUser(u)} className="rounded-lg bg-blue-50 p-2 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors" title="Edit Info">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User Profile">
        {editUser && (
          <form onSubmit={handleEditUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
              <input name="name" defaultValue={editUser.name} className={inp} autoFocus required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
              <input name="phone" defaultValue={editUser.phone} className={inp} />
            </div>
            <div className="flex gap-3 pt-2 mobile-action-stack sm:flex-row">
              <button type="button" onClick={() => setEditUser(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}
