import { useState, useEffect } from "react";
import {
  today,
  calcDeductions,
  calcOperatingExpenses,
  calcProfit,
  fmt,
  DEDUCTION_KEYS,
  DEDUCTION_LABELS,
  EXPENSE_LABELS,
  FIXED_EXPENSE_KEYS,
  buildLocationName
} from "../utils/helpers";
import { locationService } from "../services/locations";
import { useAuth } from "../contexts/AuthContext";

const PayerSelect = ({ value, onChange }) => (
  <select
    className="h-full bg-slate-50/50 border-l border-slate-200 px-1 py-2 text-[10px] sm:text-xs font-bold text-slate-500 outline-none rounded-r-lg cursor-pointer hover:bg-slate-100 transition-colors"
    value={value || "Company"}
    onChange={e => onChange(e.target.value)}
  >
    <option value="Company">🏢 Co.</option>
    <option value="Broker">🤝 Brok.</option>
    <option value="Driver">🚗 Driv.</option>
    <option value="Conductor">🎟️ Cond.</option>
  </select>
);

const EMPTY_FORM = {
  date: today(), lorry: "KBZ", tripNumber: "",
  location: "",
  revenue: "",
  status: "Pending",
  amountPaid: "",
  driverId: "",
  conductorId: "",
  brokerId: "",
  odometerStart: "",
  odometerEnd: "",
  expenses: {
    water: "", diesel: "", petrol: "", police: "", driver: "", conductor: "", repairs: "",
    custom: [],   // [{ id, label, amount, paidBy }]
    _payers: {},
    _defaultPayer: "Company"
  },
  deductions: {
    loanRecovery: "", advanceRecovery: "", other: ""
  }
};

const normaliseExpenses = (exp = {}) => ({
  diesel: exp.diesel ?? "",
  water: exp.water ?? "",
  driver: exp.driver ?? "",
  conductor: exp.conductor ?? "",
  police: exp.police ?? "",
  repairs: exp.repairs ?? "",
  petrol: exp.petrol ?? exp.fuel ?? "",
  _payers: exp._payers || {},
  _defaultPayer: exp._defaultPayer || "Company",
  custom: (exp.custom || []).map((c, i) => ({ id: Date.now() + i, label: c.label || "", amount: c.amount ?? "", paidBy: c.paidBy || exp._defaultPayer || "Company" }))
});

const normaliseDeductions = (deductions = {}) => ({
  loanRecovery: deductions.loanRecovery ?? "",
  advanceRecovery: deductions.advanceRecovery ?? "",
  other: deductions.other ?? "",
});

