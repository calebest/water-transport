import React, { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today } from "../utils/helpers";
import { Modal, StatCard, Badge } from "../components/ui";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const METHOD_ICON = { Cash: "💵", "M-Pesa": "📱", "Bank Transfer": "🏦", Adjustment: "⚖️" };
const parseMethod = (notes = "") => {
  if (notes.includes("M-Pesa")) return "M-Pesa";
  if (notes.includes("Bank")) return "Bank Transfer";
  if (notes.includes("Adjustment") || notes.includes("Write")) return "Adjustment";
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
  if (period === "custom" && customStart && customEnd) {
    return d >= new Date(customStart) && d <= new Date(customEnd + "T23:59:59");
  }
  return true;
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function BrokerAccountPage({ isAdmin, brokers = [] }) {
  const [activeBrokerId, setActiveBrokerId] = useState("");
  const [ledger, setLedger] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  const [activeTab, setActiveTab] = useState("ledger");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "Cash", date: today(), notes: "Payment via Cash" });
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [writeOffForm, setWriteOffForm] = useState({ amount: "", date: today(), notes: "Balance Adjustment / Write-Off" });
  const [activeLorry, setActiveLorry] = useState("all");

  // ── New UI State ────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null); // for detail panel

  // Reset filters when broker changes
  useEffect(() => {
    setActiveLorry("all");
    setSearchQuery("");
    setFilterPeriod("all");
    setFilterType("all");
    setCustomStart("");
    setCustomEnd("");
    setSelectedEntry(null);
  }, [activeBrokerId]);

  const toggleTrip = (id) => {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-select first active broker
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

  // All unique lorry plates
  const availableLorries = useMemo(() => {
    const plates = new Set();
    ledger.forEach(e => { const p = e.lorry || e.trips?.lorry; if (p) plates.add(p); });
    return Array.from(plates).sort();
  }, [ledger]);

  // Count of closed statement records
  const closedCount = useMemo(() => ledger.filter(e => e.statement_id).length, [ledger]);

  // ── Base filtered ledger (lorry + statement filter) ─────────────────────────
  const filteredLedger = useMemo(() => {
    let result = showAllHistory ? ledger : ledger.filter(e => !e.statement_id);
    if (activeLorry !== "all") {
      result = result.filter(e => {
        const plate = e.lorry || e.trips?.lorry;
        return plate === activeLorry;
      });
    }
    return result;
  }, [ledger, activeLorry, showAllHistory]);

  // ── Display ledger (adds search + period + type filters on top) ─────────────
  const displayedLedger = useMemo(() => {
    return filteredLedger.filter(e => {
      // Type filter
      if (filterType === "revenue" && e.type !== "revenue") return false;
      if (filterType === "payment" && e.type !== "remittance") return false;
      if (filterType === "expense" && e.type !== "expense_paid") return false;
      if (filterType === "adjustment" && e.type !== "write_off") return false;

      // Period filter
      if (!isWithinPeriod(e.date, filterPeriod, customStart, customEnd)) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inNotes = (e.notes || "").toLowerCase().includes(q);
        const inLocation = (e.trips?.location || "").toLowerCase().includes(q);
        const inTrip = (e.trips?.trip_number || "").toString().includes(q);
        if (!inNotes && !inLocation && !inTrip) return false;
      }

      return true;
    });
  }, [filteredLedger, filterType, filterPeriod, searchQuery, customStart, customEnd]);

  const hasActiveFilters = searchQuery || filterPeriod !== "all" || filterType !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setFilterPeriod("all");
    setFilterType("all");
    setCustomStart("");
    setCustomEnd("");
  };

  // ── Date groups (for Date History view) ────────────────────────────────────
  const dateGroups = useMemo(() => {
    const groups = {};
    const sortLedger = (a, b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;
      const numA = parseInt(String(a.trips?.trip_number || a.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.trips?.trip_number || b.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;
      if ((a.type === "remittance" || a.type === "write_off") && (b.type !== "remittance" && b.type !== "write_off")) return 1;
      if ((a.type !== "remittance" && a.type !== "write_off") && (b.type === "remittance" || b.type === "write_off")) return -1;
      return 0;
    };
    const sortedLedger = [...displayedLedger].sort(sortLedger);
    let runningBalance = 0;
    sortedLedger.forEach(entry => {
      const amt = Number(entry.amount || 0);
      const date = entry.date || "No Date";
      if (!groups[date]) {
        groups[date] = { date, entries: [], totalRevenue: 0, totalExpenses: 0, totalRemitted: 0, netChange: 0, openingBalance: runningBalance, closingBalance: 0 };
      }
      const group = groups[date];
      if (entry.type === "revenue") { group.totalRevenue += amt; group.netChange += amt; runningBalance += amt; }
      else if (entry.type === "expense_paid") { group.totalExpenses += amt; group.netChange -= amt; runningBalance -= amt; }
      else if (entry.type === "remittance") { group.totalRemitted += amt; group.netChange -= amt; runningBalance -= amt; }
      else if (entry.type === "write_off") { group.totalWriteOff = (group.totalWriteOff || 0) + amt; group.netChange -= amt; runningBalance -= amt; }
      group.entries.push(entry);
      group.closingBalance = runningBalance;
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [displayedLedger]);

  // ── Grouped ledger (for Ledger View) ───────────────────────────────────────
  const { totalRevenue, totalExpenses, totalRemitted, totalWriteOff, currentBalance, groupedLedger } = useMemo(() => {
    let tr = 0, te = 0, trm = 0, two = 0, cb = 0;
    const groups = [];
    const tripMap = new Map();
    const sortedLedger = [...displayedLedger].sort((a, b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;
      const numA = parseInt(String(a.trips?.trip_number || a.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.trips?.trip_number || b.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;
      if ((a.type === "remittance" || a.type === "write_off") && (b.type !== "remittance" && b.type !== "write_off")) return 1;
      if ((a.type !== "remittance" && a.type !== "write_off") && (b.type === "remittance" || b.type === "write_off")) return -1;
      return 0;
    });
    sortedLedger.forEach(entry => {
      const amt = Number(entry.amount || 0);
      if (entry.type === "revenue") { cb += amt; tr += amt; }
      else if (entry.type === "expense_paid") { cb -= amt; te += amt; }
      else if (entry.type === "remittance") { cb -= amt; trm += amt; }
      else if (entry.type === "write_off") { cb -= amt; two += amt; }
      entry.runningBalance = cb;
      if (entry.type === "remittance" || entry.type === "write_off" || !entry.trip_id) {
        groups.push({ isGroup: false, ...entry });
      } else {
        if (!tripMap.has(entry.trip_id)) {
          const tripName = entry.notes.split(' - ')[0].replace(' Expenses Paid', '');
          const location = entry.trips?.location || "";
          const newGroup = { isGroup: true, id: entry.trip_id, trip_id: entry.trip_id, date: entry.date, notes: tripName, location, revenue: 0, expenses: 0, items: [], runningBalance: 0 };
          tripMap.set(entry.trip_id, newGroup);
          groups.push(newGroup);
        }
        const group = tripMap.get(entry.trip_id);
        group.items.push(entry);
        if (entry.type === "revenue") group.revenue += amt;
        if (entry.type === "expense_paid") group.expenses += amt;
        group.runningBalance = cb;
      }
    });
    return { totalRevenue: tr, totalExpenses: te, totalRemitted: trm, totalWriteOff: two, currentBalance: cb, groupedLedger: groups.reverse() };
  }, [displayedLedger]);

  // ── Handlers (UNCHANGED) ───────────────────────────────────────────────────
  const handleSettle = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0) return alert("Amount must be positive");
    setSaving(true);
    try {
      await financeService.makeBrokerSettlement(activeBrokerId, form.amount, {
        date: form.date, method: form.method, notes: form.notes,
        lorry: activeLorry !== "all" ? activeLorry : null
      });
      setModalOpen(false);
      setForm({ amount: "", method: "Cash", date: today(), notes: "Payment via Cash" });
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (!confirm("Are you sure you want to delete this settlement? This will reverse the paid status of all associated trips and revert their balances. This action cannot be undone.")) return;
    try { await financeService.deleteBrokerSettlement(settlementId); }
    catch (e) { alert("Error deleting settlement: " + e.message); }
  };

  const handleWriteOff = async (e) => {
    e.preventDefault();
    if (Number(writeOffForm.amount) <= 0) return alert("Amount must be positive");
    setSaving(true);
    try {
      await financeService.makeBrokerSettlement(activeBrokerId, writeOffForm.amount, {
        date: writeOffForm.date, method: "Adjustment", notes: writeOffForm.notes, entryType: "write_off",
        lorry: activeLorry !== "all" ? activeLorry : null
      });
      setWriteOffModalOpen(false);
      setWriteOffForm({ amount: "", date: today(), notes: "Balance Adjustment / Write-Off" });
    } catch (e) { alert("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const inp = "w-full rounded-xl border border-slate-200 p-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const paidRatio = totalRevenue > 0 ? Math.min(100, ((totalRevenue - currentBalance) / totalRevenue) * 100) : 100;

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

        {/* Top row: Title + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-slate-800">Broker Ledger</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {displayedLedger.length} {displayedLedger.length === 1 ? "entry" : "entries"}
              {hasActiveFilters && <span className="text-amber-600 font-semibold"> (filtered)</span>}
              {!showAllHistory && closedCount > 0 && <span className="text-slate-400"> · {closedCount} archived</span>}
            </p>
          </div>
          {isAdmin && activeBrokerId && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => { setWriteOffForm(prev => ({ ...prev, amount: currentBalance > 0 ? currentBalance : "" })); setWriteOffModalOpen(true); }}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
              >
                Write-Off
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition-colors"
              >
                Record Settlement
              </button>
            </div>
          )}
        </div>

        {/* Bottom row: Selectors + Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t border-slate-100">
          {/* Left: Broker + Vehicle selectors */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-100 focus-within:border-emerald-400 transition-all">
              <span className="text-slate-400 text-base">🏢</span>
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

          {/* Right: Toggles + Filter button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* History toggle */}
            <button
              onClick={() => setShowAllHistory(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${showAllHistory ? "bg-slate-800 text-white border-slate-800" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
            >
              <span>{showAllHistory ? "📋 All Time" : "✅ Current Period"}</span>
              {!showAllHistory && closedCount > 0 && (
                <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{closedCount} hidden</span>
              )}
            </button>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${hasActiveFilters ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
            >
              <span>🔍 Filters</span>
              {hasActiveFilters && <span className="bg-white/30 px-1.5 py-0.5 rounded-full text-[10px] font-bold">ON</span>}
              <span className="text-xs">{showFilters ? "▲" : "▼"}</span>
            </button>

            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1">
              <button onClick={() => setActiveTab("ledger")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === "ledger" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>Ledger</button>
              <button onClick={() => setActiveTab("date")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === "date" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>By Date</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Panel ───────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-white/90 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 shadow-sm" style={{ animation: "fadeSlideIn 0.15s ease-out" }}>
          <style>{`@keyframes fadeSlideIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[180px] space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search</p>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input
                  placeholder="Trip, location, notes…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
                />
              </div>
            </div>
            {/* Period */}
            <div className="min-w-[120px] space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Period</p>
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-400">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {/* Type */}
            <div className="min-w-[130px] space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Type</p>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-400">
                <option value="all">All Entries</option>
                <option value="revenue">Revenue Only</option>
                <option value="payment">Payments Only</option>
                <option value="expense">Expenses Only</option>
                <option value="adjustment">Adjustments Only</option>
              </select>
            </div>
            {/* Custom date range */}
            {filterPeriod === "custom" && (
              <div className="flex items-center gap-2 w-full pt-1">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 py-2 focus:outline-none focus:border-emerald-400" />
                <span className="text-xs text-slate-400 shrink-0">→</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-xs px-3 py-2 focus:outline-none focus:border-emerald-400" />
              </div>
            )}
            {/* Clear */}
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all h-[34px] self-end">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Vehicle isolation banner ──────────────────────────────────────── */}
      {activeLorry !== "all" && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
          <span className="text-blue-500">🚛</span>
          <span className="font-semibold text-blue-700">Viewing <strong>{activeLorry}</strong> only — balances and settlements are isolated to this vehicle.</span>
          <button onClick={() => setActiveLorry("all")} className="ml-auto text-blue-400 hover:text-blue-700 font-bold text-xs">✕ Show All</button>
        </div>
      )}

      {/* ── Stats Cards ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Outstanding Balance — featured card */}
        <div className={`rounded-2xl border p-5 shadow-sm ${currentBalance > 0 ? "bg-gradient-to-br from-rose-50 to-red-50 border-rose-200" : "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Outstanding Balance</p>
              <p className={`text-3xl font-black mt-1 ${currentBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(currentBalance)}</p>
            </div>
            <div className={`text-4xl ${currentBalance > 0 ? "opacity-60" : "opacity-80"}`}>{currentBalance > 0 ? "💸" : "✅"}</div>
          </div>
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
              <span>{Math.round(paidRatio)}% collected</span>
              <span>of {fmt(totalRevenue)} total revenue</span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${currentBalance > 0 ? "bg-emerald-500" : "bg-emerald-400"}`} style={{ width: `${paidRatio}%` }} />
            </div>
          </div>
        </div>

        {/* Supporting stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard label="Total Revenue" value={fmt(totalRevenue)} icon="💰" color="blue" />
          <StatCard label="Expenses Paid" value={fmt(totalExpenses)} icon="📉" color="amber" />
          <StatCard label="Total Remitted" value={fmt(totalRemitted)} icon="🏦" color="green" />
          <StatCard label="Adjustments" value={fmt(totalWriteOff)} icon="⚖️" color="slate" />
        </div>
      </div>

      {/* ── Ledger Panel ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            {activeTab === "ledger" ? "Ledger History" : "Date-by-Date History"} —{" "}
            <span className="text-emerald-600">{activeBroker?.name || "…"}</span>
            {activeLorry !== "all" && <span className="ml-2 text-xs font-bold rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">{activeLorry}</span>}
          </h3>
          {hasActiveFilters && (
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {displayedLedger.length} result{displayedLedger.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {/* ── LEDGER VIEW ───────────────────────────────────────────────── */}
          {activeTab === "ledger" ? (
            <table className="w-full text-left text-xs sm:text-sm text-slate-600">
              <thead className="bg-slate-50 text-[10px] sm:text-xs uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold text-right">Debit (−)</th>
                  <th className="px-4 py-3 font-semibold text-right">Credit (+)</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {groupedLedger.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-14 text-center">
                      {hasActiveFilters ? (
                        <div>
                          <p className="text-slate-400 font-medium">No entries match your filters.</p>
                          <button onClick={clearFilters} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">Clear filters</button>
                        </div>
                      ) : (
                        <p className="text-slate-400">No ledger history for <strong>{activeBroker?.name}</strong> yet.</p>
                      )}
                    </td>
                  </tr>
                )}

                {groupedLedger.map((row, idx) => {
                  /* ── Single flat entry (settlement / standalone) ── */
                  if (!row.isGroup) {
                    const method = parseMethod(row.notes || "");
                    const methodIcon = METHOD_ICON[method] || "💵";
                    const isClosed = row.statement_id;
                    return (
                      <tr key={row.id || idx}
                        onClick={() => setSelectedEntry(row)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isClosed ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600">{row.date}</td>
                        <td className="px-4 py-3">
                          <Badge color={row.type === "revenue" ? "blue" : row.type === "expense_paid" ? "amber" : row.type === "write_off" ? "slate" : "green"}>
                            {row.type === "revenue" ? "Revenue" : row.type === "expense_paid" ? "Expense" : row.type === "write_off" ? "Adjustment" : "Settlement"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {(row.type === "remittance" || row.type === "write_off") && (
                              <span className="text-base" title={method}>{methodIcon}</span>
                            )}
                            <span className="text-slate-700 font-medium">{row.notes}</span>
                            {(row.type === "remittance" || row.type === "write_off") && row.settlement_id && (
                              <button
                                onClick={e => { e.stopPropagation(); handleDeleteSettlement(row.settlement_id); }}
                                className="ml-2 text-rose-400 hover:text-rose-600 font-bold text-xs border border-rose-200 hover:bg-rose-50 px-1.5 py-0.5 rounded-lg transition-colors"
                                title="Undo this settlement"
                              >Undo</button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-rose-500 font-semibold">{row.type !== "revenue" ? fmt(row.amount) : "—"}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{row.type === "revenue" ? fmt(row.amount) : "—"}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">{fmt(row.runningBalance)}</td>
                      </tr>
                    );
                  }

                  /* ── Trip group row ── */
                  const isExpanded = expandedTrips.has(row.trip_id);
                  const net = row.revenue - row.expenses;
                  const netColor = net >= 0 ? "text-emerald-600" : "text-rose-600";
                  return (
                    <React.Fragment key={row.trip_id}>
                      <tr
                        onClick={() => { toggleTrip(row.trip_id); setSelectedEntry(null); }}
                        className="hover:bg-slate-100/70 transition-colors cursor-pointer bg-slate-50/40 border-y border-slate-100 group"
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">{row.date}</td>
                        <td className="px-4 py-3">
                          {row.location
                            ? <span className="inline-flex items-center gap-1 text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">📍 {row.location}</span>
                            : <Badge color="purple">Trip</Badge>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{row.notes}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${net >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                              Net: {net >= 0 ? "+" : ""}{fmt(net)}
                            </span>
                            <span className={`text-slate-400 transition-transform text-xs ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-rose-500 font-semibold">{row.expenses > 0 ? fmt(row.expenses) : "—"}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{row.revenue > 0 ? fmt(row.revenue) : "—"}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">{fmt(row.runningBalance)}</td>
                      </tr>

                      {isExpanded && row.items.map(item => (
                        <tr key={item.id}
                          onClick={() => setSelectedEntry(item)}
                          className="bg-slate-50/60 border-b border-slate-50 hover:bg-slate-100/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 pl-8 text-[11px] text-slate-400">{item.date}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${item.type === "revenue" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {item.type === "revenue" ? "↑ Revenue" : "↓ Expense"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-600 max-w-xs">{item.notes}</td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-rose-400 font-semibold">{item.type !== "revenue" ? fmt(item.amount) : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-emerald-500 font-semibold">{item.type === "revenue" ? fmt(item.amount) : "—"}</td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-slate-300 font-medium">—</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

          ) : (
            /* ── DATE HISTORY VIEW ───────────────────────────────────────── */
            <div className="space-y-5 p-4 sm:p-5">
              {dateGroups.length === 0 && (
                <div className="py-14 text-center">
                  {hasActiveFilters ? (
                    <div>
                      <p className="text-slate-400 font-medium">No entries match your filters.</p>
                      <button onClick={clearFilters} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">Clear filters</button>
                    </div>
                  ) : (
                    <p className="text-slate-400">No ledger history yet.</p>
                  )}
                </div>
              )}

              {dateGroups.map(dateGroup => {
                const tripGroups = {};
                const settlementEntries = [];
                dateGroup.entries.forEach(entry => {
                  if (entry.type === "remittance" || entry.type === "write_off") {
                    settlementEntries.push(entry);
                  } else if (entry.trip_id) {
                    if (!tripGroups[entry.trip_id]) {
                      tripGroups[entry.trip_id] = {
                        trip_id: entry.trip_id,
                        trip_number: entry.trips?.trip_number || entry.notes?.match(/Trip (\d+)/)?.[1] || "",
                        location: entry.trips?.location || "",
                        entries: [], totalRevenue: 0, totalExpenses: 0,
                      };
                    }
                    const amt = Number(entry.amount || 0);
                    if (entry.type === "revenue") tripGroups[entry.trip_id].totalRevenue += amt;
                    else if (entry.type === "expense_paid") tripGroups[entry.trip_id].totalExpenses += amt;
                    tripGroups[entry.trip_id].entries.push(entry);
                  }
                });

                const sortedTrips = Object.values(tripGroups).sort((a, b) => {
                  const numA = parseInt(String(a.trip_number).replace(/\D/g, ""), 10) || 0;
                  const numB = parseInt(String(b.trip_number).replace(/\D/g, ""), 10) || 0;
                  return numA - numB;
                });

                return (
                  <div key={dateGroup.date}>
                    {/* Sticky date header */}
                    <div className="sticky top-0 z-10 flex items-center gap-3 py-2.5 px-1 -mx-1 bg-white/80 backdrop-blur-sm mb-4 rounded-xl">
                      <div className="bg-indigo-100 p-2 rounded-lg border border-indigo-100">
                        <span className="text-lg">📅</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-800">{dateGroup.date}</h3>
                      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                      {/* Quick summary chips */}
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Open {fmt(dateGroup.openingBalance)}</span>
                        {dateGroup.totalRevenue > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">+{fmt(dateGroup.totalRevenue)}</span>}
                        {dateGroup.totalExpenses > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">−{fmt(dateGroup.totalExpenses)} exp</span>}
                        {dateGroup.totalRemitted > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">−{fmt(dateGroup.totalRemitted)} paid</span>}
                        <span className="bg-slate-800 text-white px-2 py-1 rounded-full">Close {fmt(dateGroup.closingBalance)}</span>
                      </div>
                    </div>

                    <div className="space-y-3 ml-2">
                      {/* Trip cards */}
                      {sortedTrips.map(trip => {
                        const net = trip.totalRevenue - trip.totalExpenses;
                        const accentColor = net > 0 ? "border-l-emerald-400" : net === 0 ? "border-l-amber-400" : "border-l-rose-400";
                        return (
                          <div key={trip.trip_id} className={`rounded-xl border border-slate-200 bg-white overflow-hidden border-l-4 ${accentColor}`}>
                            <div className="px-4 py-3 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
                              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-slate-400">🚛</span>
                                Trip {trip.trip_number}
                                {trip.location && <span className="text-slate-500 font-normal">— {trip.location}</span>}
                              </h4>
                              <div className="flex gap-2 text-xs font-bold">
                                {trip.totalRevenue > 0 && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Revenue {fmt(trip.totalRevenue)}</span>}
                                {trip.totalExpenses > 0 && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Expenses {fmt(trip.totalExpenses)}</span>}
                                <span className={`px-2 py-0.5 rounded-full border font-black ${net >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200"}`}>
                                  Net: {net >= 0 ? "+" : ""}{fmt(net)}
                                </span>
                              </div>
                            </div>
                            <div className="divide-y divide-slate-50">
                              {trip.entries.map(entry => (
                                <div key={entry.id} onClick={() => setSelectedEntry(entry)} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-sm cursor-pointer">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${entry.type === "revenue" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                      {entry.type === "revenue" ? "↑ Revenue" : "↓ Expense"}
                                    </span>
                                    <p className="text-slate-600">{entry.notes}</p>
                                  </div>
                                  <p className={`font-bold whitespace-nowrap ml-4 ${entry.type === "revenue" ? "text-emerald-600" : "text-rose-500"}`}>
                                    {entry.type === "revenue" ? "+" : "−"}{fmt(entry.amount)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Settlement entries */}
                      {settlementEntries.map(entry => {
                        const method = parseMethod(entry.notes || "");
                        return (
                          <div key={entry.id}
                            onClick={() => setSelectedEntry(entry)}
                            className={`rounded-xl border px-4 py-3 flex items-center justify-between text-sm cursor-pointer hover:brightness-95 transition-all ${entry.type === "write_off" ? "border-slate-200 bg-slate-50" : "border-emerald-200 bg-emerald-50/60"}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{METHOD_ICON[method] || "💵"}</span>
                              <div>
                                <Badge color={entry.type === "write_off" ? "slate" : "green"} className="mb-1">
                                  {entry.type === "write_off" ? "Adjustment" : "Settlement"}
                                </Badge>
                                <p className="text-xs text-slate-600 mt-1">{entry.notes}</p>
                              </div>
                            </div>
                            <div className="text-right ml-4 whitespace-nowrap">
                              <p className={`font-bold text-sm ${entry.type === "write_off" ? "text-slate-700" : "text-emerald-700"}`}>−{fmt(entry.amount)}</p>
                              {entry.settlement_id && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteSettlement(entry.settlement_id); }}
                                  className="block w-full text-right mt-0.5 text-rose-400 hover:text-rose-600 font-bold text-[10px]"
                                >Undo</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Entry Detail Side Panel ────────────────────────────────────────── */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm bg-white shadow-2xl border-l border-slate-100 flex flex-col" style={{ animation: "slideInRight 0.2s ease-out" }}>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800">Entry Details</h3>
                <p className="text-xs text-slate-500">{selectedEntry.date}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">✕</button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Type badge */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Type</p>
                <Badge color={selectedEntry.type === "revenue" ? "blue" : selectedEntry.type === "expense_paid" ? "amber" : selectedEntry.type === "write_off" ? "slate" : "green"}>
                  {selectedEntry.type === "revenue" ? "Trip Revenue" : selectedEntry.type === "expense_paid" ? "Trip Expense" : selectedEntry.type === "write_off" ? "Adjustment / Write-Off" : "Settlement"}
                </Badge>
              </div>

              {/* Amount */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Amount</p>
                <p className={`text-2xl font-black ${selectedEntry.type === "revenue" ? "text-emerald-600" : "text-rose-600"}`}>
                  {selectedEntry.type === "revenue" ? "+" : "−"} {fmt(selectedEntry.amount)}
                </p>
              </div>

              {/* Method (for settlements) */}
              {(selectedEntry.type === "remittance" || selectedEntry.type === "write_off") && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Payment Method</p>
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <span className="text-xl">{METHOD_ICON[parseMethod(selectedEntry.notes || "")] || "💵"}</span>
                    <span>{parseMethod(selectedEntry.notes || "")}</span>
                  </div>
                </div>
              )}

              {/* Location */}
              {selectedEntry.trips?.location && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Location</p>
                  <p className="text-slate-700 font-semibold">📍 {selectedEntry.trips.location}</p>
                </div>
              )}

              {/* Trip reference */}
              {selectedEntry.trips?.trip_number && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Trip Reference</p>
                  <p className="text-slate-700 font-semibold">Trip #{selectedEntry.trips.trip_number}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Notes</p>
                <p className="text-slate-700 bg-slate-50 rounded-xl p-3 text-sm leading-relaxed border border-slate-100">{selectedEntry.notes || "No notes recorded."}</p>
              </div>

              {/* Running balance */}
              {selectedEntry.runningBalance !== undefined && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Running Balance at this point</p>
                  <p className={`text-lg font-black ${selectedEntry.runningBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(selectedEntry.runningBalance)}</p>
                </div>
              )}

              {/* Archived badge */}
              {selectedEntry.statement_id && (
                <div className="rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-xs text-slate-600">
                  📂 This entry is part of a <strong>closed period</strong> and has been archived.
                </div>
              )}

              {/* Undo settlement */}
              {(selectedEntry.type === "remittance" || selectedEntry.type === "write_off") && selectedEntry.settlement_id && (
                <button
                  onClick={() => { setSelectedEntry(null); handleDeleteSettlement(selectedEntry.settlement_id); }}
                  className="w-full rounded-xl border border-rose-200 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  Undo / Delete this Settlement
                </button>
              )}
            </div>
          </div>
          {/* Backdrop */}
          <div className="absolute inset-0 -z-10 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedEntry(null)} />
        </div>
      )}

      {/* ── Settlement Modal ─────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Record Settlement — ${activeBroker?.name || ""}${activeLorry !== "all" ? ` (${activeLorry})` : ""}`}>
        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800">
          <p className="font-bold mb-1">What is a Settlement?</p>
          <p>This is used when a broker pays you the money they collected from trips. Recording a settlement automatically distributes the payment across their oldest unpaid trips and marks them as Paid. If you make a mistake, you can click "Undo" next to the settlement in the ledger.</p>
        </div>
        <form onSubmit={handleSettle} className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-4 border border-amber-100 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> This payment will be automatically applied to the oldest unpaid trips for <strong>{activeBroker?.name}</strong>
              {activeLorry !== "all" ? <> — <strong className="text-blue-700">{activeLorry} only</strong> — other vehicles are not affected.</> : <> first (FIFO across all vehicles).</>}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Amount (KES)</label>
            <input type="number" required min="1" className={inp} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Payment Date</label>
            <input type="date" required className={inp} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Method</label>
            <select className={inp} value={form.method} onChange={e => {
              const newMethod = e.target.value;
              setForm(prev => {
                const isDefault = !prev.notes || prev.notes.startsWith("Payment via ") || prev.notes.startsWith("Settlement via ");
                return { ...prev, method: newMethod, notes: isDefault ? `Payment via ${newMethod}` : prev.notes };
              });
            }}>
              <option>Cash</option>
              <option>M-Pesa</option>
              <option>Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Notes (Optional)</label>
            <textarea className={inp} rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Applying..." : "Apply Payment"}</button>
          </div>
        </form>
      </Modal>

      {/* ── Write-Off Modal ──────────────────────────────────────────────── */}
      <Modal open={writeOffModalOpen} onClose={() => setWriteOffModalOpen(false)} title={`Write-Off Balance — ${activeBroker?.name || ""}`}>
        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800">
          <p className="font-bold mb-1">What is a Write-Off?</p>
          <p>Use this to close off old trip balances without recording actual cash received. This will mark the oldest unpaid trips as Paid and reduce the outstanding balance, categorizing it as an Adjustment rather than Remitted Cash.</p>
        </div>
        <form onSubmit={handleWriteOff} className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-4 border border-amber-100 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> This will be automatically applied to the oldest unpaid trips for <strong>{activeBroker?.name}</strong> first (FIFO).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Amount (KES)</label>
            <input type="number" required min="1" className={inp} value={writeOffForm.amount} onChange={e => setWriteOffForm({ ...writeOffForm, amount: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Adjustment Date</label>
            <input type="date" required className={inp} value={writeOffForm.date} onChange={e => setWriteOffForm({ ...writeOffForm, date: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Notes / Reason</label>
            <textarea className={inp} rows="2" required value={writeOffForm.notes} onChange={e => setWriteOffForm({ ...writeOffForm, notes: e.target.value })}></textarea>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setWriteOffModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-900 disabled:opacity-50">{saving ? "Applying..." : "Confirm Write-Off"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
