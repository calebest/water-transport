import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { db, auth } from "../firebase";
import { Badge } from "../components/ui";

// Secondary Firebase app — used ONLY for creating new users.
// This prevents createUserWithEmailAndPassword from signing out the current admin.
const secondaryApp = initializeApp(auth.app.options, "secondary-user-creator");
const secondaryAuth = getAuth(secondaryApp);

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);

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
      await setDoc(doc(db, "users", cred.user.uid), { name: newName, email: newEmail, role: newRole });
      // Sign out the secondary session immediately
      await secondaryAuth.signOut();
      setNewEmail(""); setNewName(""); setNewPass(""); setShowForm(false);
    } catch (e) { setErr(e.message); }
    finally { setAdding(false); }
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
                <option value="viewer">Viewer (read-only)</option>
                <option value="driver">Driver (can submit trips)</option>
                <option value="conductor">Conductor (can submit trips)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </div>
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
              {["Name", "Email", "Role"].map(h => (
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
                  <Badge color={u.role === "admin" ? "green" : u.role === "driver" ? "blue" : u.role === "conductor" ? "amber" : "slate"}>{u.role}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
