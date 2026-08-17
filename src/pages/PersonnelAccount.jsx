import React, { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today, getWeekRange, getMonthRange } from "../utils/helpers";
import { Modal, StatCard, Badge } from "../components/ui";

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
function PersonnelTransactionModal({ open, onClose, personnel, onSuccess, initialData = null }) {
  const isEdit = !!initialData;
  const [direction, setDirection] = useState("OUT"); // "OUT" = Payment to them (Deduction/Expense), "IN" = Earning
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setDirection(initialData.type === "earning" ? "IN" : "OUT");
      setAmount(initialData.amount || "");
      setDate(initialData.date || today());
      setNotes(initialData.notes || "");
    } else if (open) {
      // Reset defaults for new
      setDirection("OUT");
      setAmount("");
      setDate(today());
      setNotes("");
    }
  }, [open, initialData]);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return alert("Enter a valid amount.");
    setSaving(true);
    try {
      const type = direction === "IN" ? "earning" : "payment";
      
      if (isEdit) {
        await financeService.updatePersonnelLedgerEntry(initialData.id, {
          amount, date, notes, type
        });
      } else {
        await financeService.addPersonnelLedgerEntry(personnel.id, amount, { date, notes, type });
      }
      
      onSuccess?.(); 
      onClose();
    } catch (e) { 
      alert("Error: " + e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const inp = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 transition-all";

  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="-mx-5 -mt-5 mb-5 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-6 pt-6 pb-5 rounded-t-2xl">
        <h2 className="text-xl font-black text-white">{isEdit ? "Edit Transaction" : "Record Transaction"}</h2>
        <p className="text-blue-200 text-sm mt-0.5">{personnel?.name}</p>
      </div>

      <div className="space-y-5">
        {/* IN / OUT */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDirection("OUT")}
            className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-all ${
              direction === "OUT" ? "border-rose-200 bg-rose-50 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            📉 Payment (Deduct)
          </button>
          <button
            type="button"
            onClick={() => setDirection("IN")}
            className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-all ${
              direction === "IN" ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            📈 Earning (Credit)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Amount (KES)</label>
            <input type="number" min="1" required className={inp} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
            <input type="date" required className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Notes / Description</label>
          <textarea rows="2" className={inp} placeholder="e.g. Weekly advance, Bonus..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !amount}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition-all ${
              saving || !amount ? "bg-slate-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
            }`}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Record Transaction"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AccountSettingsModal({ open, onClose, startDate, setStartDate }) {
  const [tempDate, setTempDate] = useState(startDate);
  
  useEffect(() => {
    if (open) setTempDate(startDate);
  }, [open, startDate]);

  return (
    <Modal open={open} onClose={onClose} title="Account Settings">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Show transactions starting from</label>
          <input 
            type="date" 
            value={tempDate} 
            onChange={(e) => setTempDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <p className="text-xs text-slate-500 mt-2">Transactions before this date will be hidden, but will still count towards your balance.</p>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button onClick={() => { setTempDate(""); setStartDate(""); onClose(); }} className="px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl">Clear Range</button>
          <div className="flex-1"></div>
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button onClick={() => { setStartDate(tempDate); onClose(); }} className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-md">Save Settings</button>
        </div>
      </div>
    </Modal>
  );
}

export default function PersonnelAccountPage({ isAdmin, personnelId, personnelList = [] }) {
  const [ledger, setLedger] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  
  // Filters
  const [period, setPeriod] = useState(() => localStorage.getItem("wt_personnel_period") || "month");
  const [customStart, setCustomStart] = useState(() => localStorage.getItem("wt_personnel_customStart") || "");
  const [customEnd, setCustomEnd] = useState(() => localStorage.getItem("wt_personnel_customEnd") || "");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState(() => localStorage.getItem("wt_personnel_selectedId") || "");
  const [ledgerStartDate, setLedgerStartDate] = useState(() => localStorage.getItem("wt_personnel_ledgerStartDate") || "");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persist filters when they change
  useEffect(() => {
    localStorage.setItem("wt_personnel_period", period);
    localStorage.setItem("wt_personnel_customStart", customStart);
    localStorage.setItem("wt_personnel_customEnd", customEnd);
    localStorage.setItem("wt_personnel_selectedId", selectedPersonnelId);
    localStorage.setItem("wt_personnel_ledgerStartDate", ledgerStartDate);
  }, [period, customStart, customEnd, selectedPersonnelId, ledgerStartDate]);

  const activePersonnelId = isAdmin && personnelList.length > 0 
    ? (selectedPersonnelId || personnelId || personnelList[0]?.id) 
    : personnelId;

  const personnel = useMemo(() => personnelList.find(p => p.id === activePersonnelId) || {}, [personnelList, activePersonnelId]);

  useEffect(() => {
    if (!activePersonnelId) return;
    const unsub = financeService.subscribePersonnelLedger(activePersonnelId, setLedger);
    return () => unsub();
  }, [activePersonnelId]);

  const toggleTrip = (id) => {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  };

  const handleDelete = async (entry) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await financeService.deletePersonnelLedgerEntry(entry.id);
    } catch (err) {
      alert("Error deleting entry: " + err.message);
    }
  };

  // Filter & Group Ledger
  const { totalEarned, totalPaid, currentBalance, filteredGroupedLedger } = useMemo(() => {
    let te = 0, tp = 0, cb = 0;
    const groups = [];
    const tripMap = new Map();

    // Calculate balances for ALL entries to get true current balance
    ledger.forEach(entry => {
      const amt = Number(entry.amount || 0);
      if (entry.type === "earning") { te += amt; cb += amt; }
      else if (entry.type === "payment") { tp += amt; cb -= amt; }
      entry.runningBalance = cb;
    });

    // Then filter what is DISPLAYED based on the period filter and ledgerStartDate setting
    const filteredLedger = ledger.filter(entry => {
      if (ledgerStartDate && new Date(entry.date) < new Date(ledgerStartDate)) return false;
      return isWithinPeriod(entry.date, period, customStart, customEnd);
    });

    // Group the filtered ledger
    filteredLedger.forEach(entry => {
      const amt = Number(entry.amount || 0);
      
      if (entry.type === "payment" || !entry.trip_id) {
        groups.push({ isGroup: false, ...entry });
      } else {
        if (!tripMap.has(entry.trip_id)) {
          const tripName = entry.notes.split(' - ')[0].replace(' Earnings', '').replace(' Expenses Reimbursed', '');
          const newGroup = {
            isGroup: true,
            id: entry.trip_id,
            trip_id: entry.trip_id,
            date: entry.date,
            notes: tripName,
            earnings: 0,
            items: [],
            runningBalance: entry.runningBalance // use latest
          };
          tripMap.set(entry.trip_id, newGroup);
          groups.push(newGroup);
        }
        const group = tripMap.get(entry.trip_id);
        group.items.push(entry);
        if (entry.type === "earning") group.earnings += amt;
        group.runningBalance = entry.runningBalance; 
      }
    });

    return { totalEarned: te, totalPaid: tp, currentBalance: cb, filteredGroupedLedger: groups.reverse() };
  }, [ledger, period, customStart, customEnd]);

  if (!activePersonnelId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <div>
          <div className="text-4xl mb-4 text-slate-300">👤</div>
          <h3 className="text-lg font-bold text-slate-700">No Personnel Found</h3>
          <p className="text-sm text-slate-500 mt-1">Please ensure your account is properly linked to a personnel record.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-slate-800">
            {isAdmin ? "Personnel Ledger" : `My Account: ${personnel.name || "Personnel"}`}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Earnings, payments, and deductions.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Personnel Selector */}
          {isAdmin && personnelList.length > 0 && (
            <select
              value={activePersonnelId || ""}
              onChange={e => setSelectedPersonnelId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
            >
              {personnelList.filter(p => p.status !== "Inactive" || p.id === activePersonnelId).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
              ))}
            </select>
          )}

          {/* Period Filter */}
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
            {["all", "today", "week", "month", "custom"].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Action Button */}
          {isAdmin && activePersonnelId && (
            <button 
              onClick={() => { setEditingEntry(null); setModalOpen(true); }} 
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              Record Transaction
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-sm transition-all"
            title="Account Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <AccountSettingsModal 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        startDate={ledgerStartDate} 
        setStartDate={setLedgerStartDate} 
      />

      {period === "custom" && (
        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm w-fit">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
          <span className="text-slate-400 font-medium">to</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Earned (All Time)" value={fmt(totalEarned)} icon="💰" color="blue" />
        <StatCard label="Total Paid (All Time)" value={fmt(totalPaid)} icon="📉" color="slate" />
        <StatCard label="Current Balance" value={fmt(currentBalance)} icon="💵" color={currentBalance > 0 ? "emerald" : "red"} />
      </div>

      {/* Ledger List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Transaction History</h3>
        </div>
        
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredGroupedLedger.map((row, idx) => {
            if (!row.isGroup) {
              return (
                <div key={row.id || idx} className="p-4 bg-white">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-xs font-black text-slate-400 mb-1">{row.date}</div>
                      <Badge color={row.type === "earning" ? "emerald" : "rose"}>
                        {row.type === "earning" ? "Earning" : "Payment"}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className={`font-black ${row.type === "earning" ? "text-emerald-600" : "text-rose-600"}`}>
                        {row.type === "payment" ? "-" : "+"}{fmt(row.amount)}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1">Bal: {fmt(row.runningBalance)}</div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{row.notes}</p>
                  
                  {isAdmin && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50">
                      <button onClick={() => handleEdit(row)} className="text-xs font-bold text-blue-600 px-3 py-1.5 bg-blue-50 rounded-lg">Edit</button>
                      <button onClick={() => handleDelete(row)} className="text-xs font-bold text-rose-600 px-3 py-1.5 bg-rose-50 rounded-lg">Delete</button>
                    </div>
                  )}
                </div>
              );
            }

            const isExpanded = expandedTrips.has(row.trip_id);
            return (
              <div key={row.trip_id} className="p-4 bg-slate-50/50">
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => toggleTrip(row.trip_id)}
                >
                  <div>
                    <div className="text-xs font-black text-slate-400 mb-1">{row.date}</div>
                    <Badge color="purple">Trip Earnings</Badge>
                    <p className="text-sm font-semibold text-slate-800 mt-1">{row.notes}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-600">+{fmt(row.earnings)}</div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1">Bal: {fmt(row.runningBalance)}</div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-3 pl-4 border-l-2 border-slate-200 space-y-3">
                    {row.items.map(item => (
                      <div key={item.id} className="text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-600">{item.notes}</span>
                          <span className="font-bold text-emerald-600">+{fmt(item.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filteredGroupedLedger.length === 0 && (
            <div className="p-8 text-center text-slate-400">No transactions found for this period.</div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Notes</th>
                <th className="px-5 py-3.5 text-right">Debit (-)</th>
                <th className="px-5 py-3.5 text-right">Credit (+)</th>
                <th className="px-5 py-3.5 text-right">Balance</th>
                {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGroupedLedger.map((row, idx) => {
                if (!row.isGroup) {
                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-slate-700">{row.date}</td>
                      <td className="px-5 py-3.5">
                        <Badge color={row.type === "earning" ? "emerald" : "rose"}>
                          {row.type === "earning" ? "Earning" : "Payment"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 truncate max-w-[250px]">{row.notes}</td>
                      <td className="px-5 py-3.5 text-right text-rose-500 font-bold">
                        {row.type === "payment" ? fmt(row.amount) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-emerald-600 font-bold">
                        {row.type === "earning" ? fmt(row.amount) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(row.runningBalance)}</td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(row)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(row)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }

                const isExpanded = expandedTrips.has(row.trip_id);
                return (
                  <React.Fragment key={row.trip_id}>
                    <tr 
                      onClick={() => toggleTrip(row.trip_id)} 
                      className="hover:bg-slate-100 transition-colors cursor-pointer border-b border-slate-100 bg-slate-50/40"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-slate-700">
                        {row.date}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge color="purple">Trip Earnings</Badge>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800 flex items-center gap-2">
                        {row.notes} 
                        <span className={`text-[10px] bg-slate-200 text-slate-500 rounded-full p-0.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-300 font-medium">—</td>
                      <td className="px-5 py-3.5 text-right text-emerald-600 font-bold">
                        {row.earnings > 0 ? fmt(row.earnings) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(row.runningBalance)}</td>
                      {isAdmin && <td className="px-5 py-3.5"></td>}
                    </tr>
                    
                    {isExpanded && row.items.map(item => (
                      <tr key={item.id} className="bg-white text-xs border-b border-slate-50 last:border-b-0">
                        <td className="px-5 py-2 pl-10 text-slate-400 font-medium">{item.date}</td>
                        <td className="px-5 py-2">
                          <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-500 bg-slate-50 font-semibold uppercase tracking-wider">
                            Item
                          </span>
                        </td>
                        <td className="px-5 py-2 text-slate-600 truncate max-w-[250px] font-medium">{item.notes}</td>
                        <td className="px-5 py-2 text-right text-slate-300">—</td>
                        <td className="px-5 py-2 text-right text-emerald-500 font-bold">{fmt(item.amount)}</td>
                        <td className="px-5 py-2 text-right text-slate-300">...</td>
                        {isAdmin && <td className="px-5 py-2"></td>}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredGroupedLedger.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-5 py-12 text-center text-slate-400">
                    No transactions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PersonnelTransactionModal 
        open={modalOpen} 
        onClose={() => { setModalOpen(false); setEditingEntry(null); }} 
        personnel={personnel}
        initialData={editingEntry}
      />
    </div>
  );
}
