import { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today } from "../utils/helpers";
import { Modal, StatCard, Badge } from "../components/ui";

export default function BrokerAccountPage({ isAdmin, brokers = [] }) {
  const [activeBrokerId, setActiveBrokerId] = useState("");
  const [ledger, setLedger] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "Cash", date: today(), notes: "" });

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

  const { totalRevenue, totalExpenses, totalRemitted, currentBalance } = useMemo(() => {
    let tr = 0, te = 0, trm = 0, cb = 0;
    ledger.forEach(entry => {
      const amt = Number(entry.amount || 0);
      if (entry.type === "revenue") { tr += amt; cb += amt; }
      else if (entry.type === "expense_paid") { te += amt; cb -= amt; }
      else if (entry.type === "remittance") { trm += amt; cb -= amt; }
      entry.runningBalance = cb;
    });
    return { totalRevenue: tr, totalExpenses: te, totalRemitted: trm, currentBalance: cb };
  }, [ledger]);

  const handleSettle = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0) return alert("Amount must be positive");
    try {
      await financeService.makeBrokerSettlement(activeBrokerId, form.amount, {
        date: form.date, method: form.method, notes: form.notes
      });
      setModalOpen(false);
      setForm({ amount: "", method: "Cash", date: today(), notes: "" });
    } catch (err) {
      alert("Error: " + err.message);
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
              {[...ledger].reverse().map((entry, idx) => (
                <tr key={entry.id || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap font-medium">{entry.date}</td>
                  <td className="px-4 py-3">
                    <Badge color={entry.type === "revenue" ? "blue" : entry.type === "expense_paid" ? "amber" : "green"}>
                      {entry.type === "revenue" ? "Trip Revenue" : entry.type === "expense_paid" ? "Expense Paid" : "Settlement"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 truncate max-w-[200px]">{entry.notes}</td>
                  <td className="px-4 py-3 text-right text-rose-500 font-semibold">
                    {entry.type !== "revenue" ? fmt(entry.amount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                    {entry.type === "revenue" ? fmt(entry.amount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(entry.runningBalance)}</td>
                </tr>
              ))}
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
            <select className={inp} value={form.method} onChange={e => setForm({...form, method: e.target.value})}>
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
            <button type="submit" className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700">Apply Payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
