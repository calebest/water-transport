import { useState, useMemo } from "react";
import { Modal } from "./ui";
import { today, fmt, calcOperatingExpenses, calcProfit } from "../utils/helpers";

const createEmptyTripRow = (index, defaultLorry = "", defaultDate = today(), nextTripNum = 1) => ({
  id: `batch-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  date: defaultDate,
  lorry: defaultLorry,
  tripNumber: String(nextTripNum).padStart(3, "0"),
  location: "",
  revenue: "",
  status: "Pending",
  diesel: "",
  water: "",
  police: "",
  driverCost: "",
  repairs: "",
  notes: "",
});

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

  // Compute starting trip number for the selected vehicle & date
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

  // Apply default vehicle or date to all rows when changed
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
    if (rows.length <= 1) {
      alert("At least one trip row is required.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Live Summary Calculation
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let validCount = 0;

    rows.forEach((r) => {
      const rev = Number(r.revenue || 0);
      const exp =
        Number(r.diesel || 0) +
        Number(r.water || 0) +
        Number(r.police || 0) +
        Number(r.driverCost || 0) +
        Number(r.repairs || 0);

      if (r.location && rev > 0) validCount++;
      totalRevenue += rev;
      totalExpenses += exp;
    });

    const netProfit = totalRevenue - totalExpenses;
    return { totalRevenue, totalExpenses, netProfit, validCount };
  }, [rows]);

  const handleSubmit = async () => {
    // Validate rows
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
          driver: Number(r.driverCost || 0) || "",
          repairs: Number(r.repairs || 0) || "",
          petrol: "",
          custom: [],
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

  return (
    <Modal open={open} onClose={onClose} title="⚡ Batch Multi-Trip Entry" wide>
      <div className="space-y-5">
        {/* ─── Pinned Live Summary Tally ───────────────────────────────────── */}
        <div className="sticky -top-4 sm:-top-6 z-30 pt-1 pb-1 bg-white/95 backdrop-blur-md">
          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 p-3.5 sm:p-4 shadow-sm text-slate-800">
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
                <p className="mt-0.5 text-sm sm:text-base font-black font-mono text-sky-700 truncate">
                  {fmt(summary.totalRevenue)}
                </p>
              </div>
              <div className="rounded-xl bg-rose-50/80 border border-rose-100 p-2 sm:p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Total Expenses</p>
                <p className="mt-0.5 text-sm sm:text-base font-black font-mono text-rose-600 truncate">
                  {fmt(summary.totalExpenses)}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50/80 border border-emerald-100 p-2 sm:p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Net Profit</p>
                <p className={`mt-0.5 text-sm sm:text-base font-black font-mono truncate ${summary.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {fmt(summary.netProfit)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 border border-slate-200 p-2 sm:p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trip Count</p>
                <p className="mt-0.5 text-sm sm:text-base font-black font-mono text-slate-800 truncate">
                  {rows.length} Trips
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Batch Defaults Toolbar ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span>⚙️</span>
              <span>Common Trip Defaults (Auto-fill Rows)</span>
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Default Vehicle</label>
              <select
                value={commonLorry}
                onChange={(e) => setCommonLorry(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                {vehicles.map((v) => (
                  <option key={v.id || v.plate} value={v.plate}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Default Driver</label>
              <select
                value={commonDriverId}
                onChange={(e) => setCommonDriverId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="">— Optional —</option>
                {personnel
                  .filter((p) => p.role === "Driver" || p.role === "Both")
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Default Conductor</label>
              <select
                value={commonConductorId}
                onChange={(e) => setCommonConductorId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="">— Optional —</option>
                {personnel
                  .filter((p) => p.role === "Conductor" || p.role === "Both")
                  .map((p) => (
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

        {/* ─── Batch Trip Rows Table ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 w-16">Trip #</th>
                  <th className="py-2.5 px-3 w-28">Vehicle</th>
                  <th className="py-2.5 px-3">Destination Location *</th>
                  <th className="py-2.5 px-3 w-28">Revenue (KES) *</th>
                  <th className="py-2.5 px-3 w-24">Diesel</th>
                  <th className="py-2.5 px-3 w-20">Water</th>
                  <th className="py-2.5 px-3 w-20">Police</th>
                  <th className="py-2.5 px-3 w-24">Status</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Trip # */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.tripNumber}
                        onChange={(e) => handleRowChange(row.id, "tripNumber", e.target.value)}
                        className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-mono font-bold text-xs text-slate-800 text-center"
                      />
                    </td>

                    {/* Vehicle */}
                    <td className="py-2 px-3">
                      <select
                        value={row.lorry}
                        onChange={(e) => handleRowChange(row.id, "lorry", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-black text-xs text-slate-800"
                      >
                        {vehicles.map((v) => (
                          <option key={v.id || v.plate} value={v.plate}>
                            {v.plate}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Destination Location */}
                    <td className="py-2 px-3">
                      <select
                        value={row.location}
                        onChange={(e) => handleRowChange(row.id, "location", e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none"
                      >
                        <option value="">Select Destination...</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.name}>
                            {loc.name} — ({fmt(loc.revenue)})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Revenue */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        placeholder="0"
                        value={row.revenue}
                        onChange={(e) => handleRowChange(row.id, "revenue", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs text-slate-900 outline-none"
                      />
                    </td>

                    {/* Diesel */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        placeholder="0"
                        value={row.diesel}
                        onChange={(e) => handleRowChange(row.id, "diesel", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-700 outline-none"
                      />
                    </td>

                    {/* Water */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        placeholder="0"
                        value={row.water}
                        onChange={(e) => handleRowChange(row.id, "water", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-700 outline-none"
                      />
                    </td>

                    {/* Police */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        placeholder="0"
                        value={row.police}
                        onChange={(e) => handleRowChange(row.id, "police", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-700 outline-none"
                      />
                    </td>

                    {/* Status */}
                    <td className="py-2 px-3">
                      <select
                        value={row.status}
                        onChange={(e) => handleRowChange(row.id, "status", e.target.value)}
                        className={`w-full px-2 py-1.5 rounded-lg border text-[11px] font-bold ${
                          row.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </td>

                    {/* Remove Action */}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer"
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-800 text-xs font-bold transition-all cursor-pointer"
            >
              <span>+</span>
              <span>Add Another Trip Row</span>
            </button>
            <p className="text-[11px] text-slate-400">
              Tip: You can change the vehicle, trip number, and expenses independently on each row.
            </p>
          </div>
        </div>

        {/* ─── Bottom Actions ───────────────────────────────────────────────── */}
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
            <span>{saving ? `Saving ${rows.length} Trips…` : `Save All ${rows.length} Trips to Database`}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
