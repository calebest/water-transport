import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { paymentRecordsService } from "../services/paymentRecords";
import { bossesService } from "../services/bosses";
import { generatePaymentReportPDF, exportPaymentRecordsCSV, formatKES, formatDateKE } from "../utils/paymentPdfGenerator";
import { StatCard, Badge, Modal } from "../components/ui";

const PAYMENT_METHODS = ["Cash", "M-Pesa", "Bank Transfer", "Cheque", "Other"];

const RECIPIENT_CATEGORIES = [
  "Boss / Director",
  "Partner / Owner",
  "Management",
  "Personnel / Staff",
  "Supplier / Vendor",
  "Other",
];

const BOSS_TITLES = [
  "Director",
  "Managing Director",
  "Partner / Owner",
  "Shareholder",
  "General Manager",
  "Executive",
  "Other",
];

// Helper to get local date as YYYY-MM-DD
const toISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Helper to get 12-hour time string (e.g. "10:30 AM")
const getCurrentTimeString = (d = new Date()) => {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
};

// Date range calculation helpers
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

export default function PaymentRecordsPage({ paymentRecords = [], refreshPaymentRecords }) {
  const { user, isAdmin, isOwner } = useAuth();
  const isPrivileged = isAdmin || isOwner;

  // Local state for records, synchronized with parent prop
  const [internalRecords, setInternalRecords] = useState(paymentRecords || []);

  useEffect(() => {
    if (paymentRecords?.length) {
      setInternalRecords(paymentRecords);
    }
  }, [paymentRecords]);

  const records = internalRecords.length > 0 ? internalRecords : (paymentRecords || []);

  const [loading, setLoading] = useState(!paymentRecords?.length);
  const [saving, setSaving] = useState(false);

  // Search, filter & sort state
  const [search, setSearch] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilterType, setDateFilterType] = useState("all");
  const [customFilterStart, setCustomFilterStart] = useState("");
  const [customFilterEnd, setCustomFilterEnd] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  // View state: 'list' or 'breakdown'
  const [viewMode, setViewMode] = useState("list");

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // PDF Modal range & recipient selection state
  const [pdfRangeType, setPdfRangeType] = useState("thisMonth");
  const [pdfCustomStart, setPdfCustomStart] = useState(toISODate());
  const [pdfCustomEnd, setPdfCustomEnd] = useState(toISODate());
  const [pdfRecipient, setPdfRecipient] = useState("all");

  // Form state for Add/Edit
  const [formRecipient, setFormRecipient] = useState("");
  const [formCategory, setFormCategory] = useState("Boss / Director");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(toISODate());
  const [formTime, setFormTime] = useState(getCurrentTimeString());
  const [formDescription, setFormDescription] = useState("");
  const [formMethod, setFormMethod] = useState("Cash");
  const [formReference, setFormReference] = useState("");

  // Bosses management state
  const [bosses, setBosses] = useState([]);
  const [bossesModalOpen, setBossesModalOpen] = useState(false);
  const [editingBoss, setEditingBoss] = useState(null);
  const [bossDeleteConfirm, setBossDeleteConfirm] = useState(null);
  const [bossFormName, setBossFormName] = useState("");
  const [bossFormTitle, setBossFormTitle] = useState("Director");
  const [bossFormPhone, setBossFormPhone] = useState("");
  const [bossFormNotes, setBossFormNotes] = useState("");
  const [savingBoss, setSavingBoss] = useState(false);
  const [saveAsBossCheckbox, setSaveAsBossCheckbox] = useState(false);
  const [paymentSelectedBossId, setPaymentSelectedBossId] = useState("custom");

  // Load records & bosses if not supplied via props
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [data, loadedBosses] = await Promise.all([
          paymentRecordsService.fetchAll(),
          bossesService.fetchAll(),
        ]);
        if (mounted) {
          setInternalRecords(data);
          setBosses(loadedBosses);
          setLoading(false);
        }
      } catch (e) {
        console.warn("Failed loading records/bosses:", e);
        if (mounted) setLoading(false);
      }
    };

    if (!paymentRecords?.length) {
      load();
    } else {
      bossesService.fetchAll().then((b) => {
        if (mounted) setBosses(b);
      });
      setLoading(false);
    }

    const unsubPayments = paymentRecordsService.subscribe((updated) => {
      if (mounted) {
        setInternalRecords(updated);
        if (refreshPaymentRecords) refreshPaymentRecords();
      }
    });

    const unsubBosses = bossesService.subscribe((updated) => {
      if (mounted) setBosses(updated);
    });

    return () => {
      mounted = false;
      unsubPayments();
      unsubBosses();
    };
  }, [paymentRecords?.length, refreshPaymentRecords]);

  // Unique recipient list for datalist auto-suggest
  const existingRecipients = useMemo(() => {
    const set = new Set();
    bosses.forEach((b) => {
      if (b.name) set.add(b.name);
    });
    records.forEach((r) => {
      if (r.recipient_name) set.add(r.recipient_name);
    });
    return Array.from(set).sort();
  }, [bosses, records]);

  // Recipient aggregation: total amount sent over time per boss/recipient
  const recipientTotalsOverTime = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      const name = r.recipient_name || "Unknown";
      if (!map[name]) {
        map[name] = {
          name,
          category: r.recipient_category || "Boss / Director",
          totalAmount: 0,
          count: 0,
          lastDate: r.date,
          lastAmount: r.amount,
        };
      }
      map[name].totalAmount += Number(r.amount || 0);
      map[name].count += 1;
      if (r.date > map[name].lastDate) {
        map[name].lastDate = r.date;
        map[name].lastAmount = r.amount;
      }
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [records]);

  // Open Add Modal
  const openAddModal = () => {
    setEditRecord(null);
    if (bosses?.length > 0) {
      const firstBoss = bosses[0];
      setPaymentSelectedBossId(firstBoss?.id || "custom");
      setFormRecipient(firstBoss?.name || "");
      setFormCategory(firstBoss?.title?.includes("Partner") ? "Partner / Owner" : "Boss / Director");
    } else {
      setPaymentSelectedBossId("custom");
      setFormRecipient("");
      setFormCategory("Boss / Director");
    }
    setSaveAsBossCheckbox(false);
    setFormAmount("");
    setFormDate(toISODate());
    setFormTime(getCurrentTimeString());
    setFormDescription("");
    setFormMethod("Cash");
    setFormReference("");
    setAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (rec) => {
    if (!rec) return;
    setEditRecord(rec);
    const matchedBoss = (bosses || []).find(
      (b) => (b?.name || "").toLowerCase() === (rec?.recipient_name || "").toLowerCase()
    );
    if (matchedBoss) {
      setPaymentSelectedBossId(matchedBoss.id);
    } else {
      setPaymentSelectedBossId("custom");
    }
    setSaveAsBossCheckbox(false);
    setFormRecipient(rec.recipient_name || "");
    setFormCategory(rec.recipient_category || "Boss / Director");
    setFormAmount(rec.amount != null ? String(rec.amount) : "");
    setFormDate(rec.date || toISODate());
    setFormTime(rec.time || getCurrentTimeString());
    setFormDescription(rec.description || "");
    setFormMethod(rec.payment_method || "Cash");
    setFormReference(rec.reference_number || "");
    setAddModalOpen(true);
  };

  // Open PDF modal specifically pre-filtered for a boss
  const openPdfModalForRecipient = (recipientName) => {
    setPdfRecipient(recipientName);
    setPdfModalOpen(true);
  };

  // Save new or edited payment
  const handleSavePayment = async (e) => {
    e?.preventDefault();
    if (!formRecipient.trim()) {
      alert("Recipient Name is required.");
      return;
    }
    const numAmount = Number(formAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid positive payment amount.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        recipient_name: formRecipient.trim(),
        recipient_category: formCategory,
        amount: numAmount,
        date: formDate,
        time: formTime,
        description: formDescription.trim(),
        payment_method: formMethod,
        reference_number: formReference.trim(),
      };

      if (editRecord) {
        await paymentRecordsService.update(editRecord.id, payload);
        setEditRecord(null);
      } else {
        await paymentRecordsService.create(payload, user?.id);
      }
      setAddModalOpen(false);

      // If user checked "Save as a new boss"
      if (saveAsBossCheckbox && formRecipient.trim()) {
        const nameExists = bosses.some((b) => b.name.toLowerCase() === formRecipient.trim().toLowerCase());
        if (!nameExists) {
          await bossesService.create({
            name: formRecipient.trim(),
            title: formCategory || "Director",
          });
          const updatedBosses = await bossesService.fetchAll();
          setBosses(updatedBosses);
        }
      }

      if (refreshPaymentRecords) refreshPaymentRecords();
      const updated = await paymentRecordsService.fetchAll();
      setInternalRecords(updated);
    } catch (err) {
      alert("Failed to save payment record: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete payment
  const handleDeletePayment = async () => {
    if (!deleteConfirmRecord) return;
    setSaving(true);
    try {
      await paymentRecordsService.delete(deleteConfirmRecord.id);
      setDeleteConfirmRecord(null);
      if (refreshPaymentRecords) refreshPaymentRecords();
      const updated = await paymentRecordsService.fetchAll();
      setInternalRecords(updated);
    } catch (err) {
      alert("Failed to delete payment record: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Boss Management Handlers
  const handleOpenAddBoss = () => {
    setEditingBoss(null);
    setBossFormName("");
    setBossFormTitle("Director");
    setBossFormPhone("");
    setBossFormNotes("");
  };

  const handleEditBossClick = (b) => {
    setEditingBoss(b);
    setBossFormName(b.name || "");
    setBossFormTitle(b.title || "Director");
    setBossFormPhone(b.phone || "");
    setBossFormNotes(b.notes || "");
  };

  const handleSaveBoss = async (e) => {
    e?.preventDefault();
    if (!bossFormName.trim()) {
      alert("Boss name is required.");
      return;
    }
    setSavingBoss(true);
    try {
      const payload = {
        name: bossFormName.trim(),
        title: bossFormTitle || "Director",
        phone: bossFormPhone.trim(),
        notes: bossFormNotes.trim(),
      };

      if (editingBoss) {
        await bossesService.update(editingBoss.id, payload, editingBoss.name);
        setEditingBoss(null);
      } else {
        await bossesService.create(payload);
        handleOpenAddBoss();
      }
      const updatedBosses = await bossesService.fetchAll();
      setBosses(updatedBosses);
      if (refreshPaymentRecords) refreshPaymentRecords();
      const updatedPayments = await paymentRecordsService.fetchAll();
      setInternalRecords(updatedPayments);
    } catch (err) {
      alert("Failed to save boss: " + err.message);
    } finally {
      setSavingBoss(false);
    }
  };

  const handleDeleteBoss = async () => {
    if (!bossDeleteConfirm) return;
    setSavingBoss(true);
    try {
      await bossesService.delete(bossDeleteConfirm.id);
      setBossDeleteConfirm(null);
      const updated = await bossesService.fetchAll();
      setBosses(updated);
    } catch (err) {
      alert("Failed to delete boss: " + err.message);
    } finally {
      setSavingBoss(false);
    }
  };

  // Filtered & Sorted Records for Main Table
  const filteredRecords = useMemo(() => {
    const presets = getDateRangePresets();
    return records.filter((r) => {
      // Recipient filter
      if (recipientFilter !== "all") {
        if ((r.recipient_name || "").toLowerCase() !== recipientFilter.toLowerCase()) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== "all") {
        if ((r.recipient_category || "").toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (r.recipient_name || "").toLowerCase().includes(q);
        const matchCategory = (r.recipient_category || "").toLowerCase().includes(q);
        const matchDesc = (r.description || "").toLowerCase().includes(q);
        const matchRef = (r.reference_number || "").toLowerCase().includes(q);
        const matchAmount = String(r.amount || "").includes(q);
        if (!matchName && !matchCategory && !matchDesc && !matchRef && !matchAmount) return false;
      }

      // Method filter
      if (methodFilter !== "all") {
        if ((r.payment_method || "Cash").toLowerCase() !== methodFilter.toLowerCase()) {
          return false;
        }
      }

      // Date filter
      if (dateFilterType !== "all") {
        if (dateFilterType === "custom") {
          if (customFilterStart && r.date < customFilterStart) return false;
          if (customFilterEnd && r.date > customFilterEnd) return false;
        } else if (presets[dateFilterType]) {
          const { start, end } = presets[dateFilterType];
          if (r.date < start || r.date > end) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "latest") {
        const dateComp = (b.date || "").localeCompare(a.date || "");
        if (dateComp !== 0) return dateComp;
        return (b.created_at || "").localeCompare(a.created_at || "");
      }
      if (sortBy === "oldest") {
        const dateComp = (a.date || "").localeCompare(b.date || "");
        if (dateComp !== 0) return dateComp;
        return (a.created_at || "").localeCompare(b.created_at || "");
      }
      if (sortBy === "amount-high") {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }
      if (sortBy === "amount-low") {
        return Number(a.amount || 0) - Number(b.amount || 0);
      }
      return 0;
    });
  }, [records, recipientFilter, categoryFilter, search, methodFilter, dateFilterType, customFilterStart, customFilterEnd, sortBy]);

  // Overall Statistics for current active view
  const stats = useMemo(() => {
    const totalAmount = filteredRecords.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const count = filteredRecords.length;
    const recipientsSet = new Set(filteredRecords.map((r) => r.recipient_name));
    const avg = count > 0 ? totalAmount / count : 0;
    return {
      totalAmount,
      count,
      uniqueRecipients: recipientsSet.size,
      avg,
    };
  }, [filteredRecords]);

  // Calculate matching records for PDF Modal based on selected range and recipient
  const pdfModalTargetRange = useMemo(() => {
    const presets = getDateRangePresets();
    if (pdfRangeType === "custom") {
      return {
        label: "Custom Period",
        start: pdfCustomStart,
        end: pdfCustomEnd,
      };
    }
    return presets[pdfRangeType] || presets.thisMonth;
  }, [pdfRangeType, pdfCustomStart, pdfCustomEnd]);

  const pdfMatchingRecords = useMemo(() => {
    const { start, end } = pdfModalTargetRange;
    return records
      .filter((r) => {
        if (!r.date) return false;
        if (start && r.date < start) return false;
        if (end && r.date > end) return false;
        if (pdfRecipient !== "all" && (r.recipient_name || "").toLowerCase() !== pdfRecipient.toLowerCase()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.time || "").localeCompare(a.time || ""));
  }, [records, pdfModalTargetRange, pdfRecipient]);

  const pdfTotalAmount = useMemo(() => {
    return pdfMatchingRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [pdfMatchingRecords]);

  // Trigger PDF Generation
  const handleDownloadPDF = () => {
    if (pdfMatchingRecords.length === 0) {
      alert("No payment records found matching your selected criteria. Please adjust your date range or recipient.");
      return;
    }

    try {
      generatePaymentReportPDF(pdfMatchingRecords, {
        dateRange: pdfModalTargetRange,
        recipient: pdfRecipient,
      });
      setPdfModalOpen(false);
    } catch (err) {
      alert("Error generating PDF: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Payment Records</h1>
            <Badge color="green">KES</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track money sent to bosses, directors & individuals with multi-period statements & PDF reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Manage Bosses Button */}
          {isPrivileged && (
            <button
              type="button"
              onClick={() => {
                handleOpenAddBoss();
                setBossesModalOpen(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all hover:border-slate-300 cursor-pointer"
            >
              <span>👔</span>
              <span>Manage Bosses</span>
              <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                {bosses.length}
              </span>
            </button>
          )}

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={() => {
              setPdfRecipient("all");
              setPdfModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:shadow-md cursor-pointer"
          >
            <span className="text-base">📄</span>
            <span>Download Payment Report (PDF)</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={() => {
              const label = recipientFilter !== "all" ? recipientFilter.replace(/[^a-zA-Z0-9]/g, "_") : "All_Recipients";
              exportPaymentRecordsCSV(filteredRecords, `Payment_Records_${label}_${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
            title="Export filtered records as CSV spreadsheet"
          >
            <span>📊</span>
            <span>CSV</span>
          </button>

          {/* Add Payment Button (Admin only) */}
          {isPrivileged ? (
            <button
              type="button"
              onClick={openAddModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/20 transition-all hover:shadow-md cursor-pointer"
            >
              <span className="text-base font-bold">+</span>
              <span>Add Payment</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 italic">View-only mode</div>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label={recipientFilter !== "all" ? `Sent to ${recipientFilter}` : "Total Amount Paid"}
          value={formatKES(stats.totalAmount)}
          icon="💰"
          color="green"
          sub={`${stats.count} transactions recorded`}
        />
        <StatCard
          label="Total Transactions"
          value={stats.count}
          icon="📋"
          color="blue"
          sub="Filtered records"
        />
        <StatCard
          label="Unique Recipients"
          value={stats.uniqueRecipients}
          icon="👥"
          color="amber"
          sub="Beneficiaries"
        />
        <StatCard
          label="Average Payment"
          value={formatKES(stats.avg)}
          icon="📊"
          color="slate"
          sub="Per transaction"
        />
      </div>

      {/* QUICK RECIPIENT / BOSS FILTER CHIPS */}
      {recipientTotalsOverTime.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Cash Sent to Bosses & Beneficiaries Over Time
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 rounded-md transition-all ${
                  viewMode === "list" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Transactions List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("breakdown")}
                className={`px-3 py-1 rounded-md transition-all ${
                  viewMode === "breakdown" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Boss Breakdown
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button
              type="button"
              onClick={() => setRecipientFilter("all")}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                recipientFilter === "all"
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>All Recipients</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${recipientFilter === "all" ? "bg-emerald-700 text-emerald-100" : "bg-white text-slate-600"}`}>
                {records.length}
              </span>
            </button>

            {recipientTotalsOverTime.map((rec) => {
              const isSelected = recipientFilter.toLowerCase() === rec.name.toLowerCase();
              return (
                <button
                  key={rec.name}
                  type="button"
                  onClick={() => setRecipientFilter(isSelected ? "all" : rec.name)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  <span className="text-sm">👤</span>
                  <span>{rec.name}</span>
                  <span className={`font-black ${isSelected ? "text-emerald-400" : "text-emerald-700"}`}>
                    {formatKES(rec.totalAmount)}
                  </span>
                  <span className={`text-[10px] px-1 rounded ${isSelected ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"}`}>
                    {rec.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* RECIPIENT BREAKDOWN CARDS VIEW (When in 'breakdown' view mode) */}
      {viewMode === "breakdown" && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Bosses & Recipients Total Cash Summary</h2>
              <p className="text-xs text-slate-400">Total money remitted over all recorded transactions</p>
            </div>
            <span className="text-xs font-black text-slate-700">
              {recipientTotalsOverTime.length} Beneficiaries
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipientTotalsOverTime.map((item) => (
              <div
                key={item.name}
                className="p-4 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50/60 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-800 font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h3>
                      <Badge color="slate">{item.category}</Badge>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-100 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Total Received Over Time:</span>
                    <span className="font-black text-emerald-700 text-sm">{formatKES(item.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Transactions:</span>
                    <span className="font-bold text-slate-700">{item.count} payments</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Latest Payment:</span>
                    <span className="font-semibold text-slate-600">{formatDateKE(item.lastDate)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientFilter(item.name);
                      setViewMode("list");
                    }}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors text-center"
                  >
                    View Trips / History
                  </button>
                  <button
                    type="button"
                    onClick={() => openPdfModalForRecipient(item.name)}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors text-center shadow-xs"
                  >
                    Statement (PDF)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filter & Quick Options Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient, reason..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Recipient Filter Dropdown */}
          <div>
            <select
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
            >
              <option value="all">👤 All Recipients / Bosses</option>
              {existingRecipients.map((rec) => (
                <option key={rec} value={rec}>
                  {rec}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
            >
              <option value="all">🏷️ All Categories</option>
              {RECIPIENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Preset */}
          <div>
            <select
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
            >
              <option value="all">📅 All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="thisWeek">This Week</option>
              <option value="last7Days">Last 7 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
            >
              <option value="all">💳 All Payment Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Row when 'custom' is selected */}
        {dateFilterType === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500">Filter Range:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">From:</span>
              <input
                type="date"
                value={customFilterStart}
                onChange={(e) => setCustomFilterStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">To:</span>
              <input
                type="date"
                value={customFilterEnd}
                onChange={(e) => setCustomFilterEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>
            {(customFilterStart || customFilterEnd) && (
              <button
                onClick={() => {
                  setCustomFilterStart("");
                  setCustomFilterEnd("");
                }}
                className="text-rose-600 hover:underline font-bold text-xs"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Payment History List / Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">
                Payment History
                {recipientFilter !== "all" && (
                  <span className="text-emerald-700 ml-1.5 font-black">
                    — {recipientFilter}
                  </span>
                )}
              </h2>
              {recipientFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setRecipientFilter("all")}
                  className="text-[11px] text-slate-400 hover:text-slate-700 underline font-semibold"
                >
                  Show All
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Showing {filteredRecords.length} of {records.length} total payments
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Filtered Total</span>
            <span className="text-sm sm:text-base font-black text-emerald-600">{formatKES(stats.totalAmount)}</span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-3xl animate-bounce mb-2">💵</div>
            <p className="text-sm font-semibold">Loading payment records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="text-4xl">📂</div>
            <p className="text-sm font-bold text-slate-600">No payment records found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No transactions match your current filters or search terms. Try adjusting the filter or record a new payment.
            </p>
            {isPrivileged && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                + Record First Payment
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description / Reason</th>
                    <th className="py-3 px-4">Method & Reference</th>
                    <th className="py-3 px-4 text-right">Amount (KES)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => {
                    const methodBadgeColor =
                      rec.payment_method === "M-Pesa"
                        ? "green"
                        : rec.payment_method === "Bank Transfer"
                        ? "blue"
                        : "slate";

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Date & Time */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-800 block">{formatDateKE(rec.date)}</span>
                          <span className="text-[11px] text-slate-400">{rec.time || "—"}</span>
                        </td>

                        {/* Recipient */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                              {(rec.recipient_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800 text-sm">{rec.recipient_name}</span>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge color="slate">{rec.recipient_category || "Boss / Director"}</Badge>
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                          {rec.description || <span className="text-slate-400 italic">No description</span>}
                        </td>

                        {/* Payment Method & Ref */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge color={methodBadgeColor}>{rec.payment_method || "Cash"}</Badge>
                            {rec.reference_number && (
                              <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {rec.reference_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="font-black text-emerald-700 text-sm">
                            {formatKES(rec.amount)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewRecord(rec)}
                              title="View Details"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              👁️
                            </button>
                            {isPrivileged && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(rec)}
                                  title="Edit Payment"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmRecord(rec)}
                                  title="Delete Payment"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Visible only on mobile) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredRecords.map((rec) => (
                <div key={rec.id} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                        {(rec.recipient_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm leading-tight">{rec.recipient_name}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatDateKE(rec.date)} • {rec.time || "—"}
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-emerald-700 text-base">{formatKES(rec.amount)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge color="slate">{rec.recipient_category || "Boss / Director"}</Badge>
                    <Badge color={rec.payment_method === "M-Pesa" ? "green" : "slate"}>
                      {rec.payment_method || "Cash"}
                    </Badge>
                  </div>

                  {rec.description && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">{rec.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {rec.reference_number && (
                        <span className="text-[10px] font-mono text-slate-400">{rec.reference_number}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewRecord(rec)}
                        className="px-2 py-1 rounded bg-slate-100 text-[11px] font-bold text-slate-600"
                      >
                        Details
                      </button>
                      {isPrivileged && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="px-2 py-1 rounded bg-emerald-50 text-[11px] font-bold text-emerald-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmRecord(rec)}
                            className="px-2 py-1 rounded bg-rose-50 text-[11px] font-bold text-rose-600"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: ADD / EDIT PAYMENT
         ========================================================================= */}
      <Modal
        open={addModalOpen || !!editRecord}
        onClose={() => {
          setAddModalOpen(false);
          setEditRecord(null);
        }}
        title={editRecord ? "Edit Payment Record" : "Add Payment Record"}
        wide
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <datalist id="recipients-list">
            {existingRecipients.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          {/* Quick Boss / Recipient Selector */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Boss / Director
              </label>
              {isPrivileged && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenAddBoss();
                    setBossesModalOpen(true);
                  }}
                  className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>👔 Manage Bosses</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {bosses.map((b) => {
                const isSelected = formRecipient.toLowerCase() === b.name.toLowerCase();
                return (
                  <button
                    key={b.id || b.name}
                    type="button"
                    onClick={() => {
                      setFormRecipient(b.name);
                      setFormCategory(b.title?.includes("Partner") ? "Partner / Owner" : "Boss / Director");
                      setPaymentSelectedBossId(b.id);
                      setSaveAsBossCheckbox(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40"
                    }`}
                  >
                    <span>👤</span>
                    <span>{b.name}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded ${
                        isSelected ? "bg-emerald-700 text-emerald-100" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {b.title || "Boss"}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setPaymentSelectedBossId("custom");
                  setFormRecipient("");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  paymentSelectedBossId === "custom" &&
                  !(bosses || []).some(
                    (b) => (b?.name || "").toLowerCase() === (formRecipient || "").toLowerCase()
                  )
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>✍️ Custom / Other Recipient</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recipient Name */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Recipient Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                list="recipients-list"
                value={formRecipient}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormRecipient(val);
                  const matched = (bosses || []).find(
                    (b) => (b?.name || "").toLowerCase() === (val || "").toLowerCase()
                  );
                  if (matched) {
                    setPaymentSelectedBossId(matched.id);
                  } else {
                    setPaymentSelectedBossId("custom");
                  }
                }}
                placeholder="e.g. John, Peter, David"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold"
              />
              {/* Checkbox to add as new boss if it's not already in bosses directory */}
              {isPrivileged &&
                !(bosses || []).some(
                  (b) => (b?.name || "").toLowerCase() === (formRecipient || "").trim().toLowerCase()
                ) &&
                formRecipient.trim().length > 1 && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsBossCheckbox}
                      onChange={(e) => setSaveAsBossCheckbox(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      Save <strong>{formRecipient.trim()}</strong> to Bosses Directory for future selection
                    </span>
                  </label>
                )}
            </div>

            {/* Recipient Category */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Category / Role
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
              >
                {RECIPIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Paid */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Amount Paid (KES) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400">
                  KES
                </span>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="e.g. 8700"
                  className="w-full pl-12 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-black text-slate-800"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Number */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Reference Number (Optional)
              </label>
              <input
                type="text"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                placeholder="e.g. M-Pesa Code / Bank Ref"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Description / Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Description / Reason (Optional)
            </label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Explain what the payment was for (e.g. Sent to Director John, weekly logistics allowance, spare parts)..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setAddModalOpen(false);
                setEditRecord(null);
              }}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : editRecord ? "Update Payment" : "Save Payment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: VIEW PAYMENT DETAILS
         ========================================================================= */}
      <Modal open={!!viewRecord} onClose={() => setViewRecord(null)} title="Payment Details">
        {viewRecord && (
          <div className="space-y-4">
            {/* Top highlight banner */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
              <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold block mb-1">
                Amount Paid
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-800">
                {formatKES(viewRecord.amount)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 font-bold">Recipient:</span>
                <span className="font-bold text-slate-800">{viewRecord.recipient_name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 font-bold">Category:</span>
                <Badge color="slate">{viewRecord.recipient_category || "Boss / Director"}</Badge>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 font-bold">Date:</span>
                <span className="font-semibold text-slate-700">{formatDateKE(viewRecord.date)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 font-bold">Time:</span>
                <span className="font-semibold text-slate-700">{viewRecord.time || "—"}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 font-bold">Payment Method:</span>
                <Badge color="green">{viewRecord.payment_method || "Cash"}</Badge>
              </div>
              {viewRecord.reference_number && (
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-400 font-bold">Reference Number:</span>
                  <span className="font-mono text-slate-800 font-bold">{viewRecord.reference_number}</span>
                </div>
              )}
              <div className="py-2.5">
                <span className="text-slate-400 font-bold block mb-1">Description / Reason:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg">
                  {viewRecord.description || "No description provided."}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 3: DELETE CONFIRMATION
         ========================================================================= */}
      <Modal
        open={!!deleteConfirmRecord}
        onClose={() => setDeleteConfirmRecord(null)}
        title="Confirm Deletion"
      >
        {deleteConfirmRecord && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete the payment record for{" "}
              <strong className="text-slate-900">{deleteConfirmRecord.recipient_name}</strong> of{" "}
              <strong className="text-rose-600">{formatKES(deleteConfirmRecord.amount)}</strong> made on{" "}
              <strong>{formatDateKE(deleteConfirmRecord.date)}</strong>?
            </p>
            <p className="text-xs text-slate-400">This action cannot be undone.</p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmRecord(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all"
              >
                {saving ? "Deleting..." : "Yes, Delete Payment"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 4: PROFESSIONAL PDF REPORT GENERATION & DATE RANGE SELECTION
         ========================================================================= */}
      <Modal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={pdfRecipient !== "all" ? `Generate Statement for ${pdfRecipient} (PDF)` : "Generate Payment Report (PDF)"}
        wide
      >
        <div className="space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <p className="text-xs sm:text-sm text-slate-600">
              Select the reporting period and recipient to include in your branded{" "}
              <strong className="text-slate-900">Mount Kenya Water Distributors</strong> PDF payment report.
            </p>
          </div>

          {/* Recipient Selection Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Target Recipient / Boss
            </label>
            <select
              value={pdfRecipient}
              onChange={(e) => setPdfRecipient(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-bold text-slate-800"
            >
              <option value="all">📁 All Recipients (Consolidated Multi-Boss Report)</option>
              {existingRecipients.map((name) => (
                <option key={name} value={name}>
                  👤 Individual Statement: {name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selection Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Period
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "thisWeek", label: "This Week" },
                { id: "last7Days", label: "Last 7 Days" },
                { id: "thisMonth", label: "This Month" },
                { id: "lastMonth", label: "Last Month" },
                { id: "custom", label: "Custom Range" },
              ].map((opt) => {
                const isSelected = pdfRangeType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPdfRangeType(opt.id)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Pickers if 'custom' is selected */}
          {pdfRangeType === "custom" && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Start Date (From)
                </label>
                <input
                  type="date"
                  value={pdfCustomStart}
                  onChange={(e) => setPdfCustomStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  End Date (To)
                </label>
                <input
                  type="date"
                  value={pdfCustomEnd}
                  onChange={(e) => setPdfCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
            </div>
          )}

          {/* Live Range Preview & Matching Stats */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block">
                {pdfRecipient !== "all" ? `Statement for ${pdfRecipient}` : "Consolidated Report"}
              </span>
              <p className="text-sm font-bold text-slate-100 mt-0.5">
                {pdfModalTargetRange.start && pdfModalTargetRange.end
                  ? `${formatDateKE(pdfModalTargetRange.start)} to ${formatDateKE(pdfModalTargetRange.end)}`
                  : pdfModalTargetRange.label}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {pdfMatchingRecords.length} matching payment
                {pdfMatchingRecords.length === 1 ? "" : "s"} found
              </p>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                Total Cash Sent
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">
                {formatKES(pdfTotalAmount)}
              </span>
            </div>
          </div>

          {/* Table Preview of Records to be included */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 block">Records Preview</span>
            {pdfMatchingRecords.length === 0 ? (
              <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                No payment transactions fall within this criteria.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                {pdfMatchingRecords.map((r, idx) => (
                  <div key={r.id || idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-800">{r.recipient_name}</span>
                      <span className="text-slate-400 text-[11px] ml-2">
                        {formatDateKE(r.date)} ({r.time || "—"})
                      </span>
                    </div>
                    <span className="font-bold text-emerald-700">{formatKES(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer / Download Button */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPdfModalOpen(false)}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={pdfMatchingRecords.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>📥</span>
              <span>
                {pdfRecipient !== "all"
                  ? `Download ${pdfRecipient}'s Statement (PDF)`
                  : "Generate & Download PDF"}
              </span>
            </button>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 5: MANAGE BOSSES DIRECTORY (ADD, EDIT, DELETE)
         ========================================================================= */}
      <Modal
        open={bossesModalOpen}
        onClose={() => {
          setBossesModalOpen(false);
          setEditingBoss(null);
        }}
        title="Manage Bosses & Directors Directory"
        wide
      >
        <div className="space-y-6">
          <p className="text-xs sm:text-sm text-slate-600">
            Maintain the roster of bosses, directors, and executives. When you edit a boss&apos;s name, all their historical payment records will automatically update.
          </p>

          {/* Form to Register New Boss */}
          <form onSubmit={handleSaveBoss} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>➕ Register New Boss / Director</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Boss / Director Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bossFormName}
                  onChange={(e) => setBossFormName(e.target.value)}
                  placeholder="e.g. John, Peter, David"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Title / Position
                </label>
                <select
                  value={bossFormTitle}
                  onChange={(e) => setBossFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
                >
                  {BOSS_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Phone / M-Pesa Number
                </label>
                <input
                  type="text"
                  value={bossFormPhone}
                  onChange={(e) => setBossFormPhone(e.target.value)}
                  placeholder="e.g. 0712 345 678"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Notes / Responsibilities (Optional)
              </label>
              <input
                type="text"
                value={bossFormNotes}
                onChange={(e) => setBossFormNotes(e.target.value)}
                placeholder="e.g. Logistics Director, Shareholder, Primary recipient for transport fuel"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={savingBoss}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingBoss ? "Adding Boss..." : "Add Boss to Directory"}
              </button>
            </div>
          </form>

          {/* Registered Bosses List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Registered Bosses ({bosses.length})
              </span>
              <span className="text-xs text-slate-400">Click a boss to generate individual statement</span>
            </div>

            {bosses.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                No bosses registered yet. Use the form above to add your first boss.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {bosses.map((b) => {
                  const totals = recipientTotalsOverTime.find(
                    (r) => (r?.name || "").toLowerCase() === (b?.name || "").toLowerCase()
                  );
                  const totalPaid = totals?.totalAmount || 0;
                  const txCount = totals?.count || 0;

                  return (
                    <div
                      key={b.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 font-black text-sm flex items-center justify-center shrink-0">
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{b.name}</span>
                            <Badge color="slate">{b.title || "Director"}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                            {b.phone && <span>📞 {b.phone}</span>}
                            {b.notes && <span className="text-slate-400 italic">&ldquo;{b.notes}&rdquo;</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sent</span>
                          <span className="text-xs sm:text-sm font-black text-emerald-700">
                            {formatKES(totalPaid)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{txCount} payments</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setBossesModalOpen(false);
                              openPdfModalForRecipient(b.name);
                            }}
                            title="Generate PDF Statement"
                            className="p-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            📄 PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditBossClick(b)}
                            title="Edit Boss"
                            className="p-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setBossDeleteConfirm(b)}
                            title="Delete Boss"
                            className="p-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setBossesModalOpen(false);
                setEditingBoss(null);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 6: CONFIRM BOSS DELETION
         ========================================================================= */}
      <Modal
        open={!!bossDeleteConfirm}
        onClose={() => setBossDeleteConfirm(null)}
        title="Confirm Boss Deletion"
      >
        {bossDeleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to remove{" "}
              <strong className="text-slate-900">{bossDeleteConfirm.name}</strong> ({bossDeleteConfirm.title || "Boss"}) from the Bosses Directory?
            </p>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-bold">⚠️ Note on Financial History:</p>
              <p>
                Removing this boss profile will NOT delete any historical payment transactions sent to them. All past payment records will be preserved for financial auditing and reporting.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBossDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBoss}
                disabled={savingBoss}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingBoss ? "Removing..." : "Yes, Remove Boss"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 7: DEDICATED EDIT BOSS PROFILE MODAL
         ========================================================================= */}
      <Modal
        open={!!editingBoss}
        onClose={() => setEditingBoss(null)}
        title={editingBoss ? `Edit Boss: ${editingBoss.name}` : "Edit Boss Profile"}
      >
        {editingBoss && (
          <form onSubmit={handleSaveBoss} className="space-y-4">
            <p className="text-xs text-slate-500">
              Update boss profile details. If you change the boss&apos;s name, all past payment transactions sent to them will automatically update to reflect the new name.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Boss / Director Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={bossFormName}
                onChange={(e) => setBossFormName(e.target.value)}
                placeholder="e.g. John, Peter, David"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Title / Position
                </label>
                <select
                  value={bossFormTitle}
                  onChange={(e) => setBossFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
                >
                  {BOSS_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Phone / M-Pesa Number
                </label>
                <input
                  type="text"
                  value={bossFormPhone}
                  onChange={(e) => setBossFormPhone(e.target.value)}
                  placeholder="e.g. 0712 345 678"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Notes / Responsibilities (Optional)
              </label>
              <textarea
                rows={2}
                value={bossFormNotes}
                onChange={(e) => setBossFormNotes(e.target.value)}
                placeholder="e.g. Logistics Director, Shareholder, Primary recipient for transport fuel"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingBoss(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingBoss}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingBoss ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
