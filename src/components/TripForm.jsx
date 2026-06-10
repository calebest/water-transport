import { useState } from "react";
import { today, calcExpenses, calcProfit, fmt, FIXED_EXPENSE_KEYS } from "../utils/helpers";
import { locationService } from "../services/locations";

const EMPTY_FORM = {
  date: today(), lorry: "KBZ", tripNumber: "",
  location: "",
  revenue: "",
  amountPaid: "",
  driverId: "",
  conductorId: "",
  odometerStart: "",
  odometerEnd: "",
  expenses: {
    water: "", diesel: "", petrol: "", police: "", driver: "", conductor: "",
    custom: []   // [{ id, label, amount }]
  }
};

const normaliseExpenses = (exp = {}) => ({
  water: exp.water ?? "",
  diesel: exp.diesel ?? "",
  petrol: exp.petrol ?? "",
  police: exp.police ?? "",
  driver: exp.driver ?? "",
  conductor: exp.conductor ?? "",
  custom: (exp.custom || []).map((c, i) => ({ id: Date.now() + i, label: c.label || "", amount: c.amount ?? "" }))
});

export default function TripForm({ initial, locations = [], personnel = [], vehicles = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!initial) return {
      ...EMPTY_FORM,
      lorry: vehicles.length > 0 ? vehicles[0].plate : "KBZ",
    };
    return {
      ...initial,
      driverId: initial.driverId || "",
      conductorId: initial.conductorId || "",
      odometerStart: initial.odometerStart || "",
      odometerEnd: initial.odometerEnd || "",
      expenses: normaliseExpenses(initial.expenses)
    };
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
    const badCustom = (form.expenses.custom || []).find(c => !c.label.trim() || c.amount === "");
    if (badCustom) {
      alert("Each custom expense needs both a name and an amount."); return;
    }
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Date *</label>
          <input type="date" className={inp} value={form.date} onChange={e => setField("date", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Lorry *</label>
          <select className={inp} value={form.lorry} onChange={e => setField("lorry", e.target.value)}>
            {vehicles.length > 0
              ? vehicles.map(v => <option key={v.id} value={v.plate}>{v.plate}</option>)
              : <><option>KBZ</option><option>KBL</option></>}
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
          <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Paid (KES)</label>
          <input type="number" className={inp} placeholder="Leave blank if fully paid" value={form.amountPaid} onChange={e => setField("amountPaid", e.target.value)} />
        </div>

        {personnel.length > 0 && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Driver</label>
              <select className={inp} value={form.driverId} onChange={e => setField("driverId", e.target.value)}>
                <option value="">— None —</option>
                {personnel.filter(p => p.role === "Driver" || p.role === "Both").map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Conductor</label>
              <select className={inp} value={form.conductorId} onChange={e => setField("conductorId", e.target.value)}>
                <option value="">— None —</option>
                {personnel.filter(p => p.role === "Conductor" || p.role === "Both").map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Odometer Start (km)</label>
          <input type="number" className={inp} placeholder="Optional" value={form.odometerStart} onChange={e => setField("odometerStart", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Odometer End (km)</label>
          <input type="number" className={inp} placeholder="Optional" value={form.odometerEnd} onChange={e => setField("odometerEnd", e.target.value)} />
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
                <input
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-300"
                  placeholder="e.g. Repair, Toll, Tyres…"
                  value={c.label}
                  onChange={e => updateCustomField(c.id, "label", e.target.value)}
                />
                <input
                  type="number"
                  className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-300"
                  placeholder="Amount"
                  value={c.amount}
                  onChange={e => updateCustomField(c.id, "amount", e.target.value)}
                />
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

      <div className="rounded-xl bg-slate-50 p-4 space-y-2">
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
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Amount Paid</span>
          <span className="font-bold text-amber-600">{form.amountPaid !== "" ? fmt(form.amountPaid) : (form.revenue ? fmt(form.revenue) : "0")}</span>
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
