import React, { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";

export default function BrokerReconciliation({ brokers = [] }) {
  const { user } = useAuth();
  const [activeBrokerId, setActiveBrokerId] = useState(() => localStorage.getItem("wt_broker_recon_activeId") || "");
  const [ledger, setLedger] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Persist state
  useEffect(() => {
    localStorage.setItem("wt_broker_recon_activeId", activeBrokerId);
  }, [activeBrokerId]);
  
  // Auto-select first active broker
  useEffect(() => {
    if (!activeBrokerId && brokers.length > 0) {
      const first = brokers.find(b => b.status === "Active") || brokers[0];
      if (first) setActiveBrokerId(first.id);
    }
  }, [brokers, activeBrokerId]);

  // Load ledger
  useEffect(() => {
    if (!activeBrokerId) {
      setLedger([]);
      return;
    }
    const unsub = financeService.subscribeBrokerLedger(activeBrokerId, setLedger);
    return () => unsub();
  }, [activeBrokerId]);

  // Filter only un-statemented records
  const unclosedRecords = useMemo(() => {
    return ledger.filter(e => !e.statement_id);
  }, [ledger]);

  const activeBroker = useMemo(() => brokers.find(b => b.id === activeBrokerId), [brokers, activeBrokerId]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === unclosedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unclosedRecords.map(r => r.id)));
    }
  };

  // Calculate totals of selected
  const totals = useMemo(() => {
    let revenue = 0, expenses = 0, remitted = 0, writeOff = 0, balance = 0;
    unclosedRecords.forEach(entry => {
      if (selectedIds.has(entry.id)) {
        const amt = Number(entry.amount || 0);
        if (entry.type === "revenue") { revenue += amt; balance += amt; }
        else if (entry.type === "expense_paid") { expenses += amt; balance -= amt; }
        else if (entry.type === "remittance") { remitted += amt; balance -= amt; }
        else if (entry.type === "write_off") { writeOff += amt; balance -= amt; }
      }
    });
    return { revenue, expenses, remitted, writeOff, balance };
  }, [unclosedRecords, selectedIds]);

  const handleCloseCycle = async () => {
    if (selectedIds.size === 0) return alert("Select at least one record to close.");
    
    // Warn if closing a non-zero balance
    if (Math.abs(totals.balance) > 0.01) {
      if (!confirm(`The selected records have an unbalanced remaining balance of ${fmt(totals.balance)}.\n\nUsually, you should only close a period when it zeros out (all trips are paid). Are you sure you want to close these anyway?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      const selectedEntries = unclosedRecords.filter(r => selectedIds.has(r.id));
      
      const tripIds = [...new Set(selectedEntries.filter(r => r.trip_id).map(r => r.trip_id))];
      const settlementIds = [...new Set(selectedEntries.filter(r => r.settlement_id).map(r => r.settlement_id))];
      const ledgerIds = selectedEntries.map(r => r.id);
      
      // Determine date range
      const dates = selectedEntries.map(r => r.date).filter(Boolean).sort();
      const startDate = dates.length > 0 ? dates[0] : today();
      const endDate = dates.length > 0 ? dates[dates.length - 1] : today();

      await financeService.closeBrokerPeriod(activeBrokerId, {
        startDate, endDate, tripIds, settlementIds, ledgerIds, totals, userId: user?.id
      });
      
      setSelectedIds(new Set());
      alert("Period closed successfully! These records have been archived and removed from your active ledger.");
    } catch (e) {
      alert("Error closing period: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (brokers.length === 0) return <div className="p-8 text-center">No Brokers</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Close Period</h2>
          <p className="text-sm font-medium text-slate-500">Reconcile and archive old trips & payments to maintain a clean ledger slate.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column: Broker Select & Totals */}
        <div className="md:w-80 space-y-6 shrink-0">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Select Broker</h3>
            <select
              value={activeBrokerId}
              onChange={(e) => { setActiveBrokerId(e.target.value); setSelectedIds(new Set()); }}
              className="w-full rounded-xl border border-slate-200 p-2.5 font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {brokers.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4 sticky top-6">
            <h3 className="text-sm font-bold text-slate-800">Selected Cycle Totals</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Revenue (Debits)</span>
                <span className="font-semibold text-slate-800">{fmt(totals.revenue)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Expenses (Credits)</span>
                <span className="font-semibold text-rose-500">{fmt(totals.expenses)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payments (Credits)</span>
                <span className="font-semibold text-rose-500">{fmt(totals.remitted + totals.writeOff)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between font-black text-lg">
                <span className="text-slate-800">Balance</span>
                <span className={totals.balance > 0 ? "text-slate-800" : (totals.balance < 0 ? "text-rose-500" : "text-emerald-500")}>
                  {fmt(totals.balance)}
                </span>
              </div>
            </div>

            <button
              onClick={handleCloseCycle}
              disabled={saving || selectedIds.size === 0}
              className={`w-full rounded-xl py-3 font-bold text-white transition-all ${
                saving || selectedIds.size === 0 ? "bg-slate-300 cursor-not-allowed" 
                : Math.abs(totals.balance) < 0.01 ? "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20" : "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20"
              }`}
            >
              {saving ? "Closing..." : (Math.abs(totals.balance) < 0.01 ? "Close Balanced Cycle" : "Close Unbalanced Cycle")}
            </button>
            {Math.abs(totals.balance) > 0.01 && selectedIds.size > 0 && (
              <p className="text-xs text-amber-700 text-center bg-amber-50 rounded-lg p-2">
                Warning: The selected records do not balance to zero. 
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Records */}
        <div className="flex-1 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col min-h-[60vh]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Unclosed Records</h3>
            <button 
              onClick={selectAll}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {selectedIds.size === unclosedRecords.length && unclosedRecords.length > 0 ? "Deselect All" : "Select All"}
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === unclosedRecords.length && unclosedRecords.length > 0}
                      onChange={selectAll}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unclosedRecords.map(row => (
                  <tr 
                    key={row.id} 
                    onClick={() => toggleSelect(row.id)}
                    className={`cursor-pointer transition-colors ${selectedIds.has(row.id) ? "bg-emerald-50/50" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(row.id)}
                        readOnly
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{row.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        row.type === "revenue" ? "bg-emerald-100 text-emerald-700" :
                        row.type === "expense_paid" ? "bg-rose-100 text-rose-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {row.type === "revenue" ? "Trip Revenue" : 
                         row.type === "expense_paid" ? "Trip Expense" : 
                         row.type === "remittance" ? "Payment" : "Adjustment"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {row.notes}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${row.type === "revenue" ? "text-emerald-600" : "text-rose-500"}`}>
                      {row.type === "revenue" ? "" : "-"} {fmt(row.amount)}
                    </td>
                  </tr>
                ))}
                {unclosedRecords.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-12 text-center text-slate-400">
                      No active records. All periods are closed!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
