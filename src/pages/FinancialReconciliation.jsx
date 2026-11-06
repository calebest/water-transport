import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { financialDeductionsService } from "../services/financialDeductions";
import { paymentRecordsService } from "../services/paymentRecords";
import { bossesService } from "../services/bosses";
import {
  calculateReconciliation,
  generateReconciliationPDF,
  exportReconciliationCSV,
} from "../utils/reconciliationPdfGenerator";
import { formatKES, formatDateKE } from "../utils/paymentPdfGenerator";
import { StatCard, Badge, Modal } from "../components/ui";

const DEDUCTION_CATEGORIES = [
  "Vehicle Repairs & Maintenance",
  "Transaction Charges",
  "Bank / M-Pesa Fees",
  "Fuel / Oil Advance",
  "Office & Administrative",
  "Regulatory & Permits",
  "Other Approved Deduction",
];

// Helper to get local date as YYYY-MM-DD
const toISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getDateRangePresets = () => {
  const now = new Date();
  const todayStr = toISODate(now);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterdayStr = toISODate(yesterdayDate);

  // This Week (Sunday to Saturday)
  const dayOfWeek = now.getDay();
  const sunDate = new Date(now);
  sunDate.setDate(now.getDate() - dayOfWeek);
  const satDate = new Date(sunDate);
  satDate.setDate(sunDate.getDate() + 6);
  const weekStartStr = toISODate(sunDate);
  const weekEndStr = toISODate(satDate);

  // Last 7 Days
  const last7Date = new Date(now);
  last7Date.setDate(now.getDate() - 6);
  const last7Str = toISODate(last7Date);

  // This Month
  const firstThisMonth = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastThisMonth = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  // Last Month
  const firstLastMonth = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastLastMonth = toISODate(new Date(now.getFullYear(), now.getMonth(), 0));

  return {
    today: { label: "Today", start: todayStr, end: todayStr },
    yesterday: { label: "Yesterday", start: yesterdayStr, end: yesterdayStr },
    thisWeek: { label: "This Week", start: weekStartStr, end: weekEndStr },
    last7Days: { label: "Last 7 Days", start: last7Str, end: todayStr },
    thisMonth: { label: "This Month", start: firstThisMonth, end: lastThisMonth },
    lastMonth: { label: "Last Month", start: firstLastMonth, end: lastLastMonth },
  };
};

