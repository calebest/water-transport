import React, { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today } from "../utils/helpers";
import { Modal, StatCard, Badge } from "../components/ui";

export default function PersonnelAccountPage({ isAdmin, personnelId, personnelList = [] }) {
  const [ledger, setLedger] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", date: today(), notes: "" });
  const [expandedTrips, setExpandedTrips] = useState(new Set());

  const toggleTrip = (id) => {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [selectedPersonnelId, setSelectedPersonnelId] = useState("");

  const activePersonnelId = isAdmin && personnelList.length > 0 
    ? (selectedPersonnelId || personnelId || personnelList[0]?.id) 
    : personnelId;

  const personnel = useMemo(() => personnelList.find(p => p.id === activePersonnelId) || {}, [personnelList, activePersonnelId]);

  useEffect(() => {
    if (!activePersonnelId) return;
    const unsub = financeService.subscribePersonnelLedger(activePersonnelId, setLedger);
    return () => unsub();
  }, [activePersonnelId]);

  const { totalEarned, totalPaid, currentBalance, groupedLedger } = useMemo(() => {
    let te = 0, tp = 0, cb = 0;
    const groups = [];
    const tripMap = new Map();

    ledger.forEach(entry => {
      const amt = Number(entry.amount || 0);
      if (entry.type === "earning") { te += amt; cb += amt; }
      else if (entry.type === "payment") { tp += amt; cb -= amt; }
      
      entry.runningBalance = cb;

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
            runningBalance: 0
          };
          tripMap.set(entry.trip_id, newGroup);
          groups.push(newGroup);
        }
        const group = tripMap.get(entry.trip_id);
        group.items.push(entry);
        
        if (entry.type === "earning") group.earnings += amt;
        group.runningBalance = cb;
      }
    });
    return { totalEarned: te, totalPaid: tp, currentBalance: cb, groupedLedger: groups.reverse() };
  }, [ledger]);

  const handlePay = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0) return alert("Amount must be positive");
    try {
      await financeService.makePersonnelPayment(activePersonnelId, form.amount, {
        date: form.date, notes: form.notes
      });
      setModalOpen(false);
      setForm({ amount: "", date: today(), notes: "" });
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black text-slate-800">
            {isAdmin ? "Personnel Ledger" : `My Account: ${personnel.name || "Personnel"}`}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Earnings and payment history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && personnelList.length > 0 && (
            <select
              value={activePersonnelId || ""}
              onChange={e => setSelectedPersonnelId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm min-w-[160px]"
            >
              {personnelList.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
              ))}
            </select>
          )}
          {isAdmin && activePersonnelId && (
            <button onClick={() => setModalOpen(true)} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-colors">
              Log Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Outstanding Balance" value={fmt(currentBalance)} icon="💸" color={currentBalance > 0 ? "red" : "slate"} />
        <StatCard label="Total Earned" value={fmt(totalEarned)} icon="💰" color="blue" />
        <StatCard label="Total Paid" value={fmt(totalPaid)} icon="✓" color="green" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Account Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Notes</th>
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
                        <Badge color={row.type === "earning" ? "blue" : "green"}>
                          {row.type === "earning" ? "Earning" : "Payment"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 truncate max-w-[200px]">{row.notes}</td>
                      <td className="px-4 py-3 text-right text-rose-500 font-semibold">
                        {row.type === "payment" ? fmt(row.amount) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {row.type === "earning" ? fmt(row.amount) : "-"}
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
                        <Badge color="purple">Trip Summary</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                        {row.notes} 
                        <span className={`text-xs text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                      </td>
                      <td className="px-4 py-3 text-right text-rose-500 font-semibold">—</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {row.earnings > 0 ? fmt(row.earnings) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(row.runningBalance)}</td>
                    </tr>
                    
                    {isExpanded && row.items.map(item => (
                      <tr key={item.id} className="bg-slate-50/80 text-xs border-b border-slate-50 last:border-b-0">
                        <td className="px-4 py-2 pl-8 text-slate-400">{item.date}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                            Earning
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600 truncate max-w-[200px]">{item.notes}</td>
                        <td className="px-4 py-2 text-right text-rose-400">—</td>
                        <td className="px-4 py-2 text-right text-emerald-500">{fmt(item.amount)}</td>
                        <td className="px-4 py-2 text-right text-slate-400">...</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-400">No ledger entries found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Log Payment to ${personnel.name || "Personnel"}`}>
        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Amount Paid (KES)</label>
            <input type="number" required min="1" max={currentBalance > 0 ? currentBalance : undefined} className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Payment Date</label>
            <input type="date" required className="w-full rounded-xl border border-slate-200 p-2.5" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Notes (Optional)</label>
            <textarea className="w-full rounded-xl border border-slate-200 p-2.5" rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}></textarea>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700">Log Payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
