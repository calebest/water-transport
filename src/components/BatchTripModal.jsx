import { useState, useMemo } from "react";
import { Modal } from "./ui";
import { today, fmt, FIXED_EXPENSE_KEYS, EXPENSE_LABELS } from "../utils/helpers";

/* ─── Expense config ─────────────────────────────────────────────────────── */
const EXPENSE_ICONS = {
  diesel: "⛽", water: "💧", police: "👮",
  driver: "🚗", conductor: "🎟️", repairs: "🔧", petrol: "⛽",
};

/* ─── Empty row factory ──────────────────────────────────────────────────── */
const createEmptyTripRow = (index, defaultLorry = "", defaultDate = today(), nextTripNum = 1) => ({
  id: `batch-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  date: defaultDate,
  lorry: defaultLorry,
  tripNumber: String(nextTripNum).padStart(3, "0"),
  location: "",
  revenue: "",
  status: "Pending",
  diesel: "", water: "", police: "",
  driver: "", conductor: "", repairs: "", petrol: "",
  customExpenses: [],
  notes: "",
});

/* ─── Small input component ──────────────────────────────────────────────── */
const ExpenseInput = ({ icon, label, value, onChange, placeholder = "0" }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 truncate">
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </label>
    <input
      type="number"
      min="0"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs text-slate-700 outline-none focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100 transition-colors"
    />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function BatchTripModal({
  open = false,
  onClose,
  locations = [],
  vehicles = [],
  personnel = [],
  brokers = [],
  onSaveBatch,
  existingTrips = [],
}) {
  const defaultLorry = vehicles[0]?.plate || "";
  const [commonDate, setCommonDate] = useState(today());
  const [commonLorry, setCommonLorry] = useState(defaultLorry);
  const [commonDriverId, setCommonDriverId] = useState("");
  const [commonConductorId, setCommonConductorId] = useState("");
  const [commonBrokerId, setCommonBrokerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

  /* Compute starting trip number for the selected vehicle & date */
  const computeNextTripNum = (lorry, date, offset = 0) => {
    const matching = (existingTrips || []).filter(
      (t) => (t.lorry || "").toUpperCase() === (lorry || "").toUpperCase() && t.date === date
    );
    let maxNum = 0;
    matching.forEach((t) => {
      const n = parseInt(String(t.tripNumber || "0").replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });
    return maxNum + 1 + offset;
  };

  const [rows, setRows] = useState(() => [
    createEmptyTripRow(0, defaultLorry, today(), 1),
    createEmptyTripRow(1, defaultLorry, today(), 2),
    createEmptyTripRow(2, defaultLorry, today(), 3),
  ]);

  /* Toggle expense section visibility per card */
  const toggleExpand = (id) => setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));

  /* Apply default vehicle/date to all rows */
  const handleApplyDefaults = () => {
    setRows((prev) =>
      prev.map((r, i) => ({
        ...r,
        date: commonDate,
        lorry: commonLorry || r.lorry,
        tripNumber: String(computeNextTripNum(commonLorry, commonDate, i)).padStart(3, "0"),
      }))
    );
  };

  const handleRowChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "location") {
          const match = locations.find((l) => l.name === value);
          if (match && (!r.revenue || r.revenue === "0")) {
            updated.revenue = match.revenue;
          }
        }
        return updated;
      })
    );
  };

  /* Custom expense helpers */
  const handleAddCustomExpense = (rowId) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id !== rowId ? r : { ...r, customExpenses: [...r.customExpenses, { label: "", amount: "" }] }
      )
    );
  };

  const handleCustomExpenseChange = (rowId, idx, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const customs = [...r.customExpenses];
        customs[idx] = { ...customs[idx], [field]: value };
        return { ...r, customExpenses: customs };
      })
    );
  };

  const handleRemoveCustomExpense = (rowId, idx) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const customs = r.customExpenses.filter((_, i) => i !== idx);
        return { ...r, customExpenses: customs };
      })
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      createEmptyTripRow(
        prev.length,
        commonLorry || defaultLorry,
        commonDate,
        computeNextTripNum(commonLorry, commonDate, prev.length)
      ),
    ]);
  };

  const handleRemoveRow = (id) => {
    if (rows.length <= 1) return alert("At least one trip row is required.");
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  /* ─── Live summary ────────────────────────────────────────────────────── */
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let validCount = 0;

    rows.forEach((r) => {
      const rev = Number(r.revenue || 0);
      const exp =
        Number(r.diesel || 0) + Number(r.water || 0) + Number(r.police || 0) +
        Number(r.driver || 0) + Number(r.conductor || 0) + Number(r.repairs || 0) +
        Number(r.petrol || 0) +
        (r.customExpenses || []).reduce((s, c) => s + Number(c.amount || 0), 0);

      if (r.location && rev > 0) validCount++;
      totalRevenue += rev;
      totalExpenses += exp;
    });

    return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, validCount };
  }, [rows]);

  /* Row-level expense total helper */
  const rowExpenseTotal = (r) =>
    Number(r.diesel || 0) + Number(r.water || 0) + Number(r.police || 0) +
    Number(r.driver || 0) + Number(r.conductor || 0) + Number(r.repairs || 0) +
    Number(r.petrol || 0) +
    (r.customExpenses || []).reduce((s, c) => s + Number(c.amount || 0), 0);

  /* ─── Submit ──────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    const invalidRow = rows.find((r) => !r.location || !r.revenue || Number(r.revenue) <= 0);
    if (invalidRow) {
      alert(`Trip #${invalidRow.tripNumber || "N/A"} is missing destination location or revenue.`);
      return;
    }

    setSaving(true);
    try {
      const payloads = rows.map((r) => {
        const expenses = {
          diesel: Number(r.diesel || 0) || "",
          water: Number(r.water || 0) || "",
          police: Number(r.police || 0) || "",
          driver: Number(r.driver || 0) || "",
          conductor: Number(r.conductor || 0) || "",
          repairs: Number(r.repairs || 0) || "",
          petrol: Number(r.petrol || 0) || "",
          custom: (r.customExpenses || [])
            .filter((c) => c.label && Number(c.amount || 0) > 0)
            .map((c) => ({ label: c.label, amount: Number(c.amount), paidBy: "Company" })),
          _payers: {},
          _defaultPayer: "Company",
        };

        return {
          date: r.date || commonDate,
          lorry: r.lorry || commonLorry || defaultLorry,
          tripNumber: String(r.tripNumber || "001").padStart(3, "0"),
          location: r.location,
          revenue: Number(r.revenue),
          status: r.status || "Pending",
          amountPaid: r.status === "Paid" ? Number(r.revenue) : 0,
          driverId: commonDriverId || null,
          conductorId: commonConductorId || null,
          brokerId: commonBrokerId || null,
          expenses,
          deductions: { loanRecovery: 0, advanceRecovery: 0, other: 0 },
        };
      });

      await onSaveBatch(payloads);
      onClose();
    } catch (err) {
      alert("Error saving batch trips: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <Modal open={open} onClose={onClose} title="⚡ Batch Multi-Trip Entry" wide>
      <div className="space-y-5">

        {/* ─── Pinned Live Summary ──────────────────────────────────────── */}
        <div className="sticky -top-4 sm:-top-6 z-30 pt-1 pb-1 bg-white/95 backdrop-blur-md">
          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Batch Summary ({rows.length} Trips Queued)
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                {summary.validCount} of {rows.length} ready to save
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="rounded-xl bg-sky-50/80 border border-sky-100 p-2 sm:p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Batch Revenue</p>
                <p className="mt-0.5 text-sm sm:text-base font-black font-mono text-sky-700 truncate">{fmt(summary.totalRevenue)}</p>
              </div>
              <div className="rounded-xl bg-rose-50/80 border border-rose-100 p-2 sm:p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Total Expenses</p>
                <p className="mt-0.5 text-sm sm:text-base font-black font-mono text-rose-600 truncate">{fmt(summary.totalExpenses)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50/80 border border-emerald-100 p-2 sm:p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Net Profit</p>
                <p className={`mt-0.5 text-sm sm:text-base font-black font-mono truncate ${summary.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmt(summary.netProfit)}</p>
              </div>
              <div className="rounded-xl bg-slate-100 border border-slate-200 p-2 sm:p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trip Count</p>
                <p className="mt-0.5 text-sm sm:text-base font-black font-mono text-slate-800 truncate">{rows.length} Trips</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Defaults Toolbar ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span>⚙️</span>
              <span>Shared Defaults (Auto-fill Rows)</span>
            </h4>
            <button
              type="button"
              onClick={handleApplyDefaults}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Apply to All Rows
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={commonDate}
                onChange={(e) => setCommonDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Vehicle</label>
              <select
                value={commonLorry}
                onChange={(e) => setCommonLorry(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                {vehicles.map((v) => (
                  <option key={v.id || v.plate} value={v.plate}>{v.plate}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Driver</label>
              <select
                value={commonDriverId}
                onChange={(e) => setCommonDriverId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="">— Optional —</option>
                {personnel.filter((p) => p.role === "Driver" || p.role === "Both").map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Conductor</label>
              <select
                value={commonConductorId}
                onChange={(e) => setCommonConductorId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="">— Optional —</option>
                {personnel.filter((p) => p.role === "Conductor" || p.role === "Both").map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Broker</label>
              <select
                value={commonBrokerId}
                onChange={(e) => setCommonBrokerId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="">— No Broker —</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ─── Trip Cards ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {rows.map((row, idx) => {
            const expTotal = rowExpenseTotal(row);
            const rev = Number(row.revenue || 0);
            const profit = rev - expTotal;
            const isExpanded = expandedCards[row.id] ?? true;

            return (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* ── Card Header ── */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-black">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-500 truncate">
                      Trip {idx + 1} of {rows.length}
                    </span>
                    {row.location && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-[10px] font-bold text-sky-700 truncate max-w-[180px]">
                        📍 {row.location}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Mini profit indicator */}
                    {rev > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                        {profit >= 0 ? "+" : ""}{fmt(profit)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpand(row.id)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
                      title={isExpanded ? "Collapse expenses" : "Expand expenses"}
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer text-sm"
                      title="Remove trip"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* ── Core Trip Details ── */}
                <div className="px-4 pt-4 pb-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {/* Trip # */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trip #</label>
                      <input
                        type="text"
                        value={row.tripNumber}
                        onChange={(e) => handleRowChange(row.id, "tripNumber", e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-xs text-slate-800 text-center outline-none focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100"
                      />
                    </div>

                    {/* Vehicle */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vehicle</label>
                      <select
                        value={row.lorry}
                        onChange={(e) => handleRowChange(row.id, "lorry", e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-mono font-black text-xs text-slate-800 outline-none cursor-pointer focus:border-emerald-300"
                      >
                        {vehicles.map((v) => (
                          <option key={v.id || v.plate} value={v.plate}>{v.plate}</option>
                        ))}
                      </select>
                    </div>

                    {/* Destination */}
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination *</label>
                      <select
                        value={row.location}
                        onChange={(e) => handleRowChange(row.id, "location", e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none cursor-pointer focus:border-emerald-300"
                      >
                        <option value="">Select...</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.name}>{loc.name} — {fmt(loc.revenue)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Revenue */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Revenue *</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={row.revenue}
                        onChange={(e) => handleRowChange(row.id, "revenue", e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-sky-200 bg-sky-50/40 font-mono font-bold text-xs text-sky-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                      />
                    </div>

                    {/* Status */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                      <select
                        value={row.status}
                        onChange={(e) => handleRowChange(row.id, "status", e.target.value)}
                        className={`w-full px-2.5 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                          row.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Expenses Section (collapsible) ── */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <span>💰</span>
                          <span>Operating Expenses</span>
                        </h5>
                        {expTotal > 0 && (
                          <span className="text-[10px] font-bold text-rose-500">Total: {fmt(expTotal)}</span>
                        )}
                      </div>

                      {/* Fixed expense grid — 4 columns on desktop, 2 on mobile */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <ExpenseInput icon="⛽" label="Diesel" value={row.diesel}
                          onChange={(e) => handleRowChange(row.id, "diesel", e.target.value)} />
                        <ExpenseInput icon="💧" label="Water" value={row.water}
                          onChange={(e) => handleRowChange(row.id, "water", e.target.value)} />
                        <ExpenseInput icon="👮" label="Police" value={row.police}
                          onChange={(e) => handleRowChange(row.id, "police", e.target.value)} />
                        <ExpenseInput icon="🚗" label="Driver" value={row.driver}
                          onChange={(e) => handleRowChange(row.id, "driver", e.target.value)} />
                        <ExpenseInput icon="🎟️" label="Conductor" value={row.conductor}
                          onChange={(e) => handleRowChange(row.id, "conductor", e.target.value)} />
                        <ExpenseInput icon="🔧" label="Repairs" value={row.repairs}
                          onChange={(e) => handleRowChange(row.id, "repairs", e.target.value)} />
                        <ExpenseInput icon="⛽" label="Petrol" value={row.petrol}
                          onChange={(e) => handleRowChange(row.id, "petrol", e.target.value)} />
                      </div>

                      {/* Custom expenses */}
                      {row.customExpenses.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Custom Expenses</p>
                          {row.customExpenses.map((ce, ci) => (
                            <div key={ci} className="flex items-end gap-2">
                              <div className="flex-1 flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-400">Label</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Toll, Parking..."
                                  value={ce.label}
                                  onChange={(e) => handleCustomExpenseChange(row.id, ci, "label", e.target.value)}
                                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-emerald-300"
                                />
                              </div>
                              <div className="w-28 flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-400">Amount</label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={ce.amount}
                                  onChange={(e) => handleCustomExpenseChange(row.id, ci, "amount", e.target.value)}
                                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs text-slate-700 outline-none focus:border-emerald-300"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomExpense(row.id, ci)}
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors mb-0.5"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleAddCustomExpense(row.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-emerald-300 text-[11px] font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all cursor-pointer"
                      >
                        <span>+</span>
                        <span>Add Custom Expense</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Add Row ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-1">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-800 text-xs font-bold transition-all cursor-pointer"
          >
            <span>+</span>
            <span>Add Another Trip</span>
          </button>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Tip: Click ▲ on any card to collapse its expenses section.
          </p>
        </div>

        {/* ─── Bottom Actions ──────────────────────────────────────────── */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || rows.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{saving ? "⏳" : "✓"}</span>
            <span>{saving ? `Saving ${rows.length} Trips…` : `Save All ${rows.length} Trips`}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
