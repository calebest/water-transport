import React, { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today } from "../utils/helpers";
import { Modal, StatCard, Badge } from "../components/ui";

export default function BrokerAccountPage({ isAdmin, brokers = [] }) {
  const [activeBrokerId, setActiveBrokerId] = useState("");
  const [ledger, setLedger] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "Cash", date: today(), notes: "Payment via Cash" });

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
    if (!activeBrokerId) {
      setLedger([]);
      return;
    }
    const unsub = financeService.subscribeBrokerLedger(activeBrokerId, setLedger);
    return () => unsub();
  }, [activeBrokerId]);

  const activeBroker = useMemo(() => brokers.find(b => b.id === activeBrokerId), [brokers, activeBrokerId]);

  const { totalRevenue, totalExpenses, totalRemitted, currentBalance, groupedLedger } = useMemo(() => {
    let tr = 0, te = 0, trm = 0, cb = 0;
    const groups = [];
    const tripMap = new Map();

    ledger.forEach(entry => {
      const amt = Number(entry.amount || 0);
      if (entry.type === "revenue") { tr += amt; cb += amt; }
      else if (entry.type === "expense_paid") { te += amt; cb -= amt; }
      else if (entry.type === "remittance") { trm += amt; cb -= amt; }
      
      entry.runningBalance = cb;

      if (entry.type === "remittance" || !entry.trip_id) {
        groups.push({ isGroup: false, ...entry });
      } else {
        if (!tripMap.has(entry.trip_id)) {
          const tripName = entry.notes.split(' - ')[0].replace(' Expenses Paid', '');
          const location = entry.trips?.location || "";
          const newGroup = {
            isGroup: true,
            id: entry.trip_id,
            trip_id: entry.trip_id,
            date: entry.date,
            notes: tripName,
            location,
            revenue: 0,
            expenses: 0,
            items: [],
            runningBalance: 0
          };
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
    // Sort: newest date first, then trip number ascending within same date, remittances last within a date
    const sorted = groups.sort((a, b) => {
      const dateCompare = (b.date || "").localeCompare(a.date || "");
      if (dateCompare !== 0) return dateCompare;
      // remittances/non-trip go after trip groups on the same date
      if (a.isGroup && !b.isGroup) return -1;
      if (!a.isGroup && b.isGroup) return 1;
      // both trip groups — sort by trip number numerically
      const numA = parseInt(String(a.notes || "0").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.notes || "0").replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
    return { totalRevenue: tr, totalExpenses: te, totalRemitted: trm, currentBalance: cb, groupedLedger: sorted };
  }, [ledger]);

  const handleSettle = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0) return alert("Amount must be positive");
    setSaving(true);
    try {
      await financeService.makeBrokerSettlement(activeBrokerId, form.amount, {
        date: form.date, method: form.method, notes: form.notes
      });
      setModalOpen(false);
      setForm({ amount: "", method: "Cash", date: today(), notes: "Payment via Cash" });
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (!confirm("Are you sure you want to delete this settlement? This will reverse the paid status of all associated trips and revert their balances. This action cannot be undone.")) return;
    try {
      await financeService.deleteBrokerSettlement(settlementId);
    } catch (e) {
      alert("Error deleting settlement: " + e.message);
    }
  };

  const inp = "w-full rounded-xl border border-slate-200 p-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  if (brokers.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <div>
          <div className="text-5xl mb-4">🏢</div>
          <h3 className="text-lg font-bold text-slate-700">No Brokers Yet</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-xs">
            Go to the <strong>Brokers</strong> page to add your first broker, then assign trips to them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-slate-800">Broker Ledger</h2>
          <p className="text-slate-500 text-sm mt-1">Financial tracking and settlements per broker.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Broker Selector */}
          <select
            value={activeBrokerId}
            onChange={e => setActiveBrokerId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 shadow-sm min-w-[160px]"
          >
            {brokers.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.company ? ` — ${b.company}` : ""}</option>
            ))}
          </select>
          {isAdmin && activeBrokerId && (
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 transition-colors"
            >
              Record Settlement
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Outstanding Balance" value={fmt(currentBalance)} icon="💸" color={currentBalance > 0 ? "red" : "slate"} />
        <StatCard label="Total Revenue (Trips)" value={fmt(totalRevenue)} icon="💰" color="blue" />
        <StatCard label="Expenses Paid by Broker" value={fmt(totalExpenses)} icon="📉" color="amber" />
        <StatCard label="Total Remitted" value={fmt(totalRemitted)} icon="🏦" color="green" />
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">
            Ledger History — <span className="text-emerald-600">{activeBroker?.name || "..."}</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Notes / Trip</th>
                <th className="px-4 py-3 text-right">Debit (-)</th>
                <th className="px-4 py-3 text-right">Credit (+)</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedLedger.map((row, idx) => {
                if (!row.isGroup) {
                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{row.date}</td>
                      <td className="px-4 py-3">
                        <Badge color={row.type === "revenue" ? "blue" : row.type === "expense_paid" ? "amber" : "green"}>
                          {row.type === "revenue" ? "Trip Revenue" : row.type === "expense_paid" ? "Expense Paid" : "Settlement"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 truncate max-w-[200px]">
                        {row.notes}
                        {row.type === "remittance" && row.settlement_id && (
                          <button onClick={() => handleDeleteSettlement(row.settlement_id)} className="ml-3 text-rose-400 hover:text-rose-600 font-bold text-xs" title="Undo / Delete this Settlement">
                            Undo
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-500 font-semibold">
                        {row.type !== "revenue" ? fmt(row.amount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {row.type === "revenue" ? fmt(row.amount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(row.runningBalance)}</td>
                    </tr>
                  );
                }

                const isExpanded = expandedTrips.has(row.trip_id);
                return (
                  <React.Fragment key={row.trip_id}>
                    <tr 
                      onClick={() => toggleTrip(row.trip_id)} 
                      className="hover:bg-slate-100 transition-colors cursor-pointer border-b border-slate-100 group bg-slate-50/30"
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                        {row.date}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color="purple">{row.location ? row.location : "Trip Summary"}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                        {row.notes} 
                        <span className={`text-xs text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                      </td>
                      <td className="px-4 py-3 text-right text-rose-500 font-semibold">
                        {row.expenses > 0 ? fmt(row.expenses) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {row.revenue > 0 ? fmt(row.revenue) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(row.runningBalance)}</td>
                    </tr>
                    
                    {isExpanded && row.items.map(item => (
                      <tr key={item.id} className="bg-slate-50/80 text-xs border-b border-slate-50 last:border-b-0">
                        <td className="px-4 py-2 pl-8 text-slate-400">{item.date}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-md ${item.type === "revenue" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                            {item.type === "revenue" ? "Revenue" : "Expense"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600 truncate max-w-[200px]">{item.notes}</td>
                        <td className="px-4 py-2 text-right text-rose-400">{item.type !== "revenue" ? fmt(item.amount) : "—"}</td>
                        <td className="px-4 py-2 text-right text-emerald-500">{item.type === "revenue" ? fmt(item.amount) : "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-400">...</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                    No ledger entries for {activeBroker?.name || "this broker"} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Record Settlement — ${activeBroker?.name || ""}`}>
        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800">
          <p className="font-bold mb-1">What is a Settlement?</p>
          <p>This is used when a broker pays you the money they collected from trips. Recording a settlement automatically distributes the payment across their oldest unpaid trips and marks them as Paid. If you make a mistake, you can click "Undo" next to the settlement in the ledger.</p>
        </div>
        <form onSubmit={handleSettle} className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-4 border border-amber-100 mb-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> This payment will be automatically applied to the oldest unpaid trips for <strong>{activeBroker?.name}</strong> first (FIFO).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Amount (KES)</label>
            <input type="number" required min="1" className={inp} value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Payment Date</label>
            <input type="date" required className={inp} value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
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
            <textarea className={inp} rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}></textarea>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Applying..." : "Apply Payment"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
