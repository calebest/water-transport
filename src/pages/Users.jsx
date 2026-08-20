import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Modal } from "../components/ui";

const ROLES = ["viewer", "driver", "conductor", "broker", "owner", "admin"];

const emptyForm = { email: "", password: "", name: "", phone: "", role: "driver" };

export default function UsersPage({ personnel = [], brokers = [] }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addLoading, setAddLoading] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchProfiles = async () => {
    // Always fetch profiles from the DB
    const { data: profileData, error } = await supabase.from("profiles").select("*");
    if (error) { setErr("Could not load users: " + error.message); return; }

    // Fetch auth users via server-side API so orphaned accounts still appear
    try {
      const resp = await fetch("/api/list-users");
      if (resp.ok) {
        const { users: authUsers } = await resp.json();
        const profileMap = new Map((profileData ?? []).map(p => [p.id, p]));

        const merged = authUsers.map(au => ({
          id: au.id,
          email: au.email,
          name: profileMap.get(au.id)?.name || au.name || au.email,
          phone: profileMap.get(au.id)?.phone || au.phone || "",
          role: profileMap.get(au.id)?.role || "viewer",
          personnel_id: profileMap.get(au.id)?.personnel_id || null,
          _hasProfile: profileMap.has(au.id),
        }));
        setUsers(merged);
        return;
      }
    } catch {/* fall through to profiles-only */}

    setUsers(profileData ?? []);
  };

  useEffect(() => {
    let active = true;
    if (active) fetchProfiles();
    const channel = supabase
      .channel("public:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchProfiles();
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRoleChange = async (u, newRole) => {
    try {
      // upsert so orphaned auth accounts also get a profile
      const { error } = await supabase.from("profiles").upsert({ 
        id: u.id, 
        role: newRole,
        name: u.name,
        phone: u.phone
      });
      if (error) throw error;
      setTimeout(fetchProfiles, 400);
    } catch (e) {
      alert("Failed to update role: " + e.message);
    }
  };

  const handlePersonnelLink = async (u, personnelId) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ 
          id: u.id, 
          personnel_id: personnelId || null,
          role: u.role,
          name: u.name,
          phone: u.phone
        });
      if (error) throw error;
      setTimeout(fetchProfiles, 400);
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
      const { error } = await supabase
        .from("profiles")
        .update({ name: newName, phone: newPhone })
        .eq("id", editUser.id);
      if (error) throw error;
      setEditUser(null);
      fetchProfiles();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddErr("");

    try {
      const resp = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addForm.email,
          password: addForm.password,
          name: addForm.name,
          phone: addForm.phone,
          role: addForm.role,
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        throw new Error(result.error || "Failed to create user.");
      }
      if (result.warning) {
        // User created but profile had issues — still close modal and refresh
        console.warn(result.warning);
      }

      setAddModal(false);
      setAddForm(emptyForm);
      setTimeout(fetchProfiles, 800);
    } catch (err) {
      setAddErr(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // 1. Try full deletion via RPC (deletes profile + auth.users)
      await supabase.rpc("delete_user", { target_user_id: deleteTarget.id });

      // 2. Always also explicitly delete the profile row as a guaranteed fallback
      //    (in case RPC only deleted auth.users without cascade, or the function is missing)
      await supabase.from("profiles").delete().eq("id", deleteTarget.id);

      setDeleteTarget(null);
      fetchProfiles();
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const inp =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage access and roles for all system users.</p>
        </div>
        <button
          onClick={() => { setAddForm(emptyForm); setAddErr(""); setAddModal(true); }}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
        >
          + Add User
        </button>
      </div>

      {err && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">
          {err}
        </div>
      )}

      {/* Users Table */}
      <div className="table-scroll-container rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Name / Phone", "Email", "Role", "Linked Profile", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No users yet
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-50 bg-white hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-800">
                    <div className="font-semibold flex items-center gap-1.5">
                      {u.name || "Unknown"}
                      {!u._hasProfile && (
                        <span title="Auth account exists but no profile yet — assign a role to create one" className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">No Profile</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{u.phone || "No phone"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">
                    {u.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.id === currentUser?.id ? (
                      <Badge color="green">{u.role}</Badge>
                    ) : (
                      <select
                        value={u.role || "viewer"}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:border-emerald-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.personnel_id || ""}
                      onChange={(e) => handlePersonnelLink(u, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-emerald-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[140px] truncate"
                      title={
                        u.personnel_id
                          ? (u.role === 'broker' 
                              ? brokers.find(b => b.id === u.personnel_id)?.name 
                              : personnel.find((p) => p.id === u.personnel_id)?.name) || "Linked"
                          : "Not linked"
                      }
                    >
                      <option value="">— Not linked —</option>
                      {u.role === 'broker' ? (
                        brokers.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))
                      ) : (
                        personnel.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditUser(u)}
                        className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Edit user"
                      >
                        Edit
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                          title="Delete user"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
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
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add User Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add New User">
        <form onSubmit={handleAddUser} className="space-y-4">
          {addErr && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">
              {addErr}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
              <input
                className={inp}
                required
                placeholder="John Doe"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
              <input
                className={inp}
                placeholder="+254..."
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
            <input
              type="email"
              className={inp}
              required
              placeholder="user@company.com"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
            <input
              type="password"
              className={inp}
              required
              minLength={6}
              placeholder="Min. 6 characters"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
            <select
              className={inp}
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
            ⚠️ The user will be created immediately and can log in with these credentials.
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setAddModal(false)}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {addLoading ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <p className="font-bold text-slate-800">
                Delete <span className="text-rose-600">{deleteTarget.name || deleteTarget.email}</span>?
              </p>
              <p className="text-sm text-slate-500 mt-1">
                This will permanently remove the user and their login access. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, Delete User"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