export default function FinancialReconciliationPage({
  trips = [],
  vehicles = [],
  globalVehicle = "all",
  setGlobalVehicle,
  paymentRecords = [],
  financialDeductions = [],
  refreshFinancialDeductions,
  refreshPaymentRecords,
  onNavigateToPayments,
}) {
  const { user, isAdmin, isOwner } = useAuth();
  const isPrivileged = isAdmin || isOwner;

  // Local state for deductions if not supplied by parent
  const [internalDeductions, setInternalDeductions] = useState([]);
  const deductions = financialDeductions?.length ? financialDeductions : internalDeductions;

  // Local state for payments if not supplied by parent
  const [internalPayments, setInternalPayments] = useState([]);
  const payments = paymentRecords?.length ? paymentRecords : internalPayments;

  // Bosses state
  const [bosses, setBosses] = useState([]);

  // Local vehicle state fallback (synced with globalVehicle)
  const [localVehicle, setLocalVehicle] = useState(globalVehicle || "all");

  useEffect(() => {
    if (globalVehicle) {
      setLocalVehicle(globalVehicle);
    }
  }, [globalVehicle]);

  const selectedVehicle = setGlobalVehicle ? globalVehicle : localVehicle;

  const handleVehicleChange = (val) => {
    setLocalVehicle(val);
    if (setGlobalVehicle) {
      setGlobalVehicle(val);
    }
  };

  // Filter & period state
  const [periodType, setPeriodType] = useState("thisMonth");
  const [customStart, setCustomStart] = useState(toISODate());
  const [customEnd, setCustomEnd] = useState(toISODate());
  const [bossFilter, setBossFilter] = useState("all");
  const [allocationPercent, setAllocationPercent] = useState(100);

  // Active view tab: 'overview' | 'deductions' | 'payments'
  const [activeTab, setActiveTab] = useState("overview");

  // Deductions filter & search
  const [deductionSearch, setDeductionSearch] = useState("");
  const [deductionCategoryFilter, setDeductionCategoryFilter] = useState("all");
  const [deductionTripFilter, setDeductionTripFilter] = useState("all"); // 'all' | 'inTrips' | 'additionalOnly'

  // Modals state
  const [addDeductionModalOpen, setAddDeductionModalOpen] = useState(false);
  const [editDeduction, setEditDeduction] = useState(null);
  const [deleteConfirmDeduction, setDeleteConfirmDeduction] = useState(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Deduction Form fields
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(toISODate());
  const [formCategory, setFormCategory] = useState("Vehicle Repairs & Maintenance");
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIncludedInTrips, setFormIncludedInTrips] = useState(false);
  const [formAllocatedBoss, setFormAllocatedBoss] = useState("All Bosses");

  // Load deductions, payments, and bosses
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [loadedDeductions, loadedPayments, loadedBosses] = await Promise.all([
          financialDeductionsService.fetchAll(),
          paymentRecordsService.fetchAll(),
          bossesService.fetchAll(),
        ]);
        if (mounted) {
          setInternalDeductions(loadedDeductions);
          setInternalPayments(loadedPayments);
          setBosses(loadedBosses);
        }
      } catch (err) {
        console.warn("Failed loading initial reconciliation data:", err);
      }
    };

    load();

    const unsubDeductions = financialDeductionsService.subscribe((updated) => {
      if (mounted) {
        setInternalDeductions(updated);
        if (refreshFinancialDeductions) refreshFinancialDeductions();
      }
    });

    const unsubPayments = paymentRecordsService.subscribe((updated) => {
      if (mounted) {
        setInternalPayments(updated);
        if (refreshPaymentRecords) refreshPaymentRecords();
      }
    });

    const unsubBosses = bossesService.subscribe((updated) => {
      if (mounted) setBosses(updated);
    });

    return () => {
      mounted = false;
      unsubDeductions();
      unsubPayments();
      unsubBosses();
    };
  }, [refreshFinancialDeductions, refreshPaymentRecords]);

  // Current active date range object
  const activeDateRange = useMemo(() => {
    const presets = getDateRangePresets();
    if (periodType === "custom") {
      return {
        label: `Custom (${formatDateKE(customStart)} - ${formatDateKE(customEnd)})`,
        start: customStart,
        end: customEnd,
      };
    }
    return presets[periodType] || presets.thisMonth;
  }, [periodType, customStart, customEnd]);

  // Execute Financial Reconciliation calculation
  const recon = useMemo(() => {
    return calculateReconciliation({
      trips,
      deductions,
      payments,
      dateRange: activeDateRange,
      bossFilter,
      vehicleFilter: selectedVehicle,
      allocationPercent,
    });
  }, [trips, deductions, payments, activeDateRange, bossFilter, selectedVehicle, allocationPercent]);

  // Filtered deductions for table view
  const filteredDeductionsTable = useMemo(() => {
    return recon.allDeductions.filter((d) => {
      if (deductionCategoryFilter !== "all" && d.category !== deductionCategoryFilter) {
        return false;
      }
      if (deductionTripFilter === "inTrips" && !d.included_in_trips) return false;
      if (deductionTripFilter === "additionalOnly" && d.included_in_trips) return false;
      if (deductionSearch.trim()) {
        const q = deductionSearch.toLowerCase();
        const matchDesc = (d.description || "").toLowerCase().includes(q);
        const matchRef = (d.reference_number || "").toLowerCase().includes(q);
        const matchNotes = (d.notes || "").toLowerCase().includes(q);
        const matchCat = (d.category || "").toLowerCase().includes(q);
        const matchAmount = String(d.amount || "").includes(q);
        if (!matchDesc && !matchRef && !matchNotes && !matchCat && !matchAmount) return false;
      }
      return true;
    });
  }, [recon.allDeductions, deductionCategoryFilter, deductionTripFilter, deductionSearch]);

  // Open Add Deduction Modal
  const openAddDeductionModal = () => {
    setEditDeduction(null);
    setFormDescription("");
    setFormAmount("");
    setFormDate(toISODate());
    setFormCategory("Vehicle Repairs & Maintenance");
    setFormReference("");
    setFormNotes("");
    setFormIncludedInTrips(false);
    setFormAllocatedBoss(bossFilter !== "all" ? bossFilter : "All Bosses");
    setAddDeductionModalOpen(true);
  };

  // Open Edit Deduction Modal
  const openEditDeductionModal = (item) => {
    if (!item) return;
    setEditDeduction(item);
    setFormDescription(item.description || "");
    setFormAmount(item.amount != null ? String(item.amount) : "");
    setFormDate(item.date || toISODate());
    setFormCategory(item.category || "Vehicle Repairs & Maintenance");
    setFormReference(item.reference_number || "");
    setFormNotes(item.notes || "");
    setFormIncludedInTrips(Boolean(item.included_in_trips));
    setFormAllocatedBoss(item.allocated_boss || "All Bosses");
    setAddDeductionModalOpen(true);
  };

  // Save (Create or Update) Deduction
  const handleSaveDeduction = async (e) => {
    e?.preventDefault();
    if (!formDescription.trim()) {
      alert("Description is required.");
      return;
    }
    const numAmount = Number(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid positive deduction amount.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        description: formDescription.trim(),
        amount: numAmount,
        date: formDate,
        category: formCategory,
        reference_number: formReference.trim(),
        notes: formNotes.trim(),
        included_in_trips: formIncludedInTrips,
        allocated_boss: formAllocatedBoss,
      };

      if (editDeduction) {
        await financialDeductionsService.update(editDeduction.id, payload);
      } else {
        await financialDeductionsService.create(payload, user?.id);
      }

      setAddDeductionModalOpen(false);
      setEditDeduction(null);
      if (refreshFinancialDeductions) refreshFinancialDeductions();
      const updated = await financialDeductionsService.fetchAll();
      setInternalDeductions(updated);
    } catch (err) {
      alert("Failed to save deduction: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete Deduction
  const handleDeleteDeduction = async () => {
    if (!deleteConfirmDeduction) return;
    setSaving(true);
    try {
      await financialDeductionsService.delete(deleteConfirmDeduction.id);
      setDeleteConfirmDeduction(null);
      if (refreshFinancialDeductions) refreshFinancialDeductions();
      const updated = await financialDeductionsService.fetchAll();
      setInternalDeductions(updated);
    } catch (err) {
      alert("Failed to delete deduction: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Trigger PDF Generation
  const handleDownloadPDF = () => {
    try {
      generateReconciliationPDF(recon);
      setPdfModalOpen(false);
    } catch (err) {
      alert("Error generating PDF: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP HEADER & ACTION CONTROLS
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Financial Reconciliation
            </h1>
            <Badge color="green">KES</Badge>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                recon.statusBadgeColor === "green"
                  ? "bg-emerald-100 text-emerald-800"
                  : recon.statusBadgeColor === "amber"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-indigo-100 text-indigo-800"
              }`}
            >
              {recon.statusKey === "balanced" ? "Balanced" : recon.statusKey === "due" ? "Remittance Due" : "Overpaid"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Reconcile trip operating profit against approved business deductions and actual boss remittances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download PDF Button */}
          <button
            type="button"
            onClick={() => setPdfModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:shadow-md cursor-pointer"
          >
            <span className="text-base">📄</span>
            <span>Download Report (PDF)</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={() => exportReconciliationCSV(recon)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
            title="Export full reconciliation statement to CSV"
          >
            <span>📊</span>
            <span>CSV</span>
          </button>

          {/* Add Deduction Button (Admin/Owner only) */}
          {isPrivileged ? (
            <button
              type="button"
              onClick={openAddDeductionModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/20 transition-all hover:shadow-md cursor-pointer"
            >
              <span className="text-base font-bold">+</span>
              <span>Record Deduction</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 italic">View-only mode</div>
          )}
        </div>
      </div>

      {/* =========================================================================
          THE FIVE CORE QUESTIONS (TRANSPARENCY BANNER)
         ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 rounded-2xl text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
              Financial Transparency Checklist
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Clear Accounting: 5 Questions Answered
            </h2>
          </div>
          <span className="text-xs text-slate-300 font-semibold bg-white/10 px-3 py-1 rounded-full w-fit">
            📅 {recon.dateRange.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Q1 */}
          <div className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors">
            <span className="text-emerald-400 font-bold block mb-1">1. Profit Generated</span>
            <span className="text-base font-black text-white block">
              {formatKES(recon.totalProfitGenerated)}
            </span>
            <p className="text-[11px] text-slate-300 mt-1">
              From {recon.tripCount} trips {recon.vehicleFilter !== "all" ? `(${recon.vehicleFilter})` : "(All Vehicles)"} (Rev {formatKES(recon.tripRevenue)})
            </p>
          </div>

          {/* Q2 */}
          <div className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors">
            <span className="text-rose-400 font-bold block mb-1">2. Money Deducted</span>
            <span className="text-base font-black text-rose-300 block">
              - {formatKES(recon.sumAdditionalDeductions)}
            </span>
            <p className="text-[11px] text-slate-300 mt-1">
              {recon.additionalDeductions.length} approved extra deductions
            </p>
          </div>

          {/* Q3 */}
          <div className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors">
            <span className="text-sky-400 font-bold block mb-1">3. Payable to Boss</span>
            <span className="text-base font-black text-sky-200 block">
              = {formatKES(recon.netAmountPayable)}
            </span>
            <p className="text-[11px] text-slate-300 mt-1">
              Entitlement after adjustments ({recon.allocationPercent}%)
            </p>
          </div>

          {/* Q4 */}
          <div className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors">
            <span className="text-amber-400 font-bold block mb-1">4. Actually Sent</span>
            <span className="text-base font-black text-amber-200 block">
              {formatKES(recon.actualAmountSent)}
            </span>
            <p className="text-[11px] text-slate-300 mt-1">
              Across {recon.paymentCount} remittance transfers
            </p>
          </div>

          {/* Q5 */}
          <div
            className={`p-3 rounded-xl border transition-colors ${
              recon.statusKey === "balanced"
                ? "bg-emerald-950/60 border-emerald-500/50"
                : recon.statusKey === "due"
                ? "bg-amber-950/60 border-amber-500/50"
                : "bg-indigo-950/60 border-indigo-500/50"
            }`}
          >
            <span className="font-bold block mb-1 text-emerald-300">5. Outstanding Balance</span>
            <span className="text-base font-black text-white block">
              {formatKES(Math.abs(recon.outstandingBalance))}
            </span>
            <p className="text-[11px] font-semibold text-emerald-200 mt-1 truncate">
              {recon.statusKey === "balanced"
                ? "✓ Fully balanced"
                : recon.statusKey === "due"
                ? "⚠️ Due to Boss"
                : "ℹ️ Remittance Advance"}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FILTER & PERIOD SELECTION BAR
         ========================================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Period Presets */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Reporting Period</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="thisWeek">This Week</option>
              <option value="last7Days">Last 7 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Active Vehicle Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Vehicle Scope {selectedVehicle !== "all" && <span className="text-emerald-600 font-black">({selectedVehicle})</span>}
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => handleVehicleChange(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-bold text-slate-800"
            >
              <option value="all">🚛 All Vehicles (Fleet-wide)</option>
              {vehicles.map((v) => (
                <option key={v.id || v.plate} value={v.plate}>
                  🚛 {v.plate} {v.model ? `(${v.model})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Target Boss Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Target Boss / Director</label>
            <select
              value={bossFilter}
              onChange={(e) => setBossFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-bold text-slate-800"
            >
              <option value="all">📁 Consolidated (All Bosses)</option>
              {bosses.map((b) => (
                <option key={b.id || b.name} value={b.name}>
                  👤 Individual: {b.name} ({b.title || "Director"})
                </option>
              ))}
            </select>
          </div>

          {/* Profit Allocation % */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Boss Allocation: <span className="text-emerald-700 font-black">{allocationPercent}%</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={allocationPercent}
                onChange={(e) => setAllocationPercent(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-600 min-w-8 text-right">{allocationPercent}%</span>
            </div>
          </div>

          {/* Current Status Pill */}
          <div className="flex flex-col justify-end">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Net Status
              </span>
              <span
                className={`text-xs font-black ${
                  recon.statusKey === "balanced"
                    ? "text-emerald-700"
                    : recon.statusKey === "due"
                    ? "text-amber-700"
                    : "text-indigo-700"
                }`}
              >
                {recon.statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Date Pickers if 'custom' is selected */}
        {periodType === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          EXECUTIVE STAT CARDS
         ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Profit Generated"
          value={formatKES(recon.totalProfitGenerated)}
          icon="📈"
          color="green"
          sub={`${recon.tripCount} completed trips ${recon.vehicleFilter !== "all" ? `(${recon.vehicleFilter})` : ""}`}
        />
        <StatCard
          label="Approved Deductions"
          value={formatKES(recon.sumAdditionalDeductions)}
          icon="✂️"
          color="red"
          sub={`${recon.additionalDeductions.length} additional items`}
        />
        <StatCard
          label="Net Amount Payable"
          value={formatKES(recon.netAmountPayable)}
          icon="💼"
          color="blue"
          sub={`${recon.allocationPercent}% allocation`}
        />
        <StatCard
          label="Actual Remitted"
          value={formatKES(recon.actualAmountSent)}
          icon="💸"
          color="slate"
          sub={`${recon.paymentCount} transfers`}
        />
      </div>

      {/* =========================================================================
          SECTION TABS
         ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`py-2.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "overview"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          ⚖️ Reconciliation Audit & Math
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("deductions")}
          className={`py-2.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "deductions"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>✂️ Deductions & Adjustments</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
            {recon.allDeductions.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`py-2.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "payments"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>💸 Actual Transfers to Boss</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
            {recon.paymentCount}
          </span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: RECONCILIATION AUDIT & MATH VIEW
         ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Detailed Math Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Automatic Financial Reconciliation</h3>
                <p className="text-xs text-slate-400">Step-by-step audit trail for the selected period</p>
              </div>
              <Badge color={recon.statusBadgeColor}>{recon.statusLabel}</Badge>
            </div>

            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              {/* Step 1: Total Profit */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">
                      Total Profit Generated from Operations {recon.vehicleFilter !== "all" ? `(${recon.vehicleFilter})` : "(All Vehicles)"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Calculated from {recon.tripCount} completed trips {recon.vehicleFilter !== "all" ? `for vehicle ${recon.vehicleFilter}` : "across fleet"} (Revenue: {formatKES(recon.tripRevenue)} - Operating Expenses: {formatKES(recon.tripOperatingExpenses + recon.tripDeductions)})
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-bold uppercase">Operating Profit</span>
                  <span className="font-black text-emerald-700 text-base">
                    + {formatKES(recon.totalProfitGenerated)}
                  </span>
                </div>
              </div>

              {/* Step 2: Additional Approved Deductions */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-800 font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Less: Additional Approved Deductions</h4>
                    <p className="text-xs text-slate-500">
                      {recon.additionalDeductions.length} approved expenses not yet captured in trip expenses (repairs, transaction fees, M-Pesa charges)
                    </p>
                    {recon.deductionsAlreadyInTrips.length > 0 && (
                      <span className="inline-block mt-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        🛡️ {recon.deductionsAlreadyInTrips.length} item(s) totalling {formatKES(recon.sumDeductionsAlreadyInTrips)} are already in trips and were NOT deducted twice.
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-bold uppercase">Subtracted</span>
                  <span className="font-black text-rose-600 text-base">
                    - {formatKES(recon.sumAdditionalDeductions)}
                  </span>
                </div>
              </div>

              {/* Step 3: Net Amount Payable */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Equals: Net Amount Payable to Boss</h4>
                    <p className="text-xs text-slate-500">
                      Entitlement amount based on business allocation ({recon.allocationPercent}%)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-bold uppercase">Payable Entitlement</span>
                  <span className="font-black text-slate-900 text-base sm:text-lg">
                    = {formatKES(recon.netAmountPayable)}
                  </span>
                </div>
              </div>

              {/* Step 4: Actual Transfers Sent */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Less: Actual Amount Remitted to Boss</h4>
                    <p className="text-xs text-slate-500">
                      Transferred across {recon.paymentCount} payment transactions recorded in Payment Records
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-bold uppercase">Cash Sent</span>
                  <span className="font-black text-amber-700 text-base">
                    - {formatKES(recon.actualAmountSent)}
                  </span>
                </div>
              </div>

              {/* Step 5: Final Audit Outcome */}
              <div
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  recon.statusKey === "balanced"
                    ? "bg-emerald-50/80 border-t-2 border-emerald-500"
                    : recon.statusKey === "due"
                    ? "bg-amber-50/80 border-t-2 border-amber-500"
                    : "bg-indigo-50/80 border-t-2 border-indigo-500"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-9 w-9 rounded-xl font-black flex items-center justify-center shrink-0 text-white ${
                      recon.statusKey === "balanced"
                        ? "bg-emerald-600"
                        : recon.statusKey === "due"
                        ? "bg-amber-600"
                        : "bg-indigo-600"
                    }`}
                  >
                    5
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-base">
                      Closing Verdict: {recon.statusLabel}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {recon.statusKey === "balanced"
                        ? "All generated profit after approved deductions has been remitted in full with zero discrepancy."
                        : recon.statusKey === "due"
                        ? `The business currently owes ${formatKES(recon.outstandingBalance)} to the boss for this period.`
                        : `An advance remittance of ${formatKES(Math.abs(recon.outstandingBalance))} has been made above current payable net profit.`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Outstanding Balance
                  </span>
                  <span
                    className={`text-xl sm:text-2xl font-black ${
                      recon.statusKey === "balanced"
                        ? "text-emerald-700"
                        : recon.statusKey === "due"
                        ? "text-amber-700"
                        : "text-indigo-700"
                    }`}
                  >
                    {formatKES(Math.abs(recon.outstandingBalance))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DEDUCTIONS & ADJUSTMENTS TABLE
         ========================================================================= */}
      {activeTab === "deductions" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden space-y-4 p-5">
          {/* Table Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Approved Deductions & Adjustments</h3>
              <p className="text-xs text-slate-400">
                Vehicle maintenance, transaction charges & approved operational costs
              </p>
            </div>
            {isPrivileged && (
              <button
                type="button"
                onClick={openAddDeductionModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <span>+</span>
                <span>Record Deduction</span>
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {/* Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">🔍</span>
              <input
                type="text"
                value={deductionSearch}
                onChange={(e) => setDeductionSearch(e.target.value)}
                placeholder="Search description, reference..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={deductionCategoryFilter}
                onChange={(e) => setDeductionCategoryFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
              >
                <option value="all">🏷️ All Categories</option>
                {DEDUCTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* In Trips Filter */}
            <div>
              <select
                value={deductionTripFilter}
                onChange={(e) => setDeductionTripFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
              >
                <option value="all">All Deductions Status</option>
                <option value="additionalOnly">✂️ Additional Only (Subtracted from Profit)</option>
                <option value="inTrips">⚠️ Already in Trips (Informational Only)</option>
              </select>
            </div>
          </div>

          {/* Deductions Table */}
          {filteredDeductionsTable.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
              <div className="text-3xl">✂️</div>
              <p className="text-sm font-bold text-slate-600">No deductions found for this period</p>
              <p className="text-xs text-slate-400">Record a deduction to account for repairs or transaction charges.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Reference / Notes</th>
                    <th className="py-2.5 px-3">Accounting Status</th>
                    <th className="py-2.5 px-3 text-right">Amount (KES)</th>
                    {isPrivileged && <th className="py-2.5 px-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeductionsTable.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-700">
                        {formatDateKE(d.date)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <Badge color="slate">{d.category}</Badge>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 max-w-xs truncate">
                        {d.description}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {d.reference_number || d.notes || "—"}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {d.included_in_trips ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <span>⚠️</span>
                            <span>In Trips (Not sub-deducted)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <span>✂️</span>
                            <span>Additional (Subtracted)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap font-black text-slate-800">
                        {formatKES(d.amount)}
                      </td>
                      {isPrivileged && (
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditDeductionModal(d)}
                              title="Edit Deduction"
                              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmDeduction(d)}
                              title="Delete Deduction"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: ACTUAL PAYMENTS TO BOSS TABLE
         ========================================================================= */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Actual Transfers to Bosses</h3>
              <p className="text-xs text-slate-400">
                Payment records disbursed during this reporting period ({recon.paymentCount} payments)
              </p>
            </div>
            {onNavigateToPayments && (
              <button
                type="button"
                onClick={onNavigateToPayments}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <span>📂</span>
                <span>Open Payment Records Page</span>
              </button>
            )}
          </div>

          {recon.payments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
              <div className="text-3xl">💸</div>
              <p className="text-sm font-bold text-slate-600">No transfers recorded in this period</p>
              <p className="text-xs text-slate-400">Use Payment Records to log transfers made to the boss.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Method & Ref</th>
                    <th className="py-2.5 px-3 text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recon.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-800">
                        {formatDateKE(p.date)} <span className="text-slate-400 font-normal">({p.time || "—"})</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {p.recipient_name}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                        {p.description || "—"}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <Badge color={p.payment_method === "M-Pesa" ? "green" : "slate"}>
                          {p.payment_method || "Cash"}
                        </Badge>
                        {p.reference_number && (
                          <span className="font-mono text-[10px] text-slate-500 ml-1.5">
                            {p.reference_number}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap font-black text-emerald-700">
                        {formatKES(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD / EDIT DEDUCTION
         ========================================================================= */}
      <Modal
        open={addDeductionModalOpen}
        onClose={() => {
          setAddDeductionModalOpen(false);
          setEditDeduction(null);
        }}
        title={editDeduction ? "Edit Approved Deduction" : "Record Approved Deduction"}
        wide
      >
        <form onSubmit={handleSaveDeduction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Deduction Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g. Engine overhaul, M-Pesa remittance charges, Fleet insurance"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Amount (KES) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="e.g. 4500"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-black text-slate-800"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
              >
                {DEDUCTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Reference / Receipt Code (Optional)
              </label>
              <input
                type="text"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                placeholder="e.g. REC-89214, MPESA-CHG-01"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* CRITICAL: Whether included in trips checkbox */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIncludedInTrips}
                onChange={(e) => setFormIncludedInTrips(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Already included in trip operating expenses?
                </span>
                <span className="text-[11px] text-slate-600 block mt-0.5 leading-snug">
                  Check this box ONLY if this deduction has already been subtracted in a trip’s repair or expense log.
                  When checked, it will be documented for financial audit but <strong>will NOT be deducted a second time</strong> from profit.
                </span>
              </div>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Supporting Notes / Reason (Optional)
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Provide background context or justification for this deduction..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setAddDeductionModalOpen(false);
                setEditDeduction(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : editDeduction ? "Update Deduction" : "Save Deduction"}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL: DELETE DEDUCTION CONFIRMATION
         ========================================================================= */}
      <Modal
        open={!!deleteConfirmDeduction}
        onClose={() => setDeleteConfirmDeduction(null)}
        title="Confirm Deduction Deletion"
      >
        {deleteConfirmDeduction && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to remove the deduction for{" "}
              <strong className="text-slate-900">{deleteConfirmDeduction.description}</strong> of{" "}
              <strong className="text-rose-600">{formatKES(deleteConfirmDeduction.amount)}</strong> recorded on{" "}
              <strong>{formatDateKE(deleteConfirmDeduction.date)}</strong>?
            </p>
            <p className="text-xs text-slate-400">This will recalculate the net payable amount to the boss.</p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmDeduction(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDeduction}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Deleting..." : "Yes, Delete Deduction"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL: DOWNLOAD RECONCILIATION REPORT (PDF)
         ========================================================================= */}
      <Modal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Download Financial Reconciliation Report (PDF)"
        wide
      >
        <div className="space-y-5">
          <p className="text-xs sm:text-sm text-slate-600">
            Generate an official, branded{" "}
            <strong className="text-slate-900">Mount Kenya Water Distributors</strong> Financial Reconciliation Report
            documenting business profit, approved deductions, actual remittances, and closing outstanding balance.
          </p>

          {/* Target Period & Boss Live Preview Box */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Report Period</span>
              <span className="font-bold text-emerald-400">{recon.dateRange.label}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Vehicle Scope</span>
              <span className="font-bold text-emerald-400">
                {recon.vehicleFilter !== "all" ? `🚛 ${recon.vehicleFilter}` : "🚛 All Vehicles (Fleet-wide)"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Beneficiary</span>
              <span className="font-bold text-slate-200">
                {recon.bossFilter !== "all" ? recon.bossFilter : "Consolidated (All Bosses)"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-white/10 pt-2">
              <span className="text-slate-400 font-bold">Total Operating Profit Generated:</span>
              <span className="font-bold text-white">{formatKES(recon.totalProfitGenerated)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">Additional Approved Deductions:</span>
              <span className="font-bold text-rose-300">- {formatKES(recon.sumAdditionalDeductions)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">Net Amount Payable:</span>
              <span className="font-bold text-sky-300">{formatKES(recon.netAmountPayable)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">Actual Amount Remitted:</span>
              <span className="font-bold text-amber-300">{formatKES(recon.actualAmountSent)}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-white/20 pt-2 font-black">
              <span className="text-emerald-400">Outstanding Closing Balance:</span>
              <span className="text-white">{formatKES(Math.abs(recon.outstandingBalance))}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPdfModalOpen(false)}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <span>📥</span>
              <span>Generate & Download Reconciliation PDF</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

