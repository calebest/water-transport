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

const EXPENSE_ICONS = {
  diesel: "⛽",
  water: "💧",
  police: "👮",
  driver: "🚗",
  conductor: "🎟️",
  repairs: "🔧",
  petrol: "⛽",
};

const PayerSelect = ({ value, onChange }) => (
  <select
    className="h-full bg-slate-50 border-l border-slate-200 px-2 py-2 text-xs font-bold text-slate-600 outline-none rounded-r-xl cursor-pointer hover:bg-slate-100 transition-colors shrink-0"
    value={value || "Company"}
    onChange={e => onChange(e.target.value)}
    title="Who pays this expense?"
  >
    <option value="Company">🏢 Company</option>
    <option value="Broker">🤝 Broker</option>
    <option value="Driver">🚗 Driver</option>
    <option value="Conductor">🎟️ Conductor</option>
  </select>
);

const EMPTY_FORM = {
  date: today(),
  lorry: "KBZ",
  tripNumber: "",
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
    water: "",
    diesel: "",
    petrol: "",
    police: "",
    driver: "",
    conductor: "",
    repairs: "",
    custom: [],
    _payers: {},
    _defaultPayer: "Company",
  },
  deductions: {
    loanRecovery: "",
    advanceRecovery: "",
    other: "",
  },
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
  custom: (exp.custom || []).map((c, i) => ({
    id: c.id || Date.now() + i,
    label: c.label || "",
    amount: c.amount ?? "",
    paidBy: c.paidBy || exp._defaultPayer || "Company",
  })),
});

const normaliseDeductions = (deductions = {}) => ({
  loanRecovery: deductions.loanRecovery ?? "",
  advanceRecovery: deductions.advanceRecovery ?? "",
  other: deductions.other ?? "",
});

