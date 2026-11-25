import { useEffect, useMemo, useState } from "react";
import { Badge, Modal } from "./ui";
import { exportVoucher } from "../utils/export";
import { DEDUCTION_LABELS, EXPENSE_LABELS, getTripFinancials, splitCustomExpenses, fmt } from "../utils/helpers";

const STATUS_CONFIG = {
  Paid: { color: "green", bg: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200" },
  Pending: { color: "red", bg: "bg-rose-500", text: "text-rose-700", border: "border-rose-200" },
  Partial: { color: "amber", bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-200" },
};

const EXPENSE_ICONS = {
  diesel: "⛽",
  water: "💧",
  police: "👮",
  driver: "🚗",
  conductor: "🎟️",
  repairs: "🔧",
  petrol: "⛽",
};

const toAmount = (value) => Number(value || 0);

export default function TripReviewModal({
  trip,
  open = false,
  onClose,
  onMarkPaid,
  onEditTrip,
  onDuplicate,
  onApprove,
  onReject,
  ratePerTrip = 200,
  brokers = [],
}) {
  const [currentTrip, setCurrentTrip] = useState(trip);
  const [activeTab, setActiveTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    queueMicrotask(() => setCurrentTrip(trip));
  }, [trip]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => setActiveTab("overview"));
      setShowRejectInput(false);
      setRejectReason("");
    }
  }, [open, trip?.id]);

  const expenseItems = useMemo(() => {
    if (!currentTrip?.expenses) return [];
    const fixed = Object.entries(EXPENSE_LABELS)
      .filter(([key]) => key !== "petrol" || Number(currentTrip.expenses?.petrol || 0) > 0)
      .map(([key, label]) => ({
        key,
        label,
        amount: toAmount(currentTrip.expenses?.[key]),
        payer: currentTrip.expenses?._payers?.[key] || currentTrip.expenses?._defaultPayer || "Company",
        isCustom: false,
      }));
    const custom = splitCustomExpenses(currentTrip.expenses?.custom || []).operating.map((item, index) => ({
      key: item.id || `${item.label || "custom"}-${index}`,
      label: item.label || "Custom",
      amount: toAmount(item.amount),
      payer: item.paidBy || currentTrip.expenses?._defaultPayer || "Company",
      isCustom: true,
    }));
    return [...fixed, ...custom].filter((item) => item.amount > 0);
  }, [currentTrip]);

  const deductionItems = useMemo(() => {
    if (!currentTrip) return [];
    const fixed = Object.entries(DEDUCTION_LABELS).map(([key, label]) => ({
      key,
      label,
      amount: toAmount(currentTrip.deductions?.[key]),
      isCustom: false,
    }));
    const legacy = splitCustomExpenses(currentTrip.expenses?.custom || []).deductions.map((item, index) => ({
      key: item.id || `${item.label || "deduction"}-${index}`,
      label: item.label || "Deduction",
      amount: toAmount(item.amount),
      isCustom: true,
    }));
    return [...fixed, ...legacy].filter((item) => item.amount > 0);
  }, [currentTrip]);

  const financials = getTripFinancials(currentTrip);
  const revenue = financials.revenue;
  const totalExpenses = financials.operatingExpenses;
  const profit = financials.operatingProfit;
  const totalDeductions = financials.totalDeductions;
  const netPayable = financials.netPayable;
  const amountPaid = toAmount(currentTrip?.amountPaid);
  const balance = Math.max(revenue - amountPaid, 0);
  const expenseRatio = revenue > 0 ? Math.round((totalExpenses / revenue) * 100) : 0;
  const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  // Calculated distance if odometers are present
  const odoDistance =
    currentTrip?.odometerStart && currentTrip?.odometerEnd && Number(currentTrip.odometerEnd) >= Number(currentTrip.odometerStart)
      ? Number(currentTrip.odometerEnd) - Number(currentTrip.odometerStart)
      : null;

  const brokerObj = brokers.find(b => b.id === currentTrip?.brokerId);

  const tabs = [
    { id: "overview", label: "Financial Overview" },
    { id: "breakdown", label: `Breakdown (${expenseItems.length + deductionItems.length})` },
    { id: "details", label: "Crew & Logistics" },
    { id: "actions", label: "Actions & Voucher" },
  ];

  const handleMarkPaid = async () => {
    if (!onMarkPaid || !currentTrip || currentTrip.status === "Paid") return;
    setSaving(true);
    try {
      await onMarkPaid(currentTrip);
      setCurrentTrip((prev) => (prev ? { ...prev, status: "Paid", amountPaid: prev.revenue } : prev));
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open && !!currentTrip}
      onClose={onClose}
      title={`Trip Dossier #${currentTrip?.tripNumber || "N/A"}`}
      wide
    >
      {currentTrip && (
        <div className="space-y-6">
          {/* ─── Executive Header Voucher Card (Light Theme) ────────────────── */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 p-5 sm:p-6 text-slate-800 shadow-sm">
            {/* Subtle light accents */}
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Top metadata line */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    Water Transport Log
                  </span>
                  <span className="text-xs text-slate-500 font-mono font-medium">
                    {currentTrip.date || "No date recorded"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${currentTrip.status === "Paid"
                        ? "bg-emerald-600 text-white"
                        : currentTrip.status === "Partial"
                          ? "bg-amber-500 text-white"
                          : "bg-rose-500 text-white"
                      }`}
                  >
                    {currentTrip.status || "Pending"}
                  </span>
                  {currentTrip.approvalStatus === "pending" && (
                    <Badge color="amber">⏳ Awaiting Approval</Badge>
                  )}
                  {currentTrip.approvalStatus === "pending_edit" && (
                    <Badge color="amber">⚠️ Edit Pending</Badge>
                  )}
                  {currentTrip.approvalStatus === "rejected" && (
                    <Badge color="red">❌ Rejected</Badge>
                  )}
                </div>
              </div>

              {/* Main identity row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black font-mono tracking-tight bg-slate-900 text-white shadow-2xs">
                      <span>🚛</span>
                      <span>{currentTrip.lorry || "Vehicle"}</span>
                    </span>
                    <span className="text-lg font-black font-mono tracking-tight text-slate-800">
                      Trip #{currentTrip.tripNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-800 min-w-0">
                    <span className="text-emerald-600 text-base shrink-0">📍</span>
                    <p className="text-base sm:text-lg font-black break-words leading-tight text-slate-900">
                      {currentTrip.location || "No destination specified"}
                    </p>
                  </div>
                </div>

                {/* Net Payable Hero Badge */}
                <div className="shrink-0 bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Payable</p>
                  <p className={`mt-0.5 text-xl sm:text-2xl font-black font-mono ${netPayable >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {fmt(netPayable)}
                  </p>
                </div>
              </div>

              {/* Bottom chips (Broker, Distance, Driver, Duplicate) */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                {brokerObj && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <span>🤝 Broker:</span>
                    <strong className="text-slate-800">{brokerObj.name}</strong>
                  </span>
                )}
                {odoDistance !== null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <span>🛣️ Distance:</span>
                    <strong className="text-slate-800">{odoDistance} km</strong>
                  </span>
                )}
                {currentTrip.driverId && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <span>🚗 Driver:</span>
                    <strong className="text-slate-800">{currentTrip.driverName || currentTrip.driverId}</strong>
                  </span>
                )}
                {onDuplicate && (
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicate(currentTrip);
                      onClose?.();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold transition-all cursor-pointer shadow-2xs"
                    title="Reuse / duplicate this trip's details into a new entry"
                  >
                    <span>📋</span>
                    <span>Duplicate / Reuse</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── Pending / Rejection Alert Banners ───────────────────────────── */}
          {currentTrip.approvalStatus === "pending" && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="min-w-0 space-y-1">
                <p className="font-black text-sm flex items-center gap-2">
                  <span className="text-base">⏳</span>
                  <span>Pending Administrator Review</span>
                </p>
                <p className="text-xs text-amber-900/80 leading-relaxed break-words">
                  This trip was submitted and is pending administrative approval before impacting ledger balances.
                </p>
              </div>
              {onApprove && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onApprove(currentTrip);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 cursor-pointer disabled:opacity-60 transition-all"
                  >
                    {saving ? "Approving…" : "✓ Approve Trip"}
                  </button>
                  {onReject && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("actions");
                        setShowRejectInput(true);
                      }}
                      disabled={saving}
                      className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-60 transition-all"
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {currentTrip.approvalStatus === "rejected" && (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 sm:p-5 text-rose-950 space-y-2 shadow-xs">
              <p className="font-black text-sm flex items-center gap-2">
                <span className="text-base">❌</span>
                <span>Trip Submission Rejected</span>
              </p>
              {currentTrip.rejectionReason ? (
                <div className="rounded-xl bg-white/80 border border-rose-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-0.5">Admin Feedback</p>
                  <p className="text-sm text-rose-900 font-medium break-words">{currentTrip.rejectionReason}</p>
                </div>
              ) : (
                <p className="text-xs text-rose-800">No rejection reason was specified.</p>
              )}
            </div>
          )}

          {/* ─── Segmented Tab Navigation ────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Tab Content Panels ─────────────────────────────────────────── */}
          <div className="min-w-0">
            {/* 1. OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* 5 KPI Metric Waterfall Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Revenue */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Revenue</p>
                    <p className="mt-1 text-lg sm:text-xl font-black font-mono text-blue-700 break-words">{fmt(revenue)}</p>
                    <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
                      100% baseline
                    </span>
                  </div>

                  {/* Expenses */}
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 shadow-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Operating Expenses</p>
                    <p className="mt-1 text-lg sm:text-xl font-black font-mono text-rose-600 break-words">{fmt(totalExpenses)}</p>
                    <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                      {expenseRatio}% of revenue
                    </span>
                  </div>

                  {/* Operating Profit */}
                  <div className={`rounded-2xl border p-4 shadow-xs ${profit >= 0 ? "border-emerald-100 bg-emerald-50/40" : "border-rose-100 bg-rose-50/40"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${profit >= 0 ? "text-emerald-500" : "text-rose-400"}`}>Operating Profit</p>
                    <p className={`mt-1 text-lg sm:text-xl font-black font-mono break-words ${profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmt(profit)}</p>
                    <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${profit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {profitMargin}% margin
                    </span>
                  </div>

                  {/* Deductions */}
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 shadow-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Deductions</p>
                    <p className="mt-1 text-lg sm:text-xl font-black font-mono text-amber-600 break-words">{fmt(totalDeductions)}</p>
                    <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                      {deductionItems.length} lines
                    </span>
                  </div>

                  {/* Net Payable */}
                  <div className={`rounded-2xl border-2 p-4 shadow-xs ${netPayable >= 0 ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-rose-300 bg-rose-50 text-rose-950"}`}>
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Net Payable</p>
                    <p className="mt-1 text-lg sm:text-xl font-black font-mono break-words">{fmt(netPayable)}</p>
                    <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-white/80 shadow-2xs">
                      Final to Boss
                    </span>
                  </div>
                </div>

                {/* Expense vs Profit Distribution Bar */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">Revenue Allocation</span>
                    <span className="text-slate-400 font-mono">{fmt(revenue)} Total</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${Math.min(expenseRatio, 100)}%` }}
                      title={`Expenses: ${expenseRatio}%`}
                    />
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.max(profitMargin, 0)}%` }}
                      title={`Profit: ${profitMargin}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold pt-1">
                    <span className="text-rose-600 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                      Operating Costs ({expenseRatio}%)
                    </span>
                    <span className="text-emerald-600 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      Net Operating Profit ({Math.max(profitMargin, 0)}%)
                    </span>
                  </div>
                </div>

                {/* Quick Facts Table */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Key Settlement Facts</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Status</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{currentTrip.status || "Pending"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount Paid</p>
                      <p className="mt-1 text-sm font-black font-mono text-emerald-600">
                        {currentTrip.status === "Paid" ? fmt(revenue) : fmt(amountPaid)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</p>
                      <p className={`mt-1 text-sm font-black font-mono ${balance > 0 ? "text-rose-600" : "text-slate-700"}`}>
                        {fmt(balance)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BREAKDOWN TAB */}
            {activeTab === "breakdown" && (
              <div className="space-y-6">
                {/* Operating Expenses */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Operating Expenses</h4>
                      <p className="text-xs text-slate-400 font-medium">All vehicle operations, fuel, permits & allowances</p>
                    </div>
                    <span className="text-xs font-black font-mono text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl">
                      {fmt(totalExpenses)}
                    </span>
                  </div>

                  {expenseItems.length > 0 ? (
                    <div className="space-y-2.5 pt-1">
                      {expenseItems.map((item) => {
                        const pct = totalExpenses > 0 ? Math.round((item.amount / totalExpenses) * 100) : 0;
                        return (
                          <div
                            key={item.key}
                            className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 hover:bg-slate-100/70 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">{EXPENSE_ICONS[item.key] || "💰"}</span>
                                <span className="text-sm font-bold text-slate-800 break-words">{item.label}</span>
                                {item.isCustom && (
                                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                                    custom
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-black font-mono text-slate-800">{fmt(item.amount)}</p>
                                <span className="text-[10px] font-bold text-slate-400">{pct}% of costs</span>
                              </div>
                            </div>

                            {/* Payer chip & bar */}
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80">
                                Paid by: <strong className="text-slate-700">{item.payer}</strong>
                              </span>
                              <div className="h-1.5 w-28 sm:w-44 rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-full bg-rose-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-400">No operating expenses recorded for this trip.</p>
                  )}
                </div>

                {/* Deductions */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Deductions</h4>
                      <p className="text-xs text-slate-400 font-medium">Loans, salary advances, or special recovery deductions</p>
                    </div>
                    <span className="text-xs font-black font-mono text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl">
                      {fmt(totalDeductions)}
                    </span>
                  </div>

                  {deductionItems.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {deductionItems.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-amber-700 text-sm">📋</span>
                            <span className="text-sm font-bold text-amber-900 break-words">{item.label}</span>
                          </div>
                          <span className="text-sm font-black font-mono text-amber-900 shrink-0">{fmt(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-xs text-slate-400">No deductions recorded.</p>
                  )}
                </div>
              </div>
            )}

            {/* 3. DETAILS & CREW TAB */}
            {activeTab === "details" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Crew & Personnel</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3.5 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Driver</p>
                      <p className="text-sm font-black text-slate-800 break-words">
                        {currentTrip.driverName || currentTrip.driverId || "— Unassigned —"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conductor</p>
                      <p className="text-sm font-black text-slate-800 break-words">
                        {currentTrip.conductorName || currentTrip.conductorId || "— Unassigned —"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Broker</p>
                      <p className="text-sm font-black text-slate-800 break-words">
                        {brokerObj ? `${brokerObj.name} ${brokerObj.company ? `(${brokerObj.company})` : ""}` : "— Direct / No Broker —"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Vehicle Odometer & Distance</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Odometer Start</p>
                      <p className="mt-1 text-sm font-black font-mono text-slate-800">
                        {currentTrip.odometerStart ? `${Number(currentTrip.odometerStart).toLocaleString()} KM` : "Not recorded"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Odometer End</p>
                      <p className="mt-1 text-sm font-black font-mono text-slate-800">
                        {currentTrip.odometerEnd ? `${Number(currentTrip.odometerEnd).toLocaleString()} KM` : "Not recorded"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/70 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Calculated Trip Distance</p>
                      <p className="mt-1 text-sm font-black font-mono text-emerald-800">
                        {odoDistance !== null ? `${odoDistance.toLocaleString()} KM` : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {currentTrip.notes && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-800">Trip Remarks & Notes</p>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed break-words">{currentTrip.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* 4. ACTIONS & VOUCHER TAB */}
            {activeTab === "actions" && (
              <div className="space-y-4">
                {/* Admin Approval / Rejection Box */}
                {(currentTrip.approvalStatus === "pending" || currentTrip.approvalStatus === "pending_edit") && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-900">Administrative Decision</p>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      {onApprove && (
                        <button
                          type="button"
                          onClick={async () => {
                            setSaving(true);
                            try {
                              await onApprove(currentTrip);
                              onClose?.();
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving}
                          className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {saving ? "Approving…" : currentTrip.approvalStatus === "pending_edit" ? "Apply Proposed Edit" : "Approve Trip"}
                        </button>
                      )}
                      {onReject && (
                        <button
                          type="button"
                          onClick={() => setShowRejectInput(!showRejectInput)}
                          disabled={saving}
                          className="flex-1 rounded-xl border border-rose-200 bg-white py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {showRejectInput ? "Hide Rejection Reason" : "Reject with Reason"}
                        </button>
                      )}
                    </div>

                    {showRejectInput && (
                      <div className="rounded-xl border border-rose-200 bg-white p-3.5 space-y-2 mt-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-rose-600">Rejection Reason</label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="e.g. Revenue figure does not match receipt, please verify..."
                          rows={3}
                          className="w-full rounded-xl border border-rose-200 p-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRejectInput(false);
                              setRejectReason("");
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setSaving(true);
                              try {
                                await onReject(currentTrip, rejectReason.trim() || "Rejected by administrator.");
                                onClose?.();
                              } finally {
                                setSaving(false);
                                setShowRejectInput(false);
                                setRejectReason("");
                              }
                            }}
                            disabled={saving}
                            className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60"
                          >
                            {saving ? "Rejecting…" : "Confirm Rejection"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => exportVoucher(currentTrip)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Download / Print Receipt</span>
                  </button>

                  {onDuplicate && (
                    <button
                      type="button"
                      onClick={() => {
                        onDuplicate(currentTrip);
                        onClose?.();
                      }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-50 border border-indigo-200 px-5 py-3.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-all cursor-pointer shadow-xs"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      <span>📋 Duplicate / Reuse Trip</span>
                    </button>
                  )}

                  {onEditTrip && (
                    <button
                      type="button"
                      onClick={() => {
                        onEditTrip(currentTrip);
                        onClose?.();
                      }}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Edit Trip Record</span>
                    </button>
                  )}

                  {onMarkPaid && currentTrip.status !== "Paid" && currentTrip.approvalStatus !== "pending" && (
                    <button
                      type="button"
                      onClick={handleMarkPaid}
                      disabled={saving}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{saving ? "Marking…" : "Mark Trip as Paid"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
                  >
                    <span>Close</span>
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