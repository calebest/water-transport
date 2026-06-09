
// ============================================================
// WATER TRANSPORT MANAGER — Full React App
// Stack: React + Firebase (Firestore + Auth) + Tailwind + Recharts
// ============================================================
// SETUP INSTRUCTIONS:
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Enable Email/Password Authentication
//   3. Create a Firestore database
//   4. Copy .env.example to .env and add your Firebase project config
//   5. Apply Firestore security rules (see bottom of file)
//   6. Run: npm create vite@latest water-transport -- --template react
//          cd water-transport && npm install
//          npm install firebase recharts jspdf jspdf-autotable
//          Copy this file as src/App.jsx
//          Setup Tailwind CSS (see SETUP_GUIDE.md)
// ============================================================

import { useState, useEffect, useContext, createContext, useMemo } from "react";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword
} from "firebase/auth";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc, setDoc
} from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── CONTEXTS ─────────────────────────────────────────────────
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

// ── FIXED EXPENSE FIELDS (always shown) ──────────────────────
const FIXED_EXPENSE_KEYS = ["water", "diesel", "petrol", "police", "driver", "conductor"];

// ── HELPERS ──────────────────────────────────────────────────
const fmt = (n) => `KES ${Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString("en-KE");

// Calculate total from both fixed fields and custom[] array
const calcExpenses = (exp = {}) => {
  const fixedTotal = FIXED_EXPENSE_KEYS.reduce((s, k) => s + Number(exp[k] || 0), 0);
  const customTotal = (exp.custom || []).reduce((s, c) => s + Number(c.amount || 0), 0);
  return fixedTotal + customTotal;
};

const calcProfit = (revenue, expenses) => Number(revenue || 0) - expenses;

const today = () => new Date().toISOString().slice(0, 10);

const getWeekRange = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
};

const getMonthRange = () => {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return [first, last];
};

const filterByRange = (trips, start, end) =>
  trips.filter(t => t.date >= start && t.date <= end);

const summarize = (trips) => ({
  revenue: trips.reduce((s, t) => s + Number(t.revenue || 0), 0),
  expenses: trips.reduce((s, t) => s + Number(t.totalExpenses || 0), 0),
  profit: trips.reduce((s, t) => s + Number(t.profit || 0), 0),
  count: trips.length,
});

// Collect all unique expense labels across a set of trips (fixed + custom)
const collectExpenseKeys = (trips) => {
  const customLabels = new Set();
  trips.forEach(t => {
    (t.expenses?.custom || []).forEach(c => {
      if (c.label) customLabels.add(c.label);
    });
  });
  return { fixed: FIXED_EXPENSE_KEYS, custom: [...customLabels] };
};

// Sum a named expense across all trips (works for both fixed and custom)
const sumExpenseKey = (trips, key, isCustom = false) => {
  if (!isCustom) return trips.reduce((s, t) => s + Number(t.expenses?.[key] || 0), 0);
  return trips.reduce((s, t) => {
    const match = (t.expenses?.custom || []).find(c => c.label === key);
    return s + Number(match?.amount || 0);
  }, 0);
};

// ── CSV EXPORT ───────────────────────────────────────────────
const exportCSV = (trips, filename) => {
  const { fixed, custom } = collectExpenseKeys(trips);
  const allKeys = [...fixed, ...custom];
  const headers = ["Date", "Lorry", "Trip#", "Location", "Revenue", ...allKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), "Total Expenses", "Profit", "Status"];

  const rows = trips.map(t => {
    const fixedVals = fixed.map(k => t.expenses?.[k] || 0);
    const customVals = custom.map(label => {
      const match = (t.expenses?.custom || []).find(c => c.label === label);
      return match?.amount || 0;
    });
    return [t.date, t.lorry, t.tripNumber, t.location || "N/A", t.revenue, ...fixedVals, ...customVals, t.totalExpenses, t.profit, t.status];
  });

  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
};

// ── PDF EXPORT ───────────────────────────────────────────────
const exportPDF = (trips, title) => {
  const doc = new jsPDF();
  const sum = summarize(trips);
  const kbzSum = summarize(trips.filter(t => t.lorry === "KBZ"));
  const kblSum = summarize(trips.filter(t => t.lorry === "KBL"));

  doc.setFontSize(20); doc.setTextColor(30, 130, 80);
  doc.text("Water Transport Manager", 14, 18);
  doc.setFontSize(13); doc.setTextColor(60, 60, 60);
  doc.text(title, 14, 26);
  doc.setFontSize(10); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

  doc.setFontSize(11); doc.setTextColor(30, 30, 30);
  doc.text(`Total Revenue: KES ${fmtN(sum.revenue)}`, 14, 44);
  doc.text(`Total Expenses: KES ${fmtN(sum.expenses)}`, 14, 51);
  doc.text(`Total Profit: KES ${fmtN(sum.profit)}`, 14, 58);
  doc.text(`Total Trips: ${sum.count}`, 14, 65);
  doc.text(`KBZ — Revenue: KES ${fmtN(kbzSum.revenue)} | Profit: KES ${fmtN(kbzSum.profit)}`, 14, 74);
  doc.text(`KBL — Revenue: KES ${fmtN(kblSum.revenue)} | Profit: KES ${fmtN(kblSum.profit)}`, 14, 81);

  // Build dynamic columns for PDF table
  const { fixed, custom } = collectExpenseKeys(trips);
  const expCols = [...fixed, ...custom].map(k => k.charAt(0).toUpperCase() + k.slice(1));

  autoTable(doc, {
    startY: 90,
    head: [["Date", "Lorry", "Trip#", "Location", "Revenue", ...expCols, "Total Exp", "Profit", "Status"]],
    body: trips.map(t => {
      const fixedVals = fixed.map(k => `KES ${fmtN(t.expenses?.[k] || 0)}`);
      const customVals = custom.map(label => {
        const match = (t.expenses?.custom || []).find(c => c.label === label);
        return `KES ${fmtN(match?.amount || 0)}`;
      });
      return [
        t.date, t.lorry, t.tripNumber,
        t.location || "N/A",
        `KES ${fmtN(t.revenue)}`,
        ...fixedVals, ...customVals,
        `KES ${fmtN(t.totalExpenses)}`,
        `KES ${fmtN(t.profit)}`,
        t.status
      ];
    }),
    headStyles: { fillColor: [30, 130, 80] },
    alternateRowStyles: { fillColor: [240, 255, 245] },
    styles: { fontSize: 8 }
  });

  doc.save(`${title.replace(/\s+/g, "-")}.pdf`);
};

// ── AUTH PROVIDER ─────────────────────────────────────────────
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      try {
        if (u) {
          const snap = await getDoc(doc(db, "users", u.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err.message);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);
  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── TRIP SERVICE ──────────────────────────────────────────────
const tripService = {
  add: async (data) => {
    const totalExpenses = calcExpenses(data.expenses);
    const profit = calcProfit(data.revenue, totalExpenses);
    return addDoc(collection(db, "trips"), {
      ...data,
      revenue: Number(data.revenue),
      totalExpenses,
      profit,
      status: data.status || "Pending",
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    const totalExpenses = calcExpenses(data.expenses);
    const profit = calcProfit(data.revenue, totalExpenses);
    return updateDoc(doc(db, "trips", id), {
      ...data,
      revenue: Number(data.revenue),
      totalExpenses,
      profit
    });
  },
  delete: async (id) => deleteDoc(doc(db, "trips", id)),
  subscribe: (callback) => {
    const q = query(collection(db, "trips"), orderBy("date", "desc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }
};

// ── LOCATION SERVICE ──────────────────────────────────────────
const locationService = {
  add: async (data) => {
    return addDoc(collection(db, "locations"), {
      name: data.name,
      revenue: Number(data.revenue),
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    return updateDoc(doc(db, "locations", id), {
      name: data.name,
      revenue: Number(data.revenue)
    });
  },
  delete: async (id) => deleteDoc(doc(db, "locations", id)),
  subscribe: (callback) => {
    const q = query(collection(db, "locations"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }
};

// ══════════════════════════════════════════════════════════════
//  UI COMPONENTS
// ══════════════════════════════════════════════════════════════

function StatCard({ label, value, icon, color = "green", sub }) {
  const colors = {
    green: "from-emerald-500 to-teal-600",
    red: "from-rose-500 to-red-600",
    blue: "from-blue-500 to-indigo-600",
    amber: "from-amber-500 to-orange-500",
    slate: "from-slate-600 to-slate-800",
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colors[color]} p-5 text-white shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {sub && <p className="mt-1 text-xs opacity-70">{sub}</p>}
        </div>
        <span className="text-3xl opacity-30">{icon}</span>
      </div>
    </div>
  );
}

function Badge({ children, color = "green" }) {
  const c = {
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-100 text-slate-600"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c[color]}`}>
      {children}
    </span>
  );
}