export default function TripForm({
  initial,
  locations = [],
  personnel = [],
  vehicles = [],
  brokers = [],
  onSave,
  onCancel,
}) {
  const { isDriver, isConductor, personnelId } = useAuth();
  const [form, setForm] = useState(() => {
    if (!initial) {
      const base = {
        ...EMPTY_FORM,
        lorry: vehicles.length > 0 ? vehicles[0].plate : "KBZ",
      };
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
      deductions: normaliseDeductions(initial.deductions),
    };
  });

  const [saving, setSaving] = useState(false);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFixed = (k, v) => setForm(f => ({ ...f, expenses: { ...f.expenses, [k]: v } }));
  const setPayer = (k, v) =>
    setForm(f => ({ ...f, expenses: { ...f.expenses, _payers: { ...(f.expenses._payers || {}), [k]: v } } }));
  const setDefaultPayer = v => setForm(f => ({ ...f, expenses: { ...f.expenses, _defaultPayer: v } }));
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

  // Inline location creation
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newParentLocation, setNewParentLocation] = useState("");
  const [newLocRev, setNewLocRev] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

  const handleLocationChange = e => {
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
        revenue: Number(newLocRev),
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
        custom: [
          ...(f.expenses.custom || []),
          { id: Date.now(), label: "", amount: "", paidBy: f.expenses._defaultPayer || "Company" },
        ],
      },
    }));
  };

  const updateCustomField = (id, key, value) => {
    setForm(f => ({
      ...f,
      expenses: {
        ...f.expenses,
        custom: f.expenses.custom.map(c => (c.id === id ? { ...c, [key]: value } : c)),
      },
    }));
  };

  const removeCustomField = id => {
    setForm(f => ({
      ...f,
      expenses: {
        ...f.expenses,
        custom: f.expenses.custom.filter(c => c.id !== id),
      },
    }));
  };

  const operatingExpenses = calcOperatingExpenses(form.expenses);
  const operatingProfit = calcProfit(form.revenue, operatingExpenses);
  const deductions = calcDeductions(form.deductions, form.expenses);
  const netPayable = operatingProfit - deductions;

  // Calculated distance if both odometers are provided
  const odoDistance =
    form.odometerStart !== "" && form.odometerEnd !== "" && Number(form.odometerEnd) >= Number(form.odometerStart)
      ? Number(form.odometerEnd) - Number(form.odometerStart)
      : null;

  const handleSubmit = async () => {
    if (!form.date || !form.tripNumber || !form.location || !form.revenue) {
      alert("Date, trip number, location, and revenue are required.");
      return;
    }
    const badCustom = (form.expenses.custom || []).find(c => !c.label.trim() || c.amount === "");
    if (badCustom) {
      alert("Each custom expense needs both a name and an amount.");
      return;
    }
    const cleanCustom = (form.expenses.custom || []).map(({ label, amount, paidBy }) => ({
      label: label.trim(),
      amount: Number(amount),
      paidBy: paidBy || form.expenses._defaultPayer || "Company",
    }));
    const payload = {
      ...form,
      expenses: { ...form.expenses, custom: cleanCustom },
      deductions: {
        loanRecovery: Number(form.deductions?.loanRecovery || 0),
        advanceRecovery: Number(form.deductions?.advanceRecovery || 0),
        other: Number(form.deductions?.other || 0),
      },
    };
    setSaving(true);
    try {
      await onSave(payload);
      onCancel();
    } catch (e) {
      alert("Error saving: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle =
    "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all";

  return (
    <div className="space-y-6">
      {/* ─── Real-Time Live Financial HUD Banner ────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-5 text-white shadow-md">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-300">Live Financial Preview</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">Revenue - Expenses = Profit</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-xl bg-white/10 p-2.5 sm:p-3 backdrop-blur-xs border border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Revenue</p>
            <p className="mt-1 text-sm sm:text-base md:text-lg font-black font-mono text-sky-300 truncate">
              {fmt(form.revenue || 0)}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5 sm:p-3 backdrop-blur-xs border border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Expenses</p>
            <p className="mt-1 text-sm sm:text-base md:text-lg font-black font-mono text-rose-300 truncate">
              {fmt(operatingExpenses)}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5 sm:p-3 backdrop-blur-xs border border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operating Profit</p>
            <p className={`mt-1 text-sm sm:text-base md:text-lg font-black font-mono truncate ${operatingProfit >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
              {fmt(operatingProfit)}
            </p>
          </div>
          <div className={`rounded-xl p-2.5 sm:p-3 border ${netPayable >= 0 ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200" : "bg-rose-500/20 border-rose-400/40 text-rose-200"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Net Payable</p>
            <p className="mt-1 text-sm sm:text-base md:text-lg font-black font-mono truncate">
              {fmt(netPayable)}
            </p>
          </div>
        </div>
      </div>

      {/* ─── 1. Trip Identity & Schedule ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-black">1</span>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Trip Identity & Vehicle</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Date with Today Shortcut */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date *</label>
              <button
                type="button"
                onClick={() => setField("date", today())}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
              >
                Set Today
              </button>
            </div>
            <input
              type="date"
              className={inputStyle}
              value={form.date}
              onChange={e => setField("date", e.target.value)}
            />
          </div>

          {/* Lorry Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Vehicle *</label>
            <div className="flex items-center gap-2">
              {(vehicles.length > 0 ? vehicles : [{ id: 1, plate: "KBZ" }, { id: 2, plate: "KBL" }]).map(v => (
                <button
                  key={v.id || v.plate}
                  type="button"
                  onClick={() => setField("lorry", v.plate)}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    form.lorry === v.plate
                      ? v.plate === "KBZ"
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  🚛 {v.plate}
                </button>
              ))}
            </div>
          </div>

          {/* Trip Number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Trip # *</label>
            <input
              className={`${inputStyle} font-mono`}
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
        </div>
      </div>

      {/* ─── 2. Destination & Revenue ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-black">2</span>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Route & Commercials</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Location Dropdown */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Destination Location *</label>
            <select
              className={`${inputStyle} cursor-pointer`}
              value={showInlineAdd ? "ADD_NEW" : form.location || ""}
              onChange={handleLocationChange}
            >
              <option value="">Select Destination Location...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>
                  {loc.name} — ({fmt(loc.revenue)})
                </option>
              ))}
              <option value="ADD_NEW">+ Add New Location...</option>
            </select>
          </div>

          {/* Revenue */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Revenue (KES) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">KES</span>
              <input
                type="number"
                className={`${inputStyle} pl-12 font-mono font-bold text-slate-800`}
                placeholder="0"
                value={form.revenue}
                onChange={e => setField("revenue", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Inline Add New Location Panel */}
        {showInlineAdd && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-emerald-900 uppercase tracking-widest">New Location Registration</p>
              <button
                type="button"
                onClick={() => setShowInlineAdd(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕ Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Parent Area (optional)</label>
                <input
                  className={inputStyle}
                  placeholder="e.g. Nanyuki"
                  value={newParentLocation}
                  onChange={e => setNewParentLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Specific Location *</label>
                <input
                  className={inputStyle}
                  placeholder="e.g. Kangaita Station"
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Standard Rate (KES) *</label>
                <input
                  type="number"
                  className={inputStyle}
                  placeholder="e.g. 15000"
                  value={newLocRev}
                  onChange={e => setNewLocRev(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowInlineAdd(false)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateInlineLocation}
                disabled={inlineSaving}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {inlineSaving ? "Saving..." : "Create & Select"}
              </button>
            </div>
          </div>
        )}

        {/* Payment Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment Status</label>
            <div className="grid grid-cols-3 gap-2">
              {["Pending", "Partial", "Paid"].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setField("status", st)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    form.status === st
                      ? st === "Paid"
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                        : st === "Partial"
                        ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                        : "bg-rose-500 text-white border-rose-500 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {form.status === "Partial" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Amount Paid (KES) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">KES</span>
                <input
                  type="number"
                  className={`${inputStyle} pl-12 font-mono font-bold text-slate-800`}
                  placeholder="0"
                  value={form.amountPaid}
                  onChange={e => setField("amountPaid", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. Operating Expenses ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-black">3</span>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Operating Expenses</h3>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Payer:</span>
            <select
              className="bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors outline-none"
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

        {/* Fixed Expenses Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FIXED_EXPENSE_KEYS.map(k => (
            <div key={k} className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <span>{EXPENSE_ICONS[k] || "💰"}</span>
                  <span>{EXPENSE_LABELS[k] || k}</span>
                </label>
              </div>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 h-[38px] overflow-hidden transition-all">
                <span className="px-2.5 text-[11px] font-bold text-slate-400 select-none">KES</span>
                <input
                  type="number"
                  className="w-full bg-transparent pr-2 py-1.5 text-sm font-mono font-bold text-slate-800 outline-none placeholder:text-slate-300 min-w-0"
                  placeholder="0"
                  value={form.expenses[k]}
                  onChange={e => setFixed(k, e.target.value)}
                />
                <PayerSelect
                  value={form.expenses._payers?.[k] || form.expenses._defaultPayer || "Company"}
                  onChange={v => setPayer(k, v)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Additional / Custom Operating Expenses */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Additional Expenses</p>
              <p className="text-[11px] text-slate-400 font-medium">Any ad-hoc charges (tyres, permits, repair, tolls)</p>
            </div>
            <button
              type="button"
              onClick={addCustomField}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <span>+</span>
              <span>Add Custom Expense</span>
            </button>
          </div>

          {(form.expenses.custom || []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              No extra expenses. Click <span className="text-emerald-600 font-bold">+ Add Custom Expense</span> if needed.
            </div>
          ) : (
            <div className="space-y-2">
              {form.expenses.custom.map(c => (
                <div key={c.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none placeholder:text-slate-400"
                    placeholder="Expense name (e.g. Tire Puncture, Toll)"
                    value={c.label}
                    onChange={e => updateCustomField(c.id, "label", e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">KES</span>
                      <input
                        type="number"
                        className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-2 py-2 text-sm font-mono font-bold text-slate-800 focus:border-emerald-500 focus:outline-none placeholder:text-slate-300"
                        placeholder="0"
                        value={c.amount}
                        onChange={e => updateCustomField(c.id, "amount", e.target.value)}
                      />
                    </div>
                    <div className="h-[38px] border border-slate-200 rounded-lg overflow-hidden shrink-0">
                      <PayerSelect
                        value={c.paidBy || form.expenses._defaultPayer || "Company"}
                        onChange={v => updateCustomField(c.id, "paidBy", v)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomField(c.id)}
                      className="h-9 w-9 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors flex items-center justify-center font-bold text-sm shrink-0 cursor-pointer"
                      title="Remove expense"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── 4. Deductions ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-black">4</span>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Deductions</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {DEDUCTION_KEYS.map(k => (
            <div key={k}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{DEDUCTION_LABELS[k]}</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">KES</span>
                <input
                  type="number"
                  className={`${inputStyle} pl-12 font-mono font-bold text-slate-800`}
                  placeholder="0"
                  value={form.deductions?.[k] ?? ""}
                  onChange={e => setDeduction(k, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 5. Crew & Vehicle Logistics (Optional) ─────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-black">5</span>
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Crew & Logistics (Optional)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Driver */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Driver
              {isDriver && personnelId && <span className="ml-1 text-emerald-600 font-semibold">(auto-locked)</span>}
            </label>
            <select
              className={`${inputStyle} ${isDriver && personnelId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "cursor-pointer"}`}
              value={form.driverId}
              onChange={e => setField("driverId", e.target.value)}
              disabled={!!(isDriver && personnelId)}
            >
              <option value="">— Unassigned —</option>
              {personnel
                .filter(p => (p.status !== "Inactive" && (p.role === "Driver" || p.role === "Both")) || p.id === form.driverId)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          {/* Conductor */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Conductor
              {isConductor && personnelId && <span className="ml-1 text-emerald-600 font-semibold">(auto-locked)</span>}
            </label>
            <select
              className={`${inputStyle} ${isConductor && personnelId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "cursor-pointer"}`}
              value={form.conductorId}
              onChange={e => setField("conductorId", e.target.value)}
              disabled={!!(isConductor && personnelId)}
            >
              <option value="">— Unassigned —</option>
              {personnel
                .filter(p => (p.status !== "Inactive" && (p.role === "Conductor" || p.role === "Both")) || p.id === form.conductorId)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          {/* Broker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Broker</label>
            <select
              className={`${inputStyle} cursor-pointer`}
              value={form.brokerId}
              onChange={e => setField("brokerId", e.target.value)}
            >
              <option value="">— No Broker —</option>
              {brokers
                .filter(b => b.status === "Active" || b.id === form.brokerId)
                .map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.company ? ` (${b.company})` : ""}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Odometers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Odometer Start (km)</label>
            <input
              type="number"
              className={inputStyle}
              placeholder="e.g. 104200"
              value={form.odometerStart}
              onChange={e => setField("odometerStart", e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Odometer End (km)</label>
              {odoDistance !== null && (
                <span className="text-xs font-bold text-emerald-600">
                  {odoDistance} km covered
                </span>
              )}
            </div>
            <input
              type="number"
              className={inputStyle}
              placeholder="e.g. 104380"
              value={form.odometerEnd}
              onChange={e => setField("odometerEnd", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ─── Bottom Actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-60 transition-all cursor-pointer"
        >
          {saving ? "Saving Trip Record…" : "Save Trip Record"}
        </button>
      </div>
    </div>
  );
}