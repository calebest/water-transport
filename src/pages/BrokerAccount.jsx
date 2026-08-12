import React, { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today, getWeekRange, getMonthRange } from "../utils/helpers";
import { generateBrokerStatement } from "../utils/pdfGenerator";
import { Modal, StatCard, Badge } from "../components/ui";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const METHOD_ICON = { Cash: "💵", "M-Pesa": "📱", "Bank Transfer": "🏦", Adjustment: "⚖️" };

const parseMethod = (notes = "") => {
  if (notes.includes("M-Pesa")) return "M-Pesa";
  if (notes.includes("Bank")) return "Bank Transfer";
  return "Cash";
};

const isWithinPeriod = (dateStr, period, customStart, customEnd) => {
  if (period === "all" || !dateStr) return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "today") return d.toDateString() === now.toDateString();
  if (period === "week") {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); start.setHours(0,0,0,0);
    return d >= start;
  }
  if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (period === "year") return d.getFullYear() === now.getFullYear();
  if (period === "custom" && customStart && customEnd)
    return d >= new Date(customStart) && d <= new Date(customEnd + "T23:59:59");
  return true;
};

// ─── Record Transaction Modal ──────────────────────────────────────────────
function BrokerTransactionModal({ open, onClose, broker, activeLorry, onSuccess, vehicles = [], brokerTrips = [] }) {
  const [direction, setDirection] = useState("IN");
  const [txType, setTxType] = useState("direct_credit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [linkedTripId, setLinkedTripId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelectedVehicle(activeLorry !== "all" ? activeLorry : "");
  }, [activeLorry, open]);

  const handleDirection = (dir) => {
    setDirection(dir);
    setTxType(dir === "IN" ? "settlement" : "expense");
  };

  const reset = () => {
    setAmount(""); setNotes(""); setCategory(""); setLinkedTripId("");
    setDate(today()); setDirection("IN"); setTxType("settlement"); setMethod("Cash");
    setSelectedVehicle(activeLorry !== "all" ? activeLorry : "");
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return alert("Enter a valid amount.");
    setSaving(true);
    try {
      const lorry = selectedVehicle || null;
      if (txType === "settlement") {
        await financeService.makeBrokerSettlement(broker.id, amount, { date, method, notes, lorry });
      } else if (txType === "adjustment") {
        await financeService.makeBrokerSettlement(broker.id, amount, {
          date, method: "Adjustment", notes, entryType: "write_off", lorry,
        });
      } else {
        const typeMap = { direct_credit: "remittance", expense: "expense_paid" };
        await financeService.addDirectBrokerEntry(broker.id, {
          date, type: typeMap[txType] || "remittance", amount, notes, lorry,
          trip_id: linkedTripId || null,
          category: category || null,
        });
      }
      reset(); onSuccess?.(); onClose();
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-100 transition-all";

  const typeOptions = direction === "IN"
    ? [
        { id: "settlement", label: "🏦 Settlement", desc: "Auto-distributes across oldest unpaid trips (FIFO)" },
        { id: "direct_credit", label: "💵 Direct Credit", desc: "Manual credit — no trip distribution" },
      ]
    : [
        { id: "expense", label: "📉 Broker Expense", desc: "Expense paid by the broker (can link to a trip)" },
        { id: "adjustment", label: "⚖️ Adjustment / Write-Off", desc: "FIFO write-off against oldest unpaid trips" },
      ];

  const linkableTrips = brokerTrips.filter(t =>
    t.approvalStatus === "approved" && (!selectedVehicle || t.lorry === selectedVehicle)
  );

  const quickCategories = direction === "IN"
    ? ["Commission", "Advance Return", "Loan Repayment", "Other Income"]
    : ["Fuel / Diesel", "Toll Charges", "Driver Allowance", "Loading Fee", "Weighbridge", "Repairs", "Other Expense"];

  const showLinkTrip = txType === "expense" || txType === "direct_credit";
  const showCategory = txType === "expense" || txType === "direct_credit";
  const showMethod = txType === "settlement" || txType === "direct_credit";

  // Unique vehicle plates from broker's trips
  const vehiclePlates = [...new Set(brokerTrips.map(t => t.lorry).filter(Boolean))].sort();

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="">
      <div className="-mx-5 -mt-5 mb-5 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 px-6 pt-6 pb-5 rounded-t-2xl">
        <h2 className="text-xl font-black text-white">Record Transaction</h2>
        <p className="text-emerald-200 text-sm mt-0.5">{broker?.name}{activeLorry !== "all" ? ` · ${activeLorry}` : ""}</p>
      </div>

      <div className="space-y-5">
        {/* IN / OUT */}
        <div className="flex gap-2">
          {[["IN", "↓ Money IN"], ["OUT", "↑ Money OUT"]].map(([dir, label]) => (
            <button key={dir} type="button" onClick={() => handleDirection(dir)}
              className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all border-2 ${
                direction === dir
                  ? dir === "IN" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200/60"
                                 : "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200/60"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
              }`}
            >{label}</button>
          ))}
        </div>

        {/* Type */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Type</p>
          {typeOptions.map(opt => (
            <button key={opt.id} type="button" onClick={() => setTxType(opt.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                txType === opt.id
                  ? direction === "IN" ? "border-emerald-400 bg-emerald-50" : "border-rose-400 bg-rose-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className={`text-sm font-bold ${txType === opt.id ? (direction === "IN" ? "text-emerald-700" : "text-rose-700") : "text-slate-700"}`}>{opt.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* Date + Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date</p>
            <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Amount (KES)</p>
            <input type="number" min="1" className={inp} placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>

        {/* Vehicle */}
        {vehiclePlates.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Vehicle</p>
            <select className={inp} value={selectedVehicle} onChange={e => { setSelectedVehicle(e.target.value); setLinkedTripId(""); }}>
              <option value="">— All Vehicles —</option>
              {vehiclePlates.map(plate => <option key={plate} value={plate}>{plate}</option>)}
            </select>
          </div>
        )}

        {/* Category */}
        {showCategory && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Category</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickCategories.map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(prev => prev === cat ? "" : cat)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    category === cat
                      ? direction === "IN" ? "bg-emerald-100 border-emerald-400 text-emerald-700" : "bg-rose-100 border-rose-400 text-rose-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >{cat}</button>
              ))}
            </div>
            <input type="text" className={inp} placeholder="Or type a custom category…"
              value={category} onChange={e => setCategory(e.target.value)} />
          </div>
        )}

        {/* Link to Trip */}
        {showLinkTrip && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Link to Trip <span className="normal-case font-normal">(optional)</span>
            </p>
            <select className={inp} value={linkedTripId} onChange={e => setLinkedTripId(e.target.value)}>
              <option value="">— No specific trip —</option>
              {linkableTrips.map(t => (
                <option key={t.id} value={t.id}>
                  {t.lorry ? `[${t.lorry}] ` : ""}{t.date} — {t.location || `Trip ${t.tripNumber || t.id.slice(0, 6)}`}
                </option>
              ))}
            </select>
            {linkableTrips.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-1.5">No approved trips found{selectedVehicle ? ` for ${selectedVehicle}` : ""}.</p>
            )}
          </div>
        )}

        {/* Method */}
        {showMethod && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payment Method</p>
            <div className="flex gap-2">
              {["Cash", "M-Pesa", "Bank Transfer"].map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    method === m ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >{METHOD_ICON[m]} {m}</button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notes</p>
          <textarea className={inp} rows="2" placeholder="Any additional details…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* FIFO warning */}
        {(txType === "settlement" || txType === "adjustment") && amount && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            <strong>Auto-distribution:</strong> KES {Number(amount).toLocaleString()} will be applied to the oldest unpaid trips for <strong>{broker?.name}</strong>{selectedVehicle ? ` (${selectedVehicle})` : ""} (FIFO).
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => { reset(); onClose(); }} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || !amount}
            className={`flex-1 rounded-xl py-2.5 text-sm font-black text-white disabled:opacity-50 transition-all ${
              direction === "IN" ? "bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
                                 : "bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-500/20"
            }`}
          >{saving ? "Saving…" : direction === "IN" ? "Record Payment" : "Record Deduction"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Entry Detail Panel ───────────────────────────────────────────────────────
function EntryDetailPanel({ entry, onClose, onUndo }) {
  if (!entry) return null;
  const method = parseMethod(entry.notes || "");
  const isIn = entry.type === "revenue";
  const isPayment = entry.type === "remittance";
  const isWriteOff = entry.type === "write_off";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="w-full max-w-sm bg-white shadow-2xl border-l border-slate-100 flex flex-col"
        style={{ animation: "slideInRight 0.2s ease-out" }}
      >
        <style>{`@keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }`}</style>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-black text-slate-800">Entry Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">{entry.date}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Type</p>
            <Badge color={isIn ? "blue" : isPayment ? "green" : isWriteOff ? "slate" : "amber"}>
              {isIn ? "Trip Revenue" : isPayment ? "Settlement / Payment" : isWriteOff ? "Adjustment" : "Broker Expense"}
            </Badge>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Amount</p>
            <p className={`text-3xl font-black ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
              {isIn ? "+" : "−"} {fmt(entry.amount)}
            </p>
          </div>

          {(isPayment || isWriteOff) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Method</p>
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <span className="text-xl">{METHOD_ICON[method] || "💵"}</span>
                <span>{method}</span>
              </div>
            </div>
          )}

          {entry.trips?.location && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Location</p>
              <p className="text-slate-700 font-semibold">📍 {entry.trips.location}</p>
            </div>
          )}

          {entry.trips?.trip_number && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Trip Reference</p>
              <p className="text-slate-700 font-semibold">Trip #{entry.trips.trip_number}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Notes</p>
            <p className="text-slate-700 bg-slate-50 rounded-xl p-3.5 text-sm leading-relaxed border border-slate-100">{entry.notes || "No notes."}</p>
          </div>

          {entry.runningBalance !== undefined && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Running Balance</p>
              <p className={`text-xl font-black ${entry.runningBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(entry.runningBalance)}</p>
            </div>
          )}

          {entry.statement_id && (
            <div className="rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-xs text-slate-600">
              📂 This entry belongs to a <strong>closed period</strong>.
            </div>
          )}

          {(isPayment || isWriteOff) && entry.settlement_id && (
            <button
              onClick={() => { onClose(); onUndo(entry.settlement_id); }}
              className="w-full rounded-xl border-2 border-rose-200 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              Undo / Delete this Settlement
            </button>
          )}
        </div>
      </div>
      <div className="absolute inset-0 -z-10 bg-black/20 backdrop-blur-sm" onClick={onClose} />
    </div>
  );
}

// ─── Broker Statement Modal ────────────────────────────────────────────────
function BrokerStatementModal({ open, onClose, broker, availableLorries, currentLorry, ledger }) {
  const [period, setPeriod] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [vehicle, setVehicle] = useState(currentLorry || "all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [options, setOptions] = useState({
    includeTripDetails: true,
    includeIndividualExpenses: true,
    includeRemittances: true,
    includeReconciliation: true,
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // 1. Filter ledger exactly like the UI does, but based on modal inputs
    let filtered = ledger.filter(e => !e.statement_id);
    if (vehicle !== "all") {
      filtered = filtered.filter(e => (e.lorry || e.trips?.lorry) === vehicle);
    }
    filtered = filtered.filter(e => {
      let dStart = "", dEnd = "";
      if (period === "today") { dStart = today(); dEnd = today(); }
      else if (period === "week") { const r = getWeekRange(); dStart = r[0]; dEnd = r[1]; }
      else if (period === "month") { const r = getMonthRange(); dStart = r[0]; dEnd = r[1]; }
      else if (period === "custom") { dStart = customStart; dEnd = customEnd; }
      
      if (dStart && e.date < dStart) return false;
      if (dEnd && e.date > dEnd) return false;
      return true;
    });

    if (filtered.length === 0) {
      alert("No transactions found for the selected period/vehicle.");
      setIsGenerating(false);
      return;
    }

    // 2. Run the same grouping logic as the UI
    let runningCb = 0;
    // For the PDF, Opening Balance is the running balance BEFORE the first transaction in the filtered set.
    // To get this, we calculate the balance of all transactions BEFORE the start date.
    let dStart = "";
    if (period === "today") dStart = today();
    else if (period === "week") dStart = getWeekRange()[0];
    else if (period === "month") dStart = getMonthRange()[0];
    else if (period === "custom") dStart = customStart;

    let openingBalance = 0;
    if (dStart) {
      const beforeLedger = ledger.filter(e => !e.statement_id && e.date < dStart && (vehicle === "all" || (e.lorry || e.trips?.lorry) === vehicle));
      beforeLedger.forEach(entry => {
        const amt = Number(entry.amount || 0);
        if (entry.type === "revenue") openingBalance += amt;
        else if (entry.type === "expense_paid" || entry.type === "expense") openingBalance -= amt;
        else if (entry.type === "remittance" || entry.type === "write_off") openingBalance -= amt;
      });
    }

    let tr = 0, te = 0, trm = 0, cb = openingBalance;
    const groups = {};
    const sorted = [...filtered].sort((a, b) => {
      const dc = (a.date || "").localeCompare(b.date || "");
      if (dc !== 0) return dc;
      const na = parseInt(String(a.trips?.trip_number || "0").replace(/\D/g,""),10)||0;
      const nb = parseInt(String(b.trips?.trip_number || "0").replace(/\D/g,""),10)||0;
      return na - nb;
    });

    sorted.forEach(entry => {
      const amt = Number(entry.amount || 0);
      const date = entry.date || "No Date";
      if (!groups[date]) groups[date] = { date, trips: {}, payments: [], openingBalance: cb, totalRevenue: 0, totalExpenses: 0, totalRemitted: 0, closingBalance: 0 };
      const g = groups[date];

      if (entry.type === "remittance" || entry.type === "write_off") {
        cb -= amt; trm += amt; g.totalRemitted += amt; g.payments.push(entry);
      } else if (entry.trip_id) {
        if (!g.trips[entry.trip_id]) {
          g.trips[entry.trip_id] = {
            trip_id: entry.trip_id, trip_number: entry.trips?.trip_number || entry.notes?.match(/Trip (\d+)/)?.[1] || "",
            location: entry.trips?.location || "", revenue_entries: [], expense_entries: [], totalRevenue: 0, totalExpenses: 0
          };
        }
        const t = g.trips[entry.trip_id];
        if (entry.type === "revenue") { t.revenue_entries.push(entry); t.totalRevenue += amt; cb += amt; tr += amt; g.totalRevenue += amt; }
        else if (entry.type === "expense_paid" || entry.type === "expense") { t.expense_entries.push(entry); t.totalExpenses += amt; cb -= amt; te += amt; g.totalExpenses += amt; }
      } else {
        if (!g.trips["__standalone__"]) g.trips["__standalone__"] = { trip_id: "__standalone__", trip_number: null, location: null, revenue_entries: [], expense_entries: [], totalRevenue: 0, totalExpenses: 0 };
        const t = g.trips["__standalone__"];
        if (entry.type === "revenue") { t.revenue_entries.push(entry); t.totalRevenue += amt; cb += amt; tr += amt; g.totalRevenue += amt; }
        else if (entry.type === "expense_paid" || entry.type === "expense") { t.expense_entries.push(entry); t.totalExpenses += amt; cb -= amt; te += amt; g.totalExpenses += amt; }
      }
      g.closingBalance = cb;
    });

    const dateGroups = Object.values(groups)
      .sort((a, b) => a.date.localeCompare(b.date)) // Chronological for PDF
      .map(g => ({ ...g, trips: Object.values(g.trips).sort((a, b) => (parseInt(a.trip_number)||0) - (parseInt(b.trip_number)||0)) }));

    const reportData = {
      openingBalance, totalRevenue: tr, totalExpenses: te, totalRemitted: trm, closingBalance: cb,
      dateGroups
    };

    let dateRange = { start: "All Time", end: "All Time" };
    if (period === "today") dateRange = { start: today(), end: today() };
    else if (period === "week") { const r = getWeekRange(); dateRange = { start: r[0], end: r[1] }; }
    else if (period === "month") { const r = getMonthRange(); dateRange = { start: r[0], end: r[1] }; }
    else if (period === "custom") { dateRange = { start: customStart || "N/A", end: customEnd || "N/A" }; }

    // 3. Generate PDF
    setTimeout(() => {
      try {
        generateBrokerStatement(broker, vehicle, dateRange, reportData, options);
      } catch (err) {
        console.error(err);
        alert("Failed to generate PDF: " + err.message);
      } finally {
        setIsGenerating(false);
        onClose();
      }
    }, 100);
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-100";

  return (
    <Modal open={open} onClose={() => !isGenerating && onClose()} title="Generate PDF Statement">
      <div className="space-y-5 px-1 pb-2">
        
        {/* Vehicle Selection */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Vehicle</label>
          <select className={inp} value={vehicle} onChange={e => setVehicle(e.target.value)}>
            <option value="all">All Vehicles</option>
            {availableLorries.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Date Range Selection */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Date Range</label>
          <select className={inp} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Start Date</label>
              <input type="date" className={inp} value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">End Date</label>
              <input type="date" className={inp} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        {/* Report Options */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Report Details</label>
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
                checked={options.includeTripDetails} onChange={e => setOptions({...options, includeTripDetails: e.target.checked})} />
              <span className="text-sm font-semibold text-slate-700">Include trip details</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
                checked={options.includeIndividualExpenses} disabled={!options.includeTripDetails}
                onChange={e => setOptions({...options, includeIndividualExpenses: e.target.checked})} />
              <span className={`text-sm font-semibold ${options.includeTripDetails ? 'text-slate-700' : 'text-slate-400'}`}>Include individual expenses</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
                checked={options.includeRemittances} onChange={e => setOptions({...options, includeRemittances: e.target.checked})} />
              <span className="text-sm font-semibold text-slate-700">Include remittance history</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
                checked={options.includeReconciliation} onChange={e => setOptions({...options, includeReconciliation: e.target.checked})} />
              <span className="text-sm font-semibold text-slate-700">Include final reconciliation</span>
            </label>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (period === "custom" && (!customStart || !customEnd))}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? "Generating Statement..." : "Generate PDF Statement"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BrokerAccountPage({ isAdmin, brokers = [], vehicles = [], trips = [] }) {
  const [activeBrokerId, setActiveBrokerId] = useState("");
  const [ledger, setLedger] = useState([]);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  const [activeTab, setActiveTab] = useState("date"); // default to Date view — better organized
  const [activeLorry, setActiveLorry] = useState("all");

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    setActiveLorry("all");
    setSearchQuery(""); setFilterPeriod("all"); setFilterType("all");
    setCustomStart(""); setCustomEnd(""); setSelectedEntry(null);
  }, [activeBrokerId]);

  const toggleTrip = (id) => {
    setExpandedTrips(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  useEffect(() => {
    if (!activeBrokerId && brokers.length > 0) {
      const first = brokers.find(b => b.status === "Active") || brokers[0];
      if (first) setActiveBrokerId(first.id);
    }
  }, [brokers, activeBrokerId]);

  useEffect(() => {
    if (!activeBrokerId) { setLedger([]); return; }
    const unsub = financeService.subscribeBrokerLedger(activeBrokerId, setLedger);
    return () => unsub();
  }, [activeBrokerId]);

  const activeBroker = useMemo(() => brokers.find(b => b.id === activeBrokerId), [brokers, activeBrokerId]);

  // Trips for this broker (for modal trip linking)
  // Note: trips.js fromDB() maps broker_id → brokerId (camelCase)
  const brokerTrips = useMemo(() =>
    trips.filter(t => t.brokerId === activeBrokerId),
    [trips, activeBrokerId]
  );

  const availableLorries = useMemo(() => {
    const plates = new Set();
    ledger.forEach(e => { const p = e.lorry || e.trips?.lorry; if (p) plates.add(p); });
    return Array.from(plates).sort();
  }, [ledger]);

  const closedCount = useMemo(() => ledger.filter(e => e.statement_id).length, [ledger]);

  // Base filtered ledger
  const filteredLedger = useMemo(() => {
    let result = showAllHistory ? ledger : ledger.filter(e => !e.statement_id);
    if (activeLorry !== "all")
      result = result.filter(e => (e.lorry || e.trips?.lorry) === activeLorry);
    return result;
  }, [ledger, activeLorry, showAllHistory]);

  // Display ledger (adds search + period + type)
  const displayedLedger = useMemo(() => {
    return filteredLedger.filter(e => {
      if (filterType === "revenue" && e.type !== "revenue") return false;
      if (filterType === "payment" && e.type !== "remittance") return false;
      if (filterType === "expense" && e.type !== "expense_paid" && e.type !== "expense") return false;
      if (filterType === "adjustment" && e.type !== "write_off") return false;
      if (!isWithinPeriod(e.date, filterPeriod, customStart, customEnd)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!(e.notes || "").toLowerCase().includes(q) &&
            !(e.trips?.location || "").toLowerCase().includes(q) &&
            !(String(e.trips?.trip_number || "")).includes(q)) return false;
      }
      return true;
    });
  }, [filteredLedger, filterType, filterPeriod, searchQuery, customStart, customEnd]);

  const hasActiveFilters = searchQuery || filterPeriod !== "all" || filterType !== "all";
  const clearFilters = () => { setSearchQuery(""); setFilterPeriod("all"); setFilterType("all"); setCustomStart(""); setCustomEnd(""); };

  // ── Ledger View (flat table with running balance) ──────────────────────────
  const { openingBalance, totalRevenue, totalExpenses, totalRemitted, totalWriteOff, currentBalance, groupedLedger } = useMemo(() => {
    let ob = 0;
    // Calculate opening balance from transactions before the filtered period
    if (filterPeriod !== "all") {
      let dStart = "";
      if (filterPeriod === "today") dStart = today();
      else if (filterPeriod === "week") dStart = getWeekRange()[0];
      else if (filterPeriod === "month") dStart = getMonthRange()[0];
      else if (filterPeriod === "year") dStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      else if (filterPeriod === "custom") dStart = customStart;

      if (dStart) {
        // Filter from the base filteredLedger (which respects lorry filters and closed statements)
        const beforeLedger = filteredLedger.filter(e => e.date < dStart);
        beforeLedger.forEach(entry => {
          const amt = Number(entry.amount || 0);
          if (entry.type === "revenue") ob += amt;
          else if (entry.type === "expense_paid" || entry.type === "expense") ob -= amt;
          else if (entry.type === "remittance" || entry.type === "write_off") ob -= amt;
        });
      }
    }

    let tr = 0, te = 0, trm = 0, two = 0, cb = ob;
    const groups = [];
    const tripMap = new Map();

    const sorted = [...displayedLedger].sort((a, b) => {
      const dc = (a.date || "").localeCompare(b.date || "");
      if (dc !== 0) return dc;
      const na = parseInt(String(a.trips?.trip_number || a.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(String(b.trips?.trip_number || b.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      if (na !== nb) return na - nb;
      const aIsSettle = a.type === "remittance" || a.type === "write_off";
      const bIsSettle = b.type === "remittance" || b.type === "write_off";
      if (aIsSettle && !bIsSettle) return 1;
      if (!aIsSettle && bIsSettle) return -1;
      return 0;
    });

    sorted.forEach(entry => {
      const amt = Number(entry.amount || 0);
      if (entry.type === "revenue") { cb += amt; tr += amt; }
      else if (entry.type === "expense_paid" || entry.type === "expense") { cb -= amt; te += amt; }
      else if (entry.type === "remittance") { cb -= amt; trm += amt; }
      else if (entry.type === "write_off") { cb -= amt; two += amt; }
      entry.runningBalance = cb;

      if (entry.type === "remittance" || entry.type === "write_off" || !entry.trip_id) {
        groups.push({ isGroup: false, ...entry });
      } else {
        if (!tripMap.has(entry.trip_id)) {
          const tripName = entry.notes.split(' - ')[0].replace(' Expenses Paid', '');
          const g = { isGroup: true, id: entry.trip_id, trip_id: entry.trip_id, date: entry.date, notes: tripName, location: entry.trips?.location || "", revenue: 0, expenses: 0, items: [], runningBalance: 0 };
          tripMap.set(entry.trip_id, g); groups.push(g);
        }
        const group = tripMap.get(entry.trip_id);
        group.items.push(entry);
        if (entry.type === "revenue") group.revenue += amt;
        if (entry.type === "expense_paid" || entry.type === "expense") group.expenses += amt;
        group.runningBalance = cb;
      }
    });
    return { totalRevenue: tr, totalExpenses: te, totalRemitted: trm, totalWriteOff: two, currentBalance: cb, groupedLedger: groups.reverse() };
  }, [displayedLedger]);

  // ── Date History view ──────────────────────────────────────────────────────
  const dateGroups = useMemo(() => {
    const groups = {};
    const sorted = [...displayedLedger].sort((a, b) => {
      const dc = (a.date || "").localeCompare(b.date || "");
      if (dc !== 0) return dc;
      const na = parseInt(String(a.trips?.trip_number || "0").replace(/\D/g,""),10)||0;
      const nb = parseInt(String(b.trips?.trip_number || "0").replace(/\D/g,""),10)||0;
      return na - nb;
    });

    let running = openingBalance || 0;
    sorted.forEach(entry => {
      const amt = Number(entry.amount || 0);
      const date = entry.date || "No Date";
      if (!groups[date]) groups[date] = { date, trips: {}, payments: [], openingBalance: running, totalRevenue: 0, totalExpenses: 0, totalRemitted: 0, closingBalance: 0 };
      const g = groups[date];

      if (entry.type === "remittance" || entry.type === "write_off") {
        running -= amt;
        g.totalRemitted += amt;
        g.payments.push(entry);
      } else if (entry.trip_id) {
        if (!g.trips[entry.trip_id]) {
          g.trips[entry.trip_id] = {
            trip_id: entry.trip_id,
            trip_number: entry.trips?.trip_number || entry.notes?.match(/Trip (\d+)/)?.[1] || "",
            location: entry.trips?.location || "",
            revenue_entries: [], expense_entries: [],
            totalRevenue: 0, totalExpenses: 0
          };
        }
        const t = g.trips[entry.trip_id];
        if (entry.type === "revenue") { t.revenue_entries.push(entry); t.totalRevenue += amt; running += amt; g.totalRevenue += amt; }
        else if (entry.type === "expense_paid" || entry.type === "expense") { t.expense_entries.push(entry); t.totalExpenses += amt; running -= amt; g.totalExpenses += amt; }
      } else {
        // Standalone non-trip entry
        if (!g.trips["__standalone__"]) g.trips["__standalone__"] = { trip_id: "__standalone__", trip_number: null, location: null, revenue_entries: [], expense_entries: [], totalRevenue: 0, totalExpenses: 0 };
        const t = g.trips["__standalone__"];
        if (entry.type === "revenue") { t.revenue_entries.push(entry); t.totalRevenue += amt; running += amt; g.totalRevenue += amt; }
        else if (entry.type === "expense_paid" || entry.type === "expense") { t.expense_entries.push(entry); t.totalExpenses += amt; running -= amt; g.totalExpenses += amt; }
      }
      g.closingBalance = running;
    });

    return Object.values(groups)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(g => ({ ...g, trips: Object.values(g.trips).sort((a, b) => (parseInt(a.trip_number)||0) - (parseInt(b.trip_number)||0)) }));
  }, [displayedLedger, openingBalance]);

  const handleDeleteSettlement = async (settlementId) => {
    if (!confirm("Are you sure? This will reverse all trip payments linked to this settlement. This cannot be undone.")) return;
    try { await financeService.deleteBrokerSettlement(settlementId); }
    catch (e) { alert("Error: " + e.message); }
  };

  const paidRatio = totalRevenue > 0 ? Math.min(100, ((totalRevenue - currentBalance) / totalRevenue) * 100) : 100;
  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-100";

  if (brokers.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <div>
          <div className="text-5xl mb-4">🏢</div>
          <h3 className="text-lg font-bold text-slate-700">No Brokers Yet</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-xs">Go to the <strong>Brokers</strong> page to add your first broker, then assign trips to them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
        {/* Top: Title + Action */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">Broker Ledger</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {displayedLedger.length} {displayedLedger.length === 1 ? "entry" : "entries"}
              {hasActiveFilters && <span className="text-amber-600 font-semibold"> (filtered)</span>}
              {!showAllHistory && closedCount > 0 && <span className="text-slate-400"> · {closedCount} archived</span>}
            </p>
          </div>
          {isAdmin && activeBrokerId && (
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => setPdfModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors"
              >
                <span>📄</span> Generate PDF
              </button>
              <button
                onClick={() => setTxModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-colors"
              >
                <span className="text-base">+</span> Record Transaction
              </button>
            </div>
          )}
        </div>

        {/* Bottom: Selectors + controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t border-slate-100">
          {/* Selectors */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-100 focus-within:border-emerald-400 transition-all">
              <span className="text-slate-400">🏢</span>
              <select value={activeBrokerId} onChange={e => setActiveBrokerId(e.target.value)} className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none min-w-[140px]">
                {brokers.map(b => <option key={b.id} value={b.id}>{b.name}{b.company ? ` — ${b.company}` : ""}</option>)}
              </select>
            </div>
            {availableLorries.length > 0 && (
              <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-all ${activeLorry !== "all" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
                <span className={activeLorry !== "all" ? "text-blue-500" : "text-slate-400"}>🚛</span>
                <select value={activeLorry} onChange={e => setActiveLorry(e.target.value)} className={`bg-transparent text-sm font-semibold focus:outline-none min-w-[120px] ${activeLorry !== "all" ? "text-blue-700" : "text-slate-700"}`}>
                  <option value="all">All Vehicles</option>
                  {availableLorries.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAllHistory(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${showAllHistory ? "bg-slate-800 text-white border-slate-800" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
            >
              {showAllHistory ? "📋 All Time" : "✅ Current Period"}
              {!showAllHistory && closedCount > 0 && <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{closedCount}</span>}
            </button>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${hasActiveFilters ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
            >
              🔍 Filters
              {hasActiveFilters && <span className="bg-white/30 px-1.5 py-0.5 rounded-full text-[10px] font-bold">ON</span>}
              <span>{showFilters ? "▲" : "▼"}</span>
            </button>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1">
              <button onClick={() => setActiveTab("date")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === "date" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>By Date</button>
              <button onClick={() => setActiveTab("ledger")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === "ledger" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>Ledger</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Panel ────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm" style={{ animation: "fadeSlideIn 0.15s ease-out" }}>
          <style>{`@keyframes fadeSlideIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Search</p>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input placeholder="Trip, location, notes…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
            <div className="min-w-[120px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Period</p>
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:outline-none">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            <div className="min-w-[130px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Type</p>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:outline-none">
                <option value="all">All Entries</option>
                <option value="revenue">Revenue</option>
                <option value="payment">Payments</option>
                <option value="expense">Expenses</option>
                <option value="adjustment">Adjustments</option>
              </select>
            </div>
            {filterPeriod === "custom" && (
              <div className="flex items-center gap-2 w-full">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 py-2 focus:outline-none" />
                <span className="text-xs text-slate-400">→</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 py-2 focus:outline-none" />
              </div>
            )}
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 self-end h-[34px]">✕ Clear</button>
            )}
          </div>
        </div>
      )}

      {/* Vehicle banner */}
      {activeLorry !== "all" && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
          <span className="text-blue-500">🚛</span>
          <span className="font-semibold text-blue-700">Viewing <strong>{activeLorry}</strong> only.</span>
          <button onClick={() => setActiveLorry("all")} className="ml-auto text-blue-400 hover:text-blue-700 font-bold text-xs">✕ Show All</button>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className={`rounded-2xl border p-5 shadow-sm ${currentBalance > 0 ? "bg-gradient-to-br from-rose-50 to-red-50 border-rose-200" : "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Outstanding Balance</p>
              <p className={`text-3xl font-black mt-1 ${currentBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(currentBalance)}</p>
            </div>
            <div className="text-4xl">{currentBalance > 0 ? "💸" : "✅"}</div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
              <span>{Math.round(paidRatio)}% collected</span>
              <span>of {fmt(totalRevenue)} revenue</span>
            </div>
            <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${paidRatio}%` }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <StatCard label="Total Revenue" value={fmt(totalRevenue)} icon="💰" color="blue" />
          <StatCard label="Expenses Paid" value={fmt(totalExpenses + totalRemitted + totalWriteOff)} icon="📉" color="amber" />
        </div>
      </div>

      {/* ── Ledger Panel ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            {activeTab === "date" ? "Transaction History by Date" : "Running Ledger"} —{" "}
            <span className="text-emerald-600">{activeBroker?.name || "…"}</span>
            {activeLorry !== "all" && <span className="ml-2 text-xs font-bold rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">{activeLorry}</span>}
          </h3>
          {hasActiveFilters && (
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {displayedLedger.length} result{displayedLedger.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ─── DATE VIEW ─────────────────────────────────────────────────────── */}
        {activeTab === "date" ? (
          <div className="p-3 sm:p-5 space-y-6">
            {dateGroups.length === 0 && (
              <div className="py-14 text-center">
                {hasActiveFilters
                  ? <><p className="text-slate-400 font-medium">No entries match your filters.</p><button onClick={clearFilters} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">Clear filters</button></>
                  : <p className="text-slate-400">No activity for <strong>{activeBroker?.name}</strong> yet.</p>}
              </div>
            )}

            {dateGroups.map(dayGroup => (
              <div key={dayGroup.date} className="space-y-2">

                {/* ── Date Header ── */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pt-1 pb-2 -mx-3 sm:-mx-5 px-3 sm:px-5 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: date */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">📅</span>
                      <h3 className="text-sm font-black text-slate-800 truncate">{dayGroup.date}</h3>
                    </div>
                    {/* Right: closing balance only — clean, no chip overflow */}
                    <span className="shrink-0 text-xs font-black bg-slate-800 text-white px-2.5 py-1 rounded-full whitespace-nowrap">
                      {fmt(dayGroup.closingBalance)}
                    </span>
                  </div>
                  {/* Day flow — one compact line below */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] font-semibold text-slate-400 pl-6">
                    <span>Open {fmt(dayGroup.openingBalance)}</span>
                    {dayGroup.totalRevenue > 0 && <span className="text-emerald-600">+{fmt(dayGroup.totalRevenue)}</span>}
                    {dayGroup.totalExpenses > 0 && <span className="text-amber-600">−{fmt(dayGroup.totalExpenses)} exp</span>}
                    {dayGroup.totalRemitted > 0 && <span className="text-blue-600">−{fmt(dayGroup.totalRemitted)} paid</span>}
                  </div>
                </div>

                {/* ── Entries for this date ── */}
                <div className="space-y-2 pt-1">
                  {dayGroup.trips.map(trip => {
                    if (trip.trip_id === "__standalone__") {
                      return [...trip.revenue_entries, ...trip.expense_entries].map(entry => (
                        <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                          className={`rounded-xl border px-3 py-2.5 flex items-start justify-between gap-3 cursor-pointer active:opacity-80 transition-opacity ${entry.type === "revenue" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/40"}`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 ${entry.type === "revenue" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {entry.type === "revenue" ? "↑ Revenue" : "↓ Expense"}
                            </span>
                            <p className="text-xs text-slate-600 leading-snug truncate">{entry.notes}</p>
                          </div>
                          <p className={`text-sm font-black shrink-0 ${entry.type === "revenue" ? "text-emerald-600" : "text-rose-500"}`}>
                            {entry.type === "revenue" ? "+" : "−"}{fmt(entry.amount)}
                          </p>
                        </div>
                      ));
                    }

                    // ── Trip card ──
                    const net = trip.totalRevenue - trip.totalExpenses;
                    const accentColor = net > 0 ? "border-l-emerald-400" : net < 0 ? "border-l-rose-400" : "border-l-slate-300";
                    const allEntries = [...trip.revenue_entries, ...trip.expense_entries];
                    const isExpanded = expandedTrips.has(trip.trip_id);

                    return (
                      <div key={trip.trip_id} className={`rounded-xl border border-slate-200 bg-white overflow-hidden border-l-4 ${accentColor}`}>
                        {/* Trip header — stacks on mobile */}
                        <div
                          onClick={() => toggleTrip(trip.trip_id)}
                          className="px-3 py-2.5 bg-slate-50/70 cursor-pointer active:bg-slate-100 transition-colors"
                        >
                          {/* Row 1: Trip name + chevron */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-black text-slate-800 text-sm truncate">
                                {trip.trip_number ? `Trip ${trip.trip_number}` : "Trip"}
                              </span>
                              {trip.location && (
                                <span className="text-xs text-slate-500 truncate">— {trip.location}</span>
                              )}
                            </div>
                            <span className={`text-slate-400 text-[10px] shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                          </div>
                          {/* Row 2: Amounts summary */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {trip.totalRevenue > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+{fmt(trip.totalRevenue)}</span>
                            )}
                            {trip.totalExpenses > 0 && (
                              <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">−{fmt(trip.totalExpenses)}</span>
                            )}
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${net >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200"}`}>
                              Net {net >= 0 ? "+" : ""}{fmt(net)}
                            </span>
                          </div>
                        </div>

                        {/* Trip entries */}
                        {(isExpanded || allEntries.length <= 2) && (
                          <div className="divide-y divide-slate-50">
                            {allEntries.map(entry => (
                              <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                                className="px-3 py-2.5 flex items-start justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-0.5 ${entry.type === "revenue" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                    {entry.type === "revenue" ? "↑ Revenue" : "↓ Expense"}
                                  </span>
                                  <p className="text-xs text-slate-600 leading-snug">{entry.notes}</p>
                                </div>
                                <p className={`text-sm font-bold shrink-0 whitespace-nowrap ${entry.type === "revenue" ? "text-emerald-600" : "text-rose-500"}`}>
                                  {entry.type === "revenue" ? "+" : "−"}{fmt(entry.amount)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {allEntries.length > 2 && !isExpanded && (
                          <button onClick={() => toggleTrip(trip.trip_id)}
                            className="w-full py-2 text-xs font-bold text-indigo-500 hover:text-indigo-700 border-t border-slate-50 bg-white"
                          >▼ Show {allEntries.length} entries</button>
                        )}
                        {allEntries.length > 2 && isExpanded && (
                          <button onClick={() => toggleTrip(trip.trip_id)}
                            className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 border-t border-slate-50 bg-white"
                          >▲ Collapse</button>
                        )}
                      </div>
                    );
                  })}

                  {/* ── Payments & Adjustments ── */}
                  {dayGroup.payments.length > 0 && (
                    <div className="rounded-xl border border-emerald-100 overflow-hidden bg-emerald-50/20">
                      <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Payments & Adjustments</p>
                      </div>
                      <div className="divide-y divide-emerald-50">
                        {dayGroup.payments.map(entry => {
                          const method = parseMethod(entry.notes || "");
                          const isWO = entry.type === "write_off";
                          return (
                            <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                              className="px-3 py-3 flex items-start justify-between gap-3 hover:bg-emerald-50 active:bg-emerald-50 cursor-pointer"
                            >
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span className="text-lg shrink-0 leading-none mt-0.5">{isWO ? "⚖️" : METHOD_ICON[method] || "💵"}</span>
                                <div className="min-w-0">
                                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-0.5 ${isWO ? "bg-slate-200 text-slate-600" : "bg-emerald-200 text-emerald-800"}`}>
                                    {isWO ? "Adjustment" : method}
                                  </span>
                                  <p className="text-xs text-slate-600 truncate">{entry.notes}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black text-sm text-rose-600">−{fmt(entry.amount)}</p>
                                {entry.settlement_id && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteSettlement(entry.settlement_id); }}
                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-600 mt-0.5 block"
                                  >Undo</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        ) : (
          /* ─── LEDGER TABLE ─────────────────────────────────────────────── */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold text-right">Debit (−)</th>
                  <th className="px-4 py-3 font-semibold text-right">Credit (+)</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {groupedLedger.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-14 text-center">
                    {hasActiveFilters
                      ? <><p className="text-slate-400">No entries match your filters.</p><button onClick={clearFilters} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">Clear filters</button></>
                      : <p className="text-slate-400">No activity for <strong>{activeBroker?.name}</strong> yet.</p>}
                  </td></tr>
                )}
                {groupedLedger.map((row, idx) => {
                  if (!row.isGroup) {
                    const method = parseMethod(row.notes || "");
                    return (
                      <tr key={row.id || idx} onClick={() => setSelectedEntry(row)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium">{row.date}</td>
                        <td className="px-4 py-3">
                          <Badge color={row.type === "revenue" ? "blue" : row.type === "expense_paid" ? "amber" : row.type === "write_off" ? "slate" : "green"}>
                            {row.type === "revenue" ? "Revenue" : row.type === "expense_paid" ? "Expense" : row.type === "write_off" ? "Adjustment" : "Settlement"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {(row.type === "remittance" || row.type === "write_off") && <span title={method}>{METHOD_ICON[method] || "💵"}</span>}
                            <span className="text-slate-700">{row.notes}</span>
                            {(row.type === "remittance" || row.type === "write_off") && row.settlement_id && (
                              <button onClick={e => { e.stopPropagation(); handleDeleteSettlement(row.settlement_id); }} className="ml-1 text-rose-400 hover:text-rose-600 text-xs border border-rose-200 px-1.5 py-0.5 rounded-lg hover:bg-rose-50 transition-colors">Undo</button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-rose-500 font-semibold">{row.type !== "revenue" ? fmt(row.amount) : "—"}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{row.type === "revenue" ? fmt(row.amount) : "—"}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">{fmt(row.runningBalance)}</td>
                      </tr>
                    );
                  }
                  const isExpanded = expandedTrips.has(row.trip_id);
                  const net = row.revenue - row.expenses;
                  return (
                    <React.Fragment key={row.trip_id}>
                      <tr onClick={() => toggleTrip(row.trip_id)} className="hover:bg-slate-100/70 cursor-pointer bg-slate-50/40 border-y border-slate-100">
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">{row.date}</td>
                        <td className="px-4 py-3">
                          {row.location
                            ? <span className="inline-flex items-center gap-1 text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">📍 {row.location}</span>
                            : <Badge color="purple">Trip</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{row.notes}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${net >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>Net {net >= 0 ? "+" : ""}{fmt(net)}</span>
                            <span className={`text-slate-400 text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-rose-500 font-semibold">{row.expenses > 0 ? fmt(row.expenses) : "—"}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{row.revenue > 0 ? fmt(row.revenue) : "—"}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">{fmt(row.runningBalance)}</td>
                      </tr>
                      {isExpanded && row.items.map(item => (
                        <tr key={item.id} onClick={() => setSelectedEntry(item)} className="bg-slate-50/60 hover:bg-slate-100/50 cursor-pointer transition-colors">
                          <td className="px-4 py-2.5 pl-8 text-[11px] text-slate-400">{item.date}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${item.type === "revenue" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {item.type === "revenue" ? "↑ Revenue" : "↓ Expense"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-600">{item.notes}</td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-rose-400 font-semibold">{item.type !== "revenue" ? fmt(item.amount) : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-emerald-500 font-semibold">{item.type === "revenue" ? fmt(item.amount) : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-slate-300">—</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Entry Detail Panel ──────────────────────────────────────────────── */}
      <EntryDetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} onUndo={handleDeleteSettlement} />

      {/* ── Transaction Modal ───────────────────────────────────────────────── */}
      <BrokerTransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        broker={activeBroker}
        activeLorry={activeLorry}
        onSuccess={() => setTxModalOpen(false)}
        vehicles={vehicles}
        brokerTrips={brokerTrips}
      />
      
      {/* ── PDF Statement Modal ─────────────────────────────────────────────── */}
      <BrokerStatementModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        broker={activeBroker}
        availableLorries={availableLorries}
        currentLorry={activeLorry}
        ledger={ledger}
      />
    </div>
  );
}