const SYSTEM_FLOW_STEPS = [
  {
    step: "01",
    title: "Set routes and prices",
    text: "Locations store the standard price for each delivery route, so new trip revenue can be filled from the route list."
  },
  {
    step: "02",
    title: "Record each trip",
    text: "A trip captures the lorry, date, route, trip number, payment status, and all standard or extra expenses."
  },
  {
    step: "03",
    title: "Calculate profit",
    text: "The system totals expenses automatically, subtracts them from revenue, and keeps the dashboard figures current."
  },
  {
    step: "04",
    title: "Review and export",
    text: "Reports summarize daily, weekly, and monthly performance by lorry, with CSV and PDF exports ready for records."
  }
];

function SystemFlowHighlight() {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-blue-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">How the system works</p>
        <h2 className="mt-1 text-lg font-black text-slate-800">From route setup to profit reports</h2>
      </div>
      <div className="grid gap-0 md:grid-cols-4">
        {SYSTEM_FLOW_STEPS.map((item, index) => (
          <div
            key={item.step}
            className={`relative p-5 ${index < SYSTEM_FLOW_STEPS.length - 1 ? "border-b border-slate-100 md:border-b-0 md:border-r" : ""}`}
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white shadow-md shadow-emerald-600/20">
              {item.step}
            </div>
            <h3 className="text-sm font-black text-slate-800">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`relative max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? "w-full max-w-2xl" : "w-full max-w-md"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── TRIP FORM (with dynamic custom expense fields) ────────────
const EMPTY_FORM = {
  date: today(), lorry: "KBZ", tripNumber: "",
  location: "",
  revenue: "",
  expenses: {
    water: "", diesel: "", petrol: "", police: "", driver: "", conductor: "",
    custom: []   // [{ id, label, amount }]
  },
  status: "Pending"
};

// Normalise an existing trip's expenses so the form can edit it correctly
const normaliseExpenses = (exp = {}) => ({
  water: exp.water ?? "",
  diesel: exp.diesel ?? "",
  petrol: exp.petrol ?? "",
  police: exp.police ?? "",
  driver: exp.driver ?? "",
  conductor: exp.conductor ?? "",
  custom: (exp.custom || []).map((c, i) => ({ id: Date.now() + i, label: c.label || "", amount: c.amount ?? "" }))
});

function TripForm({ initial, locations = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_FORM;
    return { ...initial, expenses: normaliseExpenses(initial.expenses) };
  });
  const [saving, setSaving] = useState(false);

  // New location inline state
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocRev, setNewLocRev] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFixed = (k, v) => setForm(f => ({ ...f, expenses: { ...f.expenses, [k]: v } }));

  const handleLocationChange = (e) => {
    const val = e.target.value;
    if (val === "ADD_NEW") {
      setShowInlineAdd(true);
      setField("location", "");
    } else {
      setShowInlineAdd(false);
      setField("location", val);
      const selected = locations.find(loc => loc.name === val);
      if (selected) {
        setField("revenue", selected.revenue);
      }
    }
  };

  const handleCreateInlineLocation = async () => {
    if (!newLocName.trim() || !newLocRev) {
      alert("Please enter both location name and price.");
      return;
    }
    setInlineSaving(true);
    try {
      await locationService.add({
        name: newLocName.trim(),
        revenue: Number(newLocRev)
      });
      setField("location", newLocName.trim());
      setField("revenue", Number(newLocRev));
      setShowInlineAdd(false);
      setNewLocName("");
      setNewLocRev("");
    } catch (err) {
      alert("Error creating location: " + err.message);
    } finally {
      setInlineSaving(false);
    }
  };

  // Custom field helpers
  const addCustomField = () => {
    setForm(f => ({
      ...f,
      expenses: {
        ...f.expenses,
        custom: [...(f.expenses.custom || []), { id: Date.now(), label: "", amount: "" }]
      }
    }));
  };

  const updateCustomField = (id, key, value) => {
    setForm(f => ({
      ...f,
      expenses: {
        ...f.expenses,
        custom: f.expenses.custom.map(c => c.id === id ? { ...c, [key]: value } : c)
      }
    }));
  };

  const removeCustomField = (id) => {
    setForm(f => ({
      ...f,
      expenses: {
        ...f.expenses,
        custom: f.expenses.custom.filter(c => c.id !== id)
      }
    }));
  };

  const totalExp = calcExpenses(form.expenses);
  const profit = calcProfit(form.revenue, totalExp);

  const handleSubmit = async () => {
    if (!form.date || !form.tripNumber || !form.location || !form.revenue) {
      alert("Date, trip number, location, and revenue are required."); return;
    }
    // Validate custom fields: each must have both a label and an amount
    const badCustom = (form.expenses.custom || []).find(c => !c.label.trim() || c.amount === "");
    if (badCustom) {
      alert("Each custom expense needs both a name and an amount."); return;
    }
    // Strip the UI-only `id` before saving to Firestore
    const cleanCustom = (form.expenses.custom || []).map(({ label, amount }) => ({
      label: label.trim(),
      amount: Number(amount)
    }));
    const payload = {
      ...form,
      expenses: { ...form.expenses, custom: cleanCustom }
    };
    setSaving(true);
    try { await onSave(payload); onCancel(); }
    catch (e) { alert("Error saving: " + e.message); }
    finally { setSaving(false); }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-5">
      {/* ── Trip Info ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Date *</label>
          <input type="date" className={inp} value={form.date} onChange={e => setField("date", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Lorry *</label>
          <select className={inp} value={form.lorry} onChange={e => setField("lorry", e.target.value)}>
            <option>KBZ</option><option>KBL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Trip # *</label>
          <input className={inp} placeholder="e.g. 001" value={form.tripNumber} onChange={e => setField("tripNumber", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Location *</label>
          <select 
            className={inp} 
            value={showInlineAdd ? "ADD_NEW" : (form.location || "")} 
            onChange={handleLocationChange}
          >
            <option value="">Select Location...</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.name}>
                {loc.name} ({fmt(loc.revenue)})
              </option>
            ))}
            <option value="ADD_NEW">+ Add New Location...</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Revenue (KES) *</label>
          <input type="number" className={inp} placeholder="0" value={form.revenue} onChange={e => setField("revenue", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
          <select className={inp} value={form.status} onChange={e => setField("status", e.target.value)}>
            <option>Pending</option><option>Paid</option>
          </select>
        </div>

        {showInlineAdd && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 col-span-2">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Create New Location</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Location Name *</label>
                <input 
                  className={inp} 
                  placeholder="e.g. Mombasa" 
                  value={newLocName} 
                  onChange={e => setNewLocName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Price/Revenue (KES) *</label>
                <input 
                  type="number" 
                  className={inp} 
                  placeholder="e.g. 15000" 
                  value={newLocRev} 
                  onChange={e => setNewLocRev(e.target.value)} 
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setShowInlineAdd(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleCreateInlineLocation} 
                disabled={inlineSaving}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {inlineSaving ? "Creating..." : "Create & Select"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed Expense Fields ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Standard Expenses</p>
        <div className="grid grid-cols-2 gap-3">
          {FIXED_EXPENSE_KEYS.map(k => (
            <div key={k}>
              <label className="block text-xs font-semibold text-slate-500 mb-1 capitalize">{k}</label>
              <input type="number" className={inp} placeholder="0"
                value={form.expenses[k]}
                onChange={e => setFixed(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Custom / Additional Expense Fields ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Additional Expenses</p>
          <button
            type="button"
            onClick={addCustomField}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Expense
          </button>
        </div>

        {(form.expenses.custom || []).length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-5 text-center text-xs text-slate-400 font-medium">
            No additional expenses — click <span className="text-emerald-600 font-bold">+ Add Expense</span> to add one
          </div>
        ) : (
          <div className="space-y-2">
            {form.expenses.custom.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                {/* Label input */}
                <input
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-300"
                  placeholder="e.g. Repair, Toll, Tyres…"
                  value={c.label}
                  onChange={e => updateCustomField(c.id, "label", e.target.value)}
                />
                {/* Amount input */}
                <input
                  type="number"
                  className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-300"
                  placeholder="Amount"
                  value={c.amount}
                  onChange={e => updateCustomField(c.id, "amount", e.target.value)}
                />
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeCustomField(c.id)}
                  className="flex-shrink-0 h-8 w-8 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-colors flex items-center justify-center text-sm font-bold"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Live Calculation ── */}
      <div className="rounded-xl bg-slate-50 p-4 space-y-2">
        {/* Show custom field subtotals */}
        {(form.expenses.custom || []).filter(c => c.label && c.amount !== "").map(c => (
          <div key={c.id} className="flex justify-between text-xs text-slate-400">
            <span className="capitalize">{c.label || "Unnamed"}</span>
            <span>{fmt(c.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Total Expenses</span>
          <span className="font-bold text-rose-600">{fmt(totalExp)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Revenue</span>
          <span className="font-bold text-blue-600">{fmt(form.revenue)}</span>
        </div>
        <div className="border-t border-slate-200 pt-2 flex justify-between">
          <span className="font-bold text-slate-700">Profit</span>
          <span className={`text-lg font-black ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {fmt(profit)}
          </span>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save Trip"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PAGES
// ══════════════════════════════════════════════════════════════

// ── LOGIN ─────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) { setErr("Please fill in all fields."); return; }
    setLoading(true); setErr("");
    try { await login(email, pass); }
    catch (e) { setErr(e.code === "auth/invalid-credential" ? "Invalid email or password." : e.message); }
    finally { setLoading(false); }
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 shadow-2xl shadow-emerald-500/40 mb-4">
            <span className="text-4xl">🚛</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Water Transport</h1>
          <p className="text-emerald-400 text-sm mt-1 font-medium">Fleet Management System</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Sign In</h2>
          {err && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{err}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
            <input className={inp} type="email" placeholder="admin@company.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Password</label>
            <input className={inp} type="password" placeholder="••••••••"
              value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <button onClick={handleLogin} disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 disabled:opacity-60 transition-all">
            {loading ? "Signing in…" : "Sign In →"}
          </button>
          <p className="text-xs text-center text-slate-400 pt-2">Contact your administrator to get access</p>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function DashboardPage({ trips }) {
  const todayStr = today();
  const [weekStart, weekEnd] = getWeekRange();
  const [monthStart, monthEnd] = getMonthRange();

  const todayTrips = useMemo(() => filterByRange(trips, todayStr, todayStr), [trips, todayStr]);
  const weekTrips = useMemo(() => filterByRange(trips, weekStart, weekEnd), [trips, weekStart, weekEnd]);
  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);

  const todaySummary = useMemo(() => summarize(todayTrips), [todayTrips]);
  const weekSummary = useMemo(() => summarize(weekTrips), [weekTrips]);
  const monthSummary = useMemo(() => summarize(monthTrips), [monthTrips]);

  const chartData = useMemo(() => {
    const days = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key.slice(5), revenue: 0, expenses: 0, profit: 0 };
    }
    trips.forEach(t => {
      if (days[t.date]) {
        days[t.date].revenue += Number(t.revenue || 0);
        days[t.date].expenses += Number(t.totalExpenses || 0);
        days[t.date].profit += Number(t.profit || 0);
      }
    });
    return Object.values(days);
  }, [trips]);

  const kbzToday = useMemo(() => summarize(todayTrips.filter(t => t.lorry === "KBZ")), [todayTrips]);
  const kblToday = useMemo(() => summarize(todayTrips.filter(t => t.lorry === "KBL")), [todayTrips]);

  const kbzMonth = useMemo(() => summarize(monthTrips.filter(t => t.lorry === "KBZ")), [monthTrips]);
  const kblMonth = useMemo(() => summarize(monthTrips.filter(t => t.lorry === "KBL")), [monthTrips]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Today — {todayStr}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Revenue" value={fmt(todaySummary.revenue)} icon="💰" color="blue" />
          <StatCard label="Expenses" value={fmt(todaySummary.expenses)} icon="📉" color="red" />
          <StatCard label="Profit" value={fmt(todaySummary.profit)} icon="📈" color="green"
            sub={`${todaySummary.count} trips`} />
          <StatCard label="Trips" value={todaySummary.count} icon="🚛" color="amber" />
        </div>
      </div>

      <SystemFlowHighlight />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">KBZ Today</p>
          <p className="text-xl font-black text-slate-800">{fmt(kbzToday.profit)}</p>
          <p className="text-xs text-slate-500 mt-1">{kbzToday.count} trips · Rev {fmt(kbzToday.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">KBL Today</p>
          <p className="text-xl font-black text-slate-800">{fmt(kblToday.profit)}</p>
          <p className="text-xs text-slate-500 mt-1">{kblToday.count} trips · Rev {fmt(kblToday.revenue)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-4">14-Day Profit Trend</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v, n) => [fmt(v), n]} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
            <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} dot={false} name="Expenses" />
            <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} dot={false} name="Profit" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">This Week</p>
          <p className="text-xl font-black text-slate-800">{fmt(weekSummary.profit)}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Revenue</span><span className="font-semibold">{fmt(weekSummary.revenue)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Expenses</span><span className="font-semibold text-rose-500">{fmt(weekSummary.expenses)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">This Month</p>
          <p className="text-xl font-black text-slate-800">{fmt(monthSummary.profit)}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Revenue</span><span className="font-semibold">{fmt(monthSummary.revenue)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Expenses</span><span className="font-semibold text-rose-500">{fmt(monthSummary.expenses)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-4">Monthly Lorry Comparison</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[
            { name: "KBZ", revenue: kbzMonth.revenue, profit: kbzMonth.profit },
            { name: "KBL", revenue: kblMonth.revenue, profit: kblMonth.profit },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v, n) => [fmt(v), n]} />
            <Legend />
            <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── TRIPS ─────────────────────────────────────────────────────
function TripsPage({ trips, locations }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [delTrip, setDelTrip] = useState(null);
  const [search, setSearch] = useState("");
  const [filterLorry, setFilterLorry] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => trips.filter(t => {
    if (filterLorry !== "All" && t.lorry !== filterLorry) return false;
    if (filterDate && t.date !== filterDate) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.tripNumber?.toString().includes(s) || t.lorry?.toLowerCase().includes(s) || t.date?.includes(s) || t.location?.toLowerCase().includes(s);
    }
    return true;
  }), [trips, filterLorry, filterDate, search]);

  const handleAdd = (form) => tripService.add(form);
  const handleEdit = (form) => tripService.update(editTrip.id, form);
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
          <option>All</option><option>KBZ</option><option>KBL</option>
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

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Date", "Lorry", "Trip #", "Location", "Revenue", "Expenses", "Profit", "Status", isAdmin ? "Actions" : ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400">No trips found</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700">{t.date}</td>
                  <td className="px-4 py-3">
                    <Badge color={t.lorry === "KBZ" ? "blue" : "amber"}>{t.lorry}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.tripNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{t.location || "N/A"}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">{fmt(t.revenue)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-500">{fmt(t.totalExpenses)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${Number(t.profit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {fmt(t.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={t.status === "Paid" ? "green" : "amber"}>{t.status}</Badge>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditTrip(t)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100">Edit</button>
                        <button onClick={() => setDelTrip(t)}
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-100">Del</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
          {filtered.length} of {trips.length} trips
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Trip" wide>
        <TripForm locations={locations} onSave={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editTrip} onClose={() => setEditTrip(null)} title="Edit Trip" wide>
        {editTrip && <TripForm locations={locations} initial={editTrip} onSave={handleEdit} onCancel={() => setEditTrip(null)} />}
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

// ── REPORTS ───────────────────────────────────────────────────
function ReportsPage({ trips }) {
  const [range, setRange] = useState("daily");
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());

  const rangeTrips = useMemo(() => {
    if (range === "daily") return filterByRange(trips, today(), today());
    if (range === "weekly") { const [s, e] = getWeekRange(); return filterByRange(trips, s, e); }
    if (range === "monthly") { const [s, e] = getMonthRange(); return filterByRange(trips, s, e); }
    return filterByRange(trips, customStart, customEnd);
  }, [trips, range, customStart, customEnd]);

  const sum = useMemo(() => summarize(rangeTrips), [rangeTrips]);
  const kbzSum = useMemo(() => summarize(rangeTrips.filter(t => t.lorry === "KBZ")), [rangeTrips]);
  const kblSum = useMemo(() => summarize(rangeTrips.filter(t => t.lorry === "KBL")), [rangeTrips]);

  // Collect all expense keys (fixed + any custom labels used in this period)
  const { fixed, custom: customLabels } = useMemo(() => collectExpenseKeys(rangeTrips), [rangeTrips]);

  const title = range === "custom"
    ? `Report ${customStart} to ${customEnd}`
    : `${range.charAt(0).toUpperCase() + range.slice(1)} Report`;

  const btnCls = (v) =>
    `px-4 py-2 rounded-xl text-sm font-bold transition-all ${range === v
      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-black text-slate-800">Reports</h2>

      <div className="flex flex-wrap gap-2">
        {["daily", "weekly", "monthly", "custom"].map(v => (
          <button key={v} className={btnCls(v)} onClick={() => setRange(v)}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">From</label>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">To</label>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={fmt(sum.revenue)} icon="💰" color="blue" />
        <StatCard label="Expenses" value={fmt(sum.expenses)} icon="📉" color="red" />
        <StatCard label="Profit" value={fmt(sum.profit)} icon="📈" color="green" />
        <StatCard label="Trips" value={sum.count} icon="🚛" color="amber" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">KBZ</p>
          <p className="text-lg font-black text-slate-800">{fmt(kbzSum.profit)}</p>
          <p className="text-xs text-slate-500">{kbzSum.count} trips · Rev {fmt(kbzSum.revenue)} · Exp {fmt(kbzSum.expenses)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">KBL</p>
          <p className="text-lg font-black text-slate-800">{fmt(kblSum.profit)}</p>
          <p className="text-xs text-slate-500">{kblSum.count} trips · Rev {fmt(kblSum.revenue)} · Exp {fmt(kblSum.expenses)}</p>
        </div>
      </div>

      {/* Expense breakdown — includes custom fields dynamically */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-4">Expense Breakdown</p>
        {[...fixed.map(k => ({ key: k, isCustom: false })),
        ...customLabels.map(k => ({ key: k, isCustom: true }))]
          .map(({ key, isCustom }) => {
            const total = sumExpenseKey(rangeTrips, key, isCustom);
            const pct = sum.expenses > 0 ? (total / sum.expenses * 100).toFixed(1) : 0;
            return (
              <div key={key} className="flex items-center gap-3 mb-2">
                <span className="w-24 text-xs font-semibold capitalize text-slate-500 flex items-center gap-1">
                  {key}
                  {isCustom && (
                    <span className="rounded bg-emerald-100 px-1 text-emerald-600 text-[9px] font-bold">custom</span>
                  )}
                </span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-28 text-right text-xs font-bold text-slate-700">{fmt(total)}</span>
                <span className="w-10 text-right text-xs text-slate-400">{pct}%</span>
              </div>
            );
          })}
        {[...fixed, ...customLabels].length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No expense data in this period</p>
        )}
      </div>

      {rangeTrips.length > 0 ? (
        <div className="flex gap-3">
          <button onClick={() => exportCSV(rangeTrips, title.replace(/\s+/g, "-"))}
            className="flex-1 rounded-xl border-2 border-emerald-600 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 transition-colors">
            ⬇ Export CSV
          </button>
          <button onClick={() => exportPDF(rangeTrips, title)}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
            📄 Export PDF
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
          No trips in this period
        </div>
      )}
    </div>
  );
}

// ── USERS ─────────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const handleAddUser = async () => {
    if (!newEmail || !newName || !newPass) { setErr("All fields required."); return; }
    setAdding(true); setErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmail, newPass);
      await setDoc(doc(db, "users", cred.user.uid), { name: newName, email: newEmail, role: newRole });
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
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
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
                  <Badge color={u.role === "admin" ? "green" : "slate"}>{u.role}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── LOCATIONS ──────────────────────────────────────────────────
function LocationsPage({ locations }) {
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [delLoc, setDelLoc] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800">Locations</h2>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
            + Add Location
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Location Name", "Revenue / Price", isAdmin ? "Actions" : ""].map(h => (
                  h ? <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th> : <th key="empty" className="px-4 py-3" />
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr><td colSpan={3} className="py-16 text-center text-slate-400">No locations found</td></tr>
              ) : locations.map(loc => (
                <tr key={loc.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-700">{loc.name}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{fmt(loc.revenue)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditLoc(loc)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100">Edit</button>
                        <button onClick={() => setDelLoc(loc)}
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-100">Del</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Location">
        <LocationForm onSave={locationService.add} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal open={!!editLoc} onClose={() => setEditLoc(null)} title="Edit Location">
        {editLoc && <LocationForm initial={editLoc} onSave={(data) => locationService.update(editLoc.id, data)} onCancel={() => setEditLoc(null)} />}
      </Modal>
      <Modal open={!!delLoc} onClose={() => setDelLoc(null)} title="Delete Location">
        {delLoc && (
          <div className="space-y-4">
            <p className="text-slate-600">
              Delete location <strong>{delLoc.name}</strong>?
              <br /><span className="text-rose-500 font-semibold">This will not delete existing trips to this location.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelLoc(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={async () => {
                try {
                  await locationService.delete(delLoc.id);
                  setDelLoc(null);
                } catch (e) {
                  alert(e.message);
                }
              }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700">
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LocationForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [revenue, setRevenue] = useState(initial?.revenue || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !revenue) {
      alert("Name and price are required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), revenue: Number(revenue) });
      onCancel();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Location Name *</label>
        <input className={inp} placeholder="e.g. Mombasa" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Price/Revenue (KES) *</label>
        <input type="number" className={inp} placeholder="e.g. 15000" value={revenue} onChange={e => setRevenue(e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save Location"}
        </button>
      </div>
    </div>
  );
}

// ── LAYOUT / NAV ──────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "trips", label: "Trips", icon: "🚛" },
  { id: "locations", label: "Locations", icon: "📍" },
  { id: "reports", label: "Reports", icon: "📄" },
  { id: "users", label: "Users", icon: "👥", adminOnly: true },
];

function Layout({ trips, locations }) {
  const { profile, logout, isAdmin } = useAuth();
  const [page, setPage] = useState("dashboard");

  const navItems = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin);
  const pages = {
    dashboard: <DashboardPage trips={trips} />,
    trips: <TripsPage trips={trips} locations={locations} />,
    locations: <LocationsPage locations={locations} />,
    reports: <ReportsPage trips={trips} />,
    users: <UsersPage />
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-slate-100 shadow-sm fixed inset-y-0 left-0 z-20">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-xl shadow">🚛</div>
            <div>
              <p className="text-sm font-black text-slate-800 leading-tight">Water Transport</p>
              <p className="text-xs text-slate-400">Manager</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${page === n.id ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-slate-600 hover:bg-slate-50"
                }`}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
              {profile?.name?.charAt(0) || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{profile?.name}</p>
              <Badge color={isAdmin ? "green" : "slate"}>{profile?.role}</Badge>
            </div>
          </div>
          <button onClick={logout}
            className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition-colors">
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-100 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚛</span>
            <span className="font-black text-slate-800 text-sm">Water Transport</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={isAdmin ? "green" : "slate"}>{profile?.role}</Badge>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-rose-500 font-semibold">Sign Out</button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-5xl mx-auto">
            {pages[page] || pages.dashboard}
          </div>
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-lg z-20">
          <div className="flex">
            {navItems.map(n => (
              <button key={n.id} onClick={() => setPage(n.id)}
                className={`flex-1 flex flex-col items-center py-2.5 text-xs font-semibold transition-colors ${page === n.id ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
                  }`}>
                <span className="text-xl mb-0.5">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────
function AppInner() {
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsubTrips = tripService.subscribe(setTrips);
    const unsubLocs = locationService.subscribe(setLocations);
    return () => {
      unsubTrips();
      unsubLocs();
    };
  }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🚛</div>
        <p className="text-slate-500 font-semibold">Loading…</p>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;
  return <Layout trips={trips} locations={locations} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

// ══════════════════════════════════════════════════════════════
//  FIRESTORE SECURITY RULES
// ══════════════════════════════════════════════════════════════
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function role() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isAdmin() { return role() == 'admin'; }
    function isAuthed() { return request.auth != null; }

    match /trips/{tripId} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && isAdmin();
    }
    match /locations/{locationId} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && isAdmin();
    }
    match /users/{userId} {
      allow read: if isAuthed();
      allow create: if isAuthed() && isAdmin();
      allow update: if isAuthed() && (request.auth.uid == userId || isAdmin());
    }
  }
}
*/