export default function TripForm({ initial, locations = [], personnel = [], vehicles = [], brokers = [], onSave, onCancel }) {
  const { isDriver, isConductor, personnelId } = useAuth();
  const [form, setForm] = useState(() => {
    if (!initial) {
      const base = {
        ...EMPTY_FORM,
        lorry: vehicles.length > 0 ? vehicles[0].plate : "KBZ",
      };
      // Auto-assign logged-in driver/conductor to the correct field
      if (isDriver && personnelId) base.driverId = personnelId;
      if (isConductor && personnelId) base.conductorId = personnelId;
      return base;
    }
    return {
      ...initial,
      status: initial.status || "Pending",
      amountPaid: initial.amountPaid || "",
      driverId: initial.driverId || "",
      conductorId: initial.conductorId || "",
      brokerId: initial.brokerId || "",
      odometerStart: initial.odometerStart || "",
      odometerEnd: initial.odometerEnd || "",
      expenses: normaliseExpenses(initial.expenses),
      deductions: normaliseDeductions(initial.deductions)
    };
  });
  const [saving, setSaving] = useState(false);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFixed = (k, v) => setForm(f => ({ ...f, expenses: { ...f.expenses, [k]: v } }));
  const setPayer = (k, v) => setForm(f => ({ ...f, expenses: { ...f.expenses, _payers: { ...(f.expenses._payers || {}), [k]: v } } }));
  const setDefaultPayer = (v) => setForm(f => ({ ...f, expenses: { ...f.expenses, _defaultPayer: v } }));
  const setDeduction = (k, v) => setForm(f => ({ ...f, deductions: { ...f.deductions, [k]: v } }));

  // Keep driver/conductor locked if user has a linked profile
  useEffect(() => {
    if (!initial) {
      queueMicrotask(() => {
        if (isDriver && personnelId) setField("driverId", personnelId);
        if (isConductor && personnelId) setField("conductorId", personnelId);
      });
    }
  }, [isDriver, isConductor, personnelId, initial]);



  // New location inline state
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newParentLocation, setNewParentLocation] = useState("");
  const [newLocRev, setNewLocRev] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

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
      const fullLocationName = buildLocationName(newParentLocation, newLocName.trim());
      await locationService.add({
        name: fullLocationName,
        revenue: Number(newLocRev)
      });
      setField("location", fullLocationName);
      setField("revenue", Number(newLocRev));
      setShowInlineAdd(false);
      setNewLocName("");
      setNewParentLocation("");
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
        custom: [...(f.expenses.custom || []), { id: Date.now(), label: "", amount: "", paidBy: f.expenses._defaultPayer || "Company" }]
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

  const operatingExpenses = calcOperatingExpenses(form.expenses);
  const operatingProfit = calcProfit(form.revenue, operatingExpenses);
  const deductions = calcDeductions(form.deductions, form.expenses);
  const netPayable = operatingProfit - deductions;

  const handleSubmit = async () => {
    if (!form.date || !form.tripNumber || !form.location || !form.revenue) {
      alert("Date, trip number, location, and revenue are required."); return;
    }
    const badCustom = (form.expenses.custom || []).find(c => !c.label.trim() || c.amount === "");
    if (badCustom) {
      alert("Each custom expense needs both a name and an amount."); return;
    }
    const cleanCustom = (form.expenses.custom || []).map(({ label, amount, paidBy }) => ({
      label: label.trim(),
      amount: Number(amount),
      paidBy: paidBy || form.expenses._defaultPayer || "Company"
    }));
    const payload = {
      ...form,
      expenses: { ...form.expenses, custom: cleanCustom },
      deductions: {
        loanRecovery: Number(form.deductions?.loanRecovery || 0),
        advanceRecovery: Number(form.deductions?.advanceRecovery || 0),
        other: Number(form.deductions?.other || 0),
      }
    };
    setSaving(true);
    try { await onSave(payload); onCancel(); }
    catch (e) { alert("Error saving: " + e.message); }
    finally { setSaving(false); }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
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
          <input
            className={inp}
            placeholder="e.g. 001"
            value={form.tripNumber}
            onChange={e => setField("tripNumber", e.target.value)}
            onBlur={() => {
              const val = form.tripNumber;
              if (val && !isNaN(val)) {
                setField("tripNumber", String(val).padStart(3, "0"));
              }
            }}
          />
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
          <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Status *</label>
          <select className={inp} value={form.status} onChange={e => setField("status", e.target.value)}>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
          </select>
        </div>
        {form.status === "Partial" && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Paid (KES) *</label>
            <input type="number" className={inp} placeholder="0" value={form.amountPaid} onChange={e => setField("amountPaid", e.target.value)} />
          </div>
        )}

        {personnel.length > 0 && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Driver
                {isDriver && personnelId && <span className="ml-1 text-emerald-600 font-normal">(auto-filled)</span>}
              </label>
              <select
                className={`${inp} ${isDriver && personnelId ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`}
                value={form.driverId}
                onChange={e => setField("driverId", e.target.value)}
                disabled={!!(isDriver && personnelId)}
              >
                <option value="">— None —</option>
                {personnel.filter(p => ((p.status !== "Inactive" && (p.role === "Driver" || p.role === "Both")) || p.id === form.driverId)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Conductor
                {isConductor && personnelId && <span className="ml-1 text-emerald-600 font-normal">(auto-filled)</span>}
              </label>
              <select
                className={`${inp} ${isConductor && personnelId ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`}
                value={form.conductorId}
                onChange={e => setField("conductorId", e.target.value)}
                disabled={!!(isConductor && personnelId)}
              >
                <option value="">— None —</option>
                {personnel.filter(p => ((p.status !== "Inactive" && (p.role === "Conductor" || p.role === "Both")) || p.id === form.conductorId)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {brokers.length > 0 && (
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Broker</label>
            <select className={inp} value={form.brokerId} onChange={e => setField("brokerId", e.target.value)}>
              <option value="">— No Broker —</option>
              {brokers.filter(b => b.status === "Active" || b.id === form.brokerId).map(b => (
                <option key={b.id} value={b.id}>{b.name}{b.company ? ` (${b.company})` : ""}</option>
              ))}
            </select>
          </div>
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
            <div className="grid grid-cols-2 gap-3 mobile-form-grid">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Parent Location (optional)</label>
                <input
                  className={inp}
                  placeholder="e.g. Nairobi"
                  value={newParentLocation}
                  onChange={e => setNewParentLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Child Location Name *</label>
                <input
                  className={inp}
                  placeholder="e.g. Westlands"
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
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Operating Expenses</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Payer:</span>
            <select
              className="bg-slate-100 border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 outline-none rounded-lg cursor-pointer hover:bg-slate-200 transition-colors"
              value={form.expenses._defaultPayer || "Company"}
              onChange={e => setDefaultPayer(e.target.value)}
            >
              <option value="Company">🏢 Company</option>
              <option value="Broker">🤝 Broker</option>
              <option value="Driver">🚗 Driver</option>
              <option value="Conductor">🎟️ Conductor</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mobile-form-grid">
          {FIXED_EXPENSE_KEYS.map(k => (
            <div key={k}>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{EXPENSE_LABELS[k] || k}</label>
              <div className="flex items-center rounded-lg border border-slate-200 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 bg-white h-[38px] overflow-hidden">
                <input type="number" className="w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-300" placeholder="0"
                  value={form.expenses[k]}
                  onChange={e => setFixed(k, e.target.value)} />
                <PayerSelect value={form.expenses._payers?.[k] || form.expenses._defaultPayer || "Company"} onChange={v => setPayer(k, v)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Additional Operating Expenses</p>
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
              <div key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 mobile-custom-expense">
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
                <div className="h-[38px] border border-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                  <PayerSelect value={c.paidBy || form.expenses._defaultPayer || "Company"} onChange={v => updateCustomField(c.id, "paidBy", v)} />
                </div>
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

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Deductions</p>
        <div className="grid grid-cols-2 gap-3 mobile-form-grid">
          {DEDUCTION_KEYS.map(k => (
            <div key={k}>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{DEDUCTION_LABELS[k]}</label>
              <input type="number" className={inp} placeholder="0"
                value={form.deductions?.[k] ?? ""}
                onChange={e => setDeduction(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 space-y-2">
        {(form.expenses.custom || []).filter(c => c.label && c.amount !== "").map(c => (
          <div key={c.id} className="flex justify-between text-xs text-slate-400">
            <span className="capitalize">{c.label || "Unnamed"}</span>
            <span>{fmt(c.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Operating Expenses</span>
          <span className="font-bold text-rose-600">{fmt(operatingExpenses)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Revenue</span>
          <span className="font-bold text-blue-600">{fmt(form.revenue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Operating Profit</span>
          <span className={`font-bold ${operatingProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {fmt(operatingProfit)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Deductions</span>
          <span className="font-bold text-amber-600">{fmt(deductions)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Amount Paid</span>
          <span className="font-bold text-amber-600">{form.amountPaid !== "" ? fmt(form.amountPaid) : (form.revenue ? fmt(form.revenue) : "0")}</span>
        </div>
        <div className="border-t border-slate-200 pt-2 flex justify-between">
          <span className="font-bold text-slate-700">Net Payable</span>
          <span className={`text-lg font-black ${netPayable >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {fmt(netPayable)}
          </span>
        </div>
      </div>

      <div className="flex gap-3 pt-1 mobile-action-stack sm:flex-row">
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
