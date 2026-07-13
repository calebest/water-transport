import React, { useState, useEffect, useMemo } from "react";
import { financeService } from "../services/finance";
import { fmt, today } from "../utils/helpers";
import { Modal, StatCard, Badge } from "../components/ui";

export default function BrokerAccountPage({ isAdmin, brokers = [] }) {
  const [activeBrokerId, setActiveBrokerId] = useState("");
  const [ledger, setLedger] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState(new Set());
  const [activeTab, setActiveTab] = useState("ledger");
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

  const dateGroups = useMemo(() => {
    const groups = {};
    const sortLedger = (a, b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;
      const numA = parseInt(String(a.trips?.trip_number || a.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.trips?.trip_number || b.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;
      if (a.type === "remittance" && b.type !== "remittance") return 1;
      if (a.type !== "remittance" && b.type === "remittance") return -1;
      return 0;
    };

    const sortedLedger = [...ledger].sort(sortLedger);
    let runningBalance = 0;

    sortedLedger.forEach(entry => {
      const date = entry.date || "No Date";
      if (!groups[date]) {
        groups[date] = {
          date,
          entries: [],
          totalRevenue: 0,
          totalExpenses: 0,
          totalRemitted: 0,
          netChange: 0,
          openingBalance: runningBalance,
          closingBalance: 0,
        };
      }
      const group = groups[date];
      const amt = Number(entry.amount || 0);
      if (entry.type === "revenue") {
        group.totalRevenue += amt;
        group.netChange += amt;
        runningBalance += amt;
      } else if (entry.type === "expense_paid") {
        group.totalExpenses += amt;
        group.netChange -= amt;
        runningBalance -= amt;
      } else if (entry.type === "remittance") {
        group.totalRemitted += amt;
        group.netChange -= amt;
        runningBalance -= amt;
      }
      group.entries.push(entry);
      group.closingBalance = runningBalance;
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [ledger]);

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
    return { totalRevenue: tr, totalExpenses: te, totalRemitted: trm, currentBalance: cb, groupedLedger: groups.reverse() };
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
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1">
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${activeTab === "ledger" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Ledger View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("date")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${activeTab === "date" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Date History
            </button>
          </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Outstanding Balance" value={fmt(currentBalance)} icon="💸" color={currentBalance > 0 ? "red" : "slate"} />
        <StatCard label="Total Revenue (Trips)" value={fmt(totalRevenue)} icon="💰" color="blue" />
        <StatCard label="Expenses Paid by Broker" value={fmt(totalExpenses)} icon="📉" color="amber" />
        <StatCard label="Total Remitted" value={fmt(totalRemitted)} icon="🏦" color="green" />
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            {activeTab === "ledger" ? "Ledger History" : "Date-by-Date History"} — <span className="text-emerald-600">{activeBroker?.name || "..."}</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          {activeTab === "ledger" ? (
            <table className="w-full text-left text-xs sm:text-sm text-slate-600">
              <thead className="bg-slate-50 text-[10px] sm:text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Date</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Type</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3">Notes / Trip</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Debit (-)</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Credit (+)</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedLedger.map((row, idx) => {
                  if (!row.isGroup) {
                    return (
                      <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap font-medium">{row.date}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <Badge color={row.type === "revenue" ? "blue" : row.type === "expense_paid" ? "amber" : "green"}>
                            {row.type === "revenue" ? "Trip Revenue" : row.type === "expense_paid" ? "Expense Paid" : "Settlement"}
                          </Badge>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 truncate max-w-[200px]">
                          {row.notes}
                          {row.type === "remittance" && row.settlement_id && (
                            <button onClick={() => handleDeleteSettlement(row.settlement_id)} className="ml-3 text-rose-400 hover:text-rose-600 font-bold text-xs" title="Undo / Delete this Settlement">
                              Undo
                            </button>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-rose-500 font-semibold">
                          {row.type !== "revenue" ? fmt(row.amount) : "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-emerald-600 font-semibold">
                          {row.type === "revenue" ? fmt(row.amount) : "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-bold text-slate-800">{fmt(row.runningBalance)}</td>
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
                        <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap font-medium text-slate-700">
                          {row.date}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <Badge color="purple">{row.location ? row.location : "Trip Summary"}</Badge>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-800 flex items-center gap-2">
                          {row.notes}
                          <span className={`text-xs text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-rose-500 font-semibold">
                          {row.expenses > 0 ? fmt(row.expenses) : "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-emerald-600 font-semibold">
                          {row.revenue > 0 ? fmt(row.revenue) : "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-bold text-slate-800">{fmt(row.runningBalance)}</td>
                      </tr>

                      {isExpanded && row.items.map(item => (
                        <tr key={item.id} className="bg-slate-50/80 text-[11px] sm:text-xs border-b border-slate-50 last:border-b-0">
                          <td className="px-3 sm:px-4 py-2 pl-6 sm:pl-8 text-slate-400">{item.date}</td>
                          <td className="px-3 sm:px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-md ${item.type === "revenue" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                              {item.type === "revenue" ? "Revenue" : "Expense"}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-slate-600 truncate max-w-[200px]">{item.notes}</td>
                          <td className="px-3 sm:px-4 py-2 text-right text-rose-400">{item.type !== "revenue" ? fmt(item.amount) : "—"}</td>
                          <td className="px-3 sm:px-4 py-2 text-right text-emerald-500">{item.type === "revenue" ? fmt(item.amount) : "—"}</td>
                          <td className="px-3 sm:px-4 py-2 text-right text-slate-400">...</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400 text-sm">
                      No ledger entries for {activeBroker?.name || "this broker"} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="space-y-6 p-4 sm:p-5">
              {dateGroups.map(dateGroup => {
                // Group entries by trip_id
                const tripGroups = {};
                const settlementEntries = [];

                dateGroup.entries.forEach(entry => {
                  if (entry.type === "remittance") {
                    settlementEntries.push(entry);
                  } else if (entry.trip_id) {
                    if (!tripGroups[entry.trip_id]) {
                      tripGroups[entry.trip_id] = {
                        trip_id: entry.trip_id,
                        trip_number: entry.trips?.trip_number || entry.notes?.match(/Trip (\d+)/)?.[1] || "",
                        location: entry.trips?.location || "",
                        entries: [],
                        totalRevenue: 0,
                        totalExpenses: 0,
                      };
                    }
                    const amt = Number(entry.amount || 0);
                    if (entry.type === "revenue") {
                      tripGroups[entry.trip_id].totalRevenue += amt;
                    } else if (entry.type === "expense_paid") {
                      tripGroups[entry.trip_id].totalExpenses += amt;
                    }
                    tripGroups[entry.trip_id].entries.push(entry);
                  }
                });

                const sortedTrips = Object.values(tripGroups).sort((a, b) => {
                  const numA = parseInt(String(a.trip_number).replace(/\D/g, ""), 10) || 0;
                  const numB = parseInt(String(b.trip_number).replace(/\D/g, ""), 10) || 0;
                  return numA - numB;
                });

                return (
                  <div key={dateGroup.date} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{dateGroup.date}</p>
                        <p className="text-xs text-slate-500">Date total for broker transactions</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm font-semibold">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Opening {fmt(dateGroup.openingBalance)}</span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Revenue {fmt(dateGroup.totalRevenue)}</span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Expenses {fmt(dateGroup.totalExpenses)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Remitted {fmt(dateGroup.totalRemitted)}</span>
                        <span className={`rounded-full px-3 py-1 ${dateGroup.netChange >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          Net {fmt(dateGroup.netChange)}
                        </span>
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-white">Closing {fmt(dateGroup.closingBalance)}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Trip Groups */}
                      {sortedTrips.map(trip => (
                        <div key={trip.trip_id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                          <div className="bg-slate-100/50 px-4 py-3 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-800">
                                Trip {trip.trip_number}
                                {trip.location && <span className="text-slate-600"> — {trip.location}</span>}
                              </h4>
                              <div className="flex gap-3 text-xs font-semibold">
                                {trip.totalRevenue > 0 && <span className="text-emerald-600">Revenue {fmt(trip.totalRevenue)}</span>}
                                {trip.totalExpenses > 0 && <span className="text-amber-600">Expenses {fmt(trip.totalExpenses)}</span>}
                                <span className={trip.totalRevenue - trip.totalExpenses >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                  Net {fmt(trip.totalRevenue - trip.totalExpenses)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {trip.entries.map(entry => (
                              <div key={entry.id} className="px-4 py-3 flex items-start justify-between hover:bg-slate-50 transition-colors text-sm">
                                <div className="flex-1">
                                  <Badge color={entry.type === "revenue" ? "blue" : "amber"} className="mb-1">
                                    {entry.type === "revenue" ? "Revenue" : "Expense"}
                                  </Badge>
                                  <p className="text-xs text-slate-600 mt-1">{entry.notes}</p>
                                </div>
                                <div className="text-right ml-4 whitespace-nowrap">
                                  <p className={`font-semibold ${entry.type === "revenue" ? "text-emerald-600" : "text-rose-500"}`}>
                                    {entry.type === "revenue" ? `+${fmt(entry.amount)}` : `-${fmt(entry.amount)}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Settlement Entries */}
                      {settlementEntries.map(entry => (
                        <div key={entry.id} className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3 flex items-start justify-between hover:bg-emerald-50 transition-colors text-sm">
                          <div className="flex-1">
                            <Badge color="green" className="mb-1">Settlement</Badge>
                            <p className="text-xs text-slate-600 mt-1">{entry.notes}</p>
                          </div>
                          <div className="text-right ml-4 whitespace-nowrap">
                            <p className="font-semibold text-emerald-600">-{fmt(entry.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {dateGroups.length === 0 && (
                <div className="p-8 text-center text-slate-400">No ledger history available yet.</div>
              )}
            </div>
          )}
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
    </div>
  );
}
