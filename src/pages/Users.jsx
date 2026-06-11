import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { db, auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Modal } from "../components/ui";

// Secondary Firebase app — used ONLY for creating new users.
// This prevents createUserWithEmailAndPassword from signing out the current admin.
const secondaryApp = initializeApp(auth.app.options, "secondary-user-creator");
const secondaryAuth = getAuth(secondaryApp);

export default function UsersPage({ personnel = [] }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [newPersonnelId, setNewPersonnelId] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [delUser, setDelUser] = useState(null);

  useEffect(() => {
    return onSnapshot(
      collection(db, "users"),
      snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      err => {
        console.error("Users snapshot error:", err.message);
        setErr("Could not load users: " + err.message);
      }
    );
  }, []);

  const handleAddUser = async () => {
    if (!newEmail || !newName || !newPass) { setErr("All fields required."); return; }
    setAdding(true); setErr("");
    try {
      // Use secondary auth so the admin is NOT signed out
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPass);
      const userData = { name: newName, email: newEmail, role: newRole };
      if (newPersonnelId) userData.personnelId = newPersonnelId;
      await setDoc(doc(db, "users", cred.user.uid), userData);
      // Sign out the secondary session immediately
      await secondaryAuth.signOut();
      setNewEmail(""); setNewName(""); setNewPass(""); setNewPersonnelId(""); setShowForm(false);
    } catch (e) { setErr(e.message); }
    finally { setAdding(false); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (e) {
      alert("Failed to update role: " + e.message);
    }
  };

  const handlePersonnelLink = async (userId, personnelId) => {
    try {
      await updateDoc(doc(db, "users", userId), { personnelId: personnelId || null });
    } catch (e) {
      alert("Failed to link personnel: " + e.message);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newName = formData.get("name");
    try {
      await updateDoc(doc(db, "users", editUser.id), { name: newName });
      setEditUser(null);
    } catch(err) { alert(err.message); }
  };

  const handleDelUser = async () => {
    try {
      await deleteDoc(doc(db, "users", delUser.id));
      setDelUser(null);
    } catch(err) { alert(err.message); }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800">Users</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700">
          {showForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm font-bold text-slate-700">Create New User</p>
          {err && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">{err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
              <input className={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
              <input className={inp} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@co.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
              <input className={inp} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 6 chars" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
              <select className={inp} value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="viewer">Viewer</option>
                <option value="driver">Driver</option>
                <option value="conductor">Conductor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {(newRole === "driver" || newRole === "conductor") && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Link to Personnel Record <span className="text-slate-300 font-normal">(optional)</span></label>
                <select className={inp} value={newPersonnelId} onChange={e => setNewPersonnelId(e.target.value)}>
                  <option value="">— Don't link yet —</option>
                  {personnel.filter(p => p.role === "Driver" || p.role === "Conductor" || p.role === "Both").map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button onClick={handleAddUser} disabled={adding}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
            {adding ? "Creating…" : "Create User"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Name", "Email", "Role", "Linked Profile", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={3} className="py-12 text-center text-slate-400">No users yet</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  {u.id === currentUser?.uid ? (
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
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {(u.role === "driver" || u.role === "conductor") && u.id !== currentUser?.uid ? (
                    <select
                      value={u.personnelId || ""}
                      onChange={e => handlePersonnelLink(u.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-emerald-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[140px] truncate"
                      title={u.personnelId ? (personnel.find(p => p.id === u.personnelId)?.name || "Linked") : "Not linked"}
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
                  {u.id !== currentUser?.uid && (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditUser(u)} className="rounded-lg bg-blue-50 p-2 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors" title="Edit Name">✏️</button>
                      <button onClick={() => setDelUser(u)} className="rounded-lg bg-rose-50 p-2 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-colors" title="Delete User">🗑️</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <form onSubmit={handleEditUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
              <input name="name" defaultValue={editUser.name} className={inp} autoFocus required />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditUser(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!delUser} onClose={() => setDelUser(null)} title="Delete User">
        {delUser && (
          <div className="space-y-4">
            <p className="text-slate-600">
              Are you sure you want to remove <strong>{delUser.name}</strong> ({delUser.email})?
              <br /><span className="text-rose-500 font-semibold text-xs">Note: They will no longer be able to log in or access any data.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelUser(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleDelUser} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
