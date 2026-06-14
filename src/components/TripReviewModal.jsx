import { useEffect, useMemo, useState } from "react";
import { Badge, Modal } from "./ui";
import { exportVoucher } from "../utils/export";
import { fmt } from "../utils/helpers";

const EXPENSE_LABELS = {
  water: "Water",
  diesel: "Diesel",
  petrol: "Petrol",
  police: "Police",
  driver: "Driver",
  conductor: "Conductor",
};

const statusColors = {
  Paid: "green",
  Pending: "amber",
  Partial: "amber",
};

const toAmount = (value) => Number(value || 0);

export default function TripReviewModal({
  trip,
  open = false,
  onClose,
  onMarkPaid,
  onEditTrip,
  ratePerTrip = 200,
}) {
  const [currentTrip, setCurrentTrip] = useState(trip);
  const [activeTab, setActiveTab] = useState("overview");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrentTrip(trip);
  }, [trip]);

  useEffect(() => {
    if (open) setActiveTab("overview");
  }, [open, trip?.id]);

  const expenseItems = useMemo(() => {
    if (!currentTrip?.expenses) return [];
    const fixed = Object.entries(EXPENSE_LABELS).map(([key, label]) => ({
      key,
      label,
      amount: toAmount(currentTrip.expenses?.[key]),
      isCustom: false,
    }));
    const custom = (currentTrip.expenses?.custom || []).map((item, index) => ({
      key: item.id || `${item.label || "custom"}-${index}`,
      label: item.label || "Custom",
      amount: toAmount(item.amount),
      isCustom: true,
    }));
    return [...fixed, ...custom].filter((item) => item.amount > 0);
  }, [currentTrip]);

  const revenue = toAmount(currentTrip?.revenue);
  const totalExpenses = toAmount(currentTrip?.totalExpenses);
  const profit = toAmount(currentTrip?.profit);
  const amountPaid = toAmount(currentTrip?.amountPaid);
  const balance = Math.max(revenue - amountPaid, 0);
  const expenseRatio = revenue > 0 ? Math.round((totalExpenses / revenue) * 100) : 0;
  const headerTone = profit < 0 ? "from-rose-500 to-red-600" : currentTrip?.status === "Paid" ? "from-emerald-500 to-teal-600" : "from-amber-500 to-orange-600";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "breakdown", label: "Breakdown" },
    { id: "details", label: "Details" },
    { id: "actions", label: "Actions" },
  ];

  const handleMarkPaid = async () => {
    if (!onMarkPaid || !currentTrip || currentTrip.status === "Paid") return;
    setSaving(true);
    try {
      await onMarkPaid(currentTrip);
      setCurrentTrip((prev) => prev ? { ...prev, status: "Paid", amountPaid: prev.revenue } : prev);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open && !!currentTrip} onClose={onClose} title={`Trip Review${currentTrip?.tripNumber ? ` #${currentTrip.tripNumber}` : ""}`} wide>
      {currentTrip && (
        <div className="space-y-5">
          <div className={`rounded-2xl bg-gradient-to-br ${headerTone} p-5 text-white shadow-lg`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Trip</p>
                <h3 className="mt-1 text-2xl font-black">{currentTrip.tripNumber || "N/A"}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge color="slate">{currentTrip.lorry || "N/A"}</Badge>
                  <Badge color={statusColors[currentTrip.status] || "slate"}>{currentTrip.status || "Pending"}</Badge>
                  <span className="text-sm text-white/80">{currentTrip.date || "No date"}</span>
                </div>
              </div>
              <div className="max-w-[14rem] rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Location</p>
                <p className="mt-1 break-words text-sm font-bold">{currentTrip.location || "N/A"}</p>
              </div>
            </div>
          </div>

          {currentTrip.overrideReason && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-bold">Override reason: </span>
              {currentTrip.overrideReason}
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${activeTab === tab.id ? "bg-slate-800 text-white shadow-md" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            {activeTab === "overview" && (
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Financial Snapshot</p>
                      <h4 className="mt-1 text-lg font-black text-slate-800">What this trip moved</h4>
                    </div>
                    <Badge color={profit >= 0 ? "green" : "red"}>{profit >= 0 ? "Healthy" : "Loss"}</Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Revenue", value: revenue, tone: "blue", pct: 100 },
                      { label: "Expenses", value: totalExpenses, tone: "red", pct: revenue > 0 ? Math.min((totalExpenses / revenue) * 100, 100) : 0 },
                      { label: "Net Profit", value: profit, tone: profit >= 0 ? "green" : "red", pct: revenue > 0 ? Math.min((Math.abs(profit) / revenue) * 100, 100) : 0 },
                    ].map((row) => (
                      <div key={row.label} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{row.label}</p>
                            <p className={`mt-1 text-2xl font-black ${row.tone === "red" ? "text-rose-600" : row.tone === "green" ? "text-emerald-700" : "text-blue-700"}`}>
                              {fmt(row.value)}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                            row.tone === "red" ? "bg-rose-50 text-rose-700" :
                            row.tone === "green" ? "bg-emerald-50 text-emerald-700" :
                            "bg-blue-50 text-blue-700"
                          }`}>
                            {row.label === "Net Profit" ? `${expenseRatio}% cost` : `${Math.round(row.pct)}%`}
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              row.tone === "red" ? "bg-rose-500" : row.tone === "green" ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.max(row.pct, row.label === "Revenue" ? 100 : 4)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Trip At a Glance</p>
                    <div className="mt-3 space-y-3">
                      {[
                        ["Date", currentTrip.date || "N/A"],
                        ["Lorry", currentTrip.lorry || "N/A"],
                        ["Payment", currentTrip.status || "Pending"],
                        ["Balance", fmt(balance)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                          {label === "Payment" ? (
                            <Badge color={statusColors[currentTrip.status] || "slate"}>{value}</Badge>
                          ) : label === "Balance" ? (
                            <span className="text-sm font-black text-rose-600">{value}</span>
                          ) : (
                            <span className="text-sm font-semibold text-slate-800">{value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Quick Note</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      The overview is now a compact finance strip, so the important numbers read clearly without squeezing the modal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "breakdown" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-700">Expense Breakdown</p>
                  <Badge color="slate">{expenseItems.length} lines</Badge>
                </div>

                <div className="space-y-2">
                  {expenseItems.length > 0 ? expenseItems.map((item) => {
                    const pct = totalExpenses > 0 ? Math.max((item.amount / totalExpenses) * 100, 4) : 0;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{item.label}</span>
                            {item.isCustom && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">custom</span>}
                          </div>
                          <span className="text-sm font-black text-slate-800">{fmt(item.amount)}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  }) : (
                    <p className="py-6 text-center text-sm text-slate-400">No expense breakdown available</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "details" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Driver</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{currentTrip.driverName || currentTrip.driverId || "N/A"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Conductor</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{currentTrip.conductorName || currentTrip.conductorId || "N/A"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Payment Method</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{currentTrip.paymentMethod || currentTrip.method || "N/A"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Paid On</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{currentTrip.paidAt || "Not yet paid"}</p>
                  </div>
                </div>

                {currentTrip.notes && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Notes</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{currentTrip.notes}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Owner Earnings</p>
                  <p className="mt-2 text-lg font-black text-slate-800">
                    {currentTrip.status === "Paid"
                      ? `Your earnings for this trip: ${fmt(ratePerTrip)}`
                      : "Earnings pending - trip not yet paid"}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "actions" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Quick actions</p>
                  <p className="mt-2 text-sm text-slate-600">Use one action at a time to keep the panel calm and easy to read.</p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {onMarkPaid && currentTrip.status !== "Paid" && (
                    <button
                      type="button"
                      onClick={handleMarkPaid}
                      disabled={saving}
                      className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? "Updating..." : "Mark as Paid"}
                    </button>
                  )}
                  {onEditTrip && (
                    <button
                      type="button"
                      onClick={() => {
                        onEditTrip(currentTrip);
                        onClose?.();
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Edit Trip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => exportVoucher(currentTrip)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Download Voucher
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-900"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
