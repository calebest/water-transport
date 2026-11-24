import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { StatCard, Badge, Modal } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { dailyMileageService } from "../services/dailyMileage";
import { exportMileageCSV, exportMileagePDF } from "../utils/mileageExport";

// Helper: Format date as YYYY-MM-DD in local time
const toISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Helper: Format date for display (e.g., "23 Nov 2026")
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-KE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
};

// Preset Date Ranges
const getPresets = () => {
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

  // This Year
  const firstThisYear = `${now.getFullYear()}-01-01`;
  const lastThisYear = `${now.getFullYear()}-12-31`;

  // Last Year
  const firstLastYear = `${now.getFullYear() - 1}-01-01`;
  const lastLastYear = `${now.getFullYear() - 1}-12-31`;

  return {
    today: { key: "today", label: "Today", start: todayStr, end: todayStr },
    yesterday: { key: "yesterday", label: "Yesterday", start: yesterdayStr, end: yesterdayStr },
    thisWeek: { key: "thisWeek", label: "This Week", start: weekStartStr, end: weekEndStr },
    last7Days: { key: "last7Days", label: "Last 7 Days", start: last7Str, end: todayStr },
    thisMonth: { key: "thisMonth", label: "This Month", start: firstThisMonth, end: lastThisMonth },
    lastMonth: { key: "lastMonth", label: "Last Month", start: firstLastMonth, end: lastLastMonth },
    thisYear: { key: "thisYear", label: "This Year", start: firstThisYear, end: lastThisYear },
    lastYear: { key: "lastYear", label: "Last Year", start: firstLastYear, end: lastLastYear },
  };
};

const VEHICLE_COLORS = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#6366f1"];

const DAILY_MILEAGE_SQL = `-- 1. Create Daily Mileage Table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.daily_mileage (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_plate TEXT NOT NULL,
  mileage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  kilometers_covered NUMERIC NOT NULL CHECK (kilometers_covered >= 0),
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_vehicle_plate_daily_mileage UNIQUE (vehicle_plate, mileage_date)
);

-- 2. Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_daily_mileage_date ON public.daily_mileage (mileage_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_mileage_plate ON public.daily_mileage (vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_daily_mileage_vehicle ON public.daily_mileage (vehicle_id);

-- 3. Row Level Security
ALTER TABLE public.daily_mileage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view daily_mileage" ON public.daily_mileage;
CREATE POLICY "Authenticated users view daily_mileage" ON public.daily_mileage FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users insert daily_mileage" ON public.daily_mileage;
CREATE POLICY "Authenticated users insert daily_mileage" ON public.daily_mileage FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authorized users update daily_mileage" ON public.daily_mileage;
CREATE POLICY "Authorized users update daily_mileage" ON public.daily_mileage FOR UPDATE USING (public.user_role() IN ('admin', 'owner') OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins delete daily_mileage" ON public.daily_mileage;
CREATE POLICY "Admins delete daily_mileage" ON public.daily_mileage FOR DELETE USING (public.user_role() IN ('admin', 'owner') OR auth.uid() = created_by);`;

export default function DailyMileagePage({
  vehicles = [],
  mileageRecords = [],
  refreshMileage,
}) {
  const { user, isAdmin, isOwner } = useAuth();
  const isPrivileged = isAdmin || isOwner;

  // Sync / Database Status
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncingNow, setSyncingNow] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    let mounted = true;
    dailyMileageService.checkTableStatus().then((res) => {
      if (mounted) setSyncStatus(res);
    });

    const handleSyncChange = (e) => {
      if (mounted) setSyncStatus(e.detail);
    };

    window.addEventListener("mileage_sync_status", handleSyncChange);
    return () => {
      mounted = false;
      window.removeEventListener("mileage_sync_status", handleSyncChange);
    };
  }, []);

  const handleVerifyAndSync = async () => {
    setSyncingNow(true);
    try {
      const res = await dailyMileageService.checkTableStatus(true);
      setSyncStatus(res);
      if (res.tableExists) {
        const syncRes = await dailyMileageService.syncLocalToRemote();
        if (refreshMileage) refreshMileage();
        alert(
          syncRes.count > 0
            ? `Successfully connected to Supabase and synced ${syncRes.count} local record(s) to the server!`
            : "Supabase table connected successfully! All records are in sync."
        );
        setShowSqlModal(false);
      } else {
        alert(
          "Table 'daily_mileage' is not detected in Supabase yet.\n\nPlease open your Supabase Dashboard > SQL Editor, paste the SQL script, and click 'Run'. Then click this button again."
        );
      }
    } finally {
      setSyncingNow(false);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(DAILY_MILEAGE_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      setShowSqlModal(true);
    }
  };

  // Active records: prioritize prop, or fallback to internal state
  const [internalRecords, setInternalRecords] = useState(mileageRecords || []);
  useEffect(() => {
    if (mileageRecords) setInternalRecords(mileageRecords);
  }, [mileageRecords]);

  const records = internalRecords;

  // Filter State
  const presets = useMemo(() => getPresets(), []);
  const [activePreset, setActivePreset] = useState("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Chart View State: 'trend' | 'vehicles'
  const [chartView, setChartView] = useState("trend");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    vehicleId: "",
    vehiclePlate: "",
    mileageDate: toISODate(),
    kilometersCovered: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Compute Current Active Date Range
  const activeDateRange = useMemo(() => {
    if (activePreset === "custom") {
      return {
        start: customStart || "2000-01-01",
        end: customEnd || "2099-12-31",
        label: `${customStart || "Start"} to ${customEnd || "End"}`,
      };
    }
    const p = presets[activePreset] || presets.thisMonth;
    return {
      start: p.start,
      end: p.end,
      label: p.label,
    };
  }, [activePreset, customStart, customEnd, presets]);

  // Filter Records by Date Range and Vehicle
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Date filter
      const d = r.mileage_date;
      if (activeDateRange.start && d < activeDateRange.start) return false;
      if (activeDateRange.end && d > activeDateRange.end) return false;

      // Vehicle filter
      if (selectedVehicle !== "all") {
        if (r.vehicle_id !== selectedVehicle && r.vehicle_plate !== selectedVehicle) {
          return false;
        }
      }

      // Search query (notes or plate)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPlate = (r.vehicle_plate || "").toLowerCase().includes(q);
        const matchesNotes = (r.notes || "").toLowerCase().includes(q);
        if (!matchesPlate && !matchesNotes) return false;
      }

      return true;
    });
  }, [records, activeDateRange, selectedVehicle, searchQuery]);

  // Statistics Calculations
  const todayStr = useMemo(() => toISODate(), []);

  // Today's stats
  const todayStats = useMemo(() => {
    const todayRecords = records.filter((r) => r.mileage_date === todayStr);
    const totalKm = todayRecords.reduce((sum, r) => sum + Number(r.kilometers_covered || 0), 0);
    const vehicleBreakdown = {};
    todayRecords.forEach((r) => {
      vehicleBreakdown[r.vehicle_plate] = Number(r.kilometers_covered || 0);
    });
    return {
      totalKm,
      recordedCount: todayRecords.length,
      vehicleBreakdown,
    };
  }, [records, todayStr]);

  // Weekly stats
  const weekStats = useMemo(() => {
    const { start, end } = presets.thisWeek;
    const weekRecords = records.filter((r) => r.mileage_date >= start && r.mileage_date <= end);
    const totalKm = weekRecords.reduce((sum, r) => sum + Number(r.kilometers_covered || 0), 0);
    return { totalKm, count: weekRecords.length };
  }, [records, presets.thisWeek]);

  // Monthly stats & comparison
  const monthStats = useMemo(() => {
    const thisMonthRecs = records.filter(
      (r) => r.mileage_date >= presets.thisMonth.start && r.mileage_date <= presets.thisMonth.end
    );
    const lastMonthRecs = records.filter(
      (r) => r.mileage_date >= presets.lastMonth.start && r.mileage_date <= presets.lastMonth.end
    );

    const thisMonthKm = thisMonthRecs.reduce((sum, r) => sum + Number(r.kilometers_covered || 0), 0);
    const lastMonthKm = lastMonthRecs.reduce((sum, r) => sum + Number(r.kilometers_covered || 0), 0);

    const diffKm = thisMonthKm - lastMonthKm;
    const pctChange =
      lastMonthKm > 0 ? Math.round(((thisMonthKm - lastMonthKm) / lastMonthKm) * 100) : null;

    return {
      thisMonthKm,
      lastMonthKm,
      diffKm,
      pctChange,
    };
  }, [records, presets.thisMonth, presets.lastMonth]);

  // Yearly stats
  const yearStats = useMemo(() => {
    const yearRecs = records.filter(
      (r) => r.mileage_date >= presets.thisYear.start && r.mileage_date <= presets.thisYear.end
    );
    const totalKm = yearRecs.reduce((sum, r) => sum + Number(r.kilometers_covered || 0), 0);
    return { totalKm, count: yearRecs.length };
  }, [records, presets.thisYear]);

  // Filtered period totals
  const periodSummary = useMemo(() => {
    const totalKm = filteredRecords.reduce((sum, r) => sum + Number(r.kilometers_covered || 0), 0);
    const uniqueDates = new Set(filteredRecords.map((r) => r.mileage_date));
    const daysCount = uniqueDates.size;
    const dailyAvg = daysCount > 0 ? Math.round(totalKm / daysCount) : 0;

    // Highest single entry
    let maxEntry = null;
    filteredRecords.forEach((r) => {
      const val = Number(r.kilometers_covered || 0);
      if (!maxEntry || val > maxEntry.val) {
        maxEntry = { val, plate: r.vehicle_plate, date: r.mileage_date };
      }
    });

    // Breakdown per vehicle in filtered period
    const byVehicle = {};
    filteredRecords.forEach((r) => {
      const plate = r.vehicle_plate || "Other";
      byVehicle[plate] = (byVehicle[plate] || 0) + Number(r.kilometers_covered || 0);
    });

    // Identify Fleet Leader (vehicle with highest mileage in range)
    let leader = null;
    Object.entries(byVehicle).forEach(([plate, km]) => {
      if (!leader || km > leader.km) {
        leader = { plate, km };
      }
    });

    return {
      totalKm,
      daysCount,
      dailyAvg,
      maxEntry,
      byVehicle,
      leader,
    };
  }, [filteredRecords]);

  // Prepare Daily Trend Chart Data
  const trendChartData = useMemo(() => {
    // Group filtered records by date
    const dateMap = {};
    filteredRecords.forEach((r) => {
      const d = r.mileage_date;
      if (!dateMap[d]) {
        dateMap[d] = { date: d, displayDate: formatDateDisplay(d), total: 0 };
      }
      dateMap[d].total += Number(r.kilometers_covered || 0);
      dateMap[d][r.vehicle_plate] = (dateMap[d][r.vehicle_plate] || 0) + Number(r.kilometers_covered || 0);
    });

    // Sort ascending by date for chronological trend
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // Prepare Vehicle Comparison Chart Data
  const vehicleChartData = useMemo(() => {
    return Object.entries(periodSummary.byVehicle).map(([plate, km], i) => ({
      name: plate,
      kilometers: km,
      color: VEHICLE_COLORS[i % VEHICLE_COLORS.length],
    }));
  }, [periodSummary.byVehicle]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Check for duplicate entry on form changes
  const checkForDuplicate = (vPlateOrId, dateStr, currentEditId = null) => {
    if (!vPlateOrId || !dateStr) {
      setDuplicateWarning(null);
      return false;
    }
    const matched = dailyMileageService.checkExists(records, vPlateOrId, dateStr, currentEditId);
    if (matched) {
      setDuplicateWarning(matched);
      return true;
    }
    setDuplicateWarning(null);
    return false;
  };

  // Open Add Modal
  const handleOpenAddModal = (presetPlate = null) => {
    const defaultPlate = presetPlate || vehicles[0]?.plate || "";
    const defaultVeh = vehicles.find((v) => v.plate === defaultPlate);

    setEditingRecord(null);
    setFormData({
      vehicleId: defaultVeh?.id || "",
      vehiclePlate: defaultPlate,
      mileageDate: toISODate(),
      kilometersCovered: "",
      notes: "",
    });
    setFormError("");
    checkForDuplicate(defaultVeh?.id || defaultPlate, toISODate());
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (record) => {
    setEditingRecord(record);
    setFormData({
      vehicleId: record.vehicle_id || "",
      vehiclePlate: record.vehicle_plate || "",
      mileageDate: record.mileage_date || toISODate(),
      kilometersCovered: String(record.kilometers_covered ?? ""),
      notes: record.notes || "",
    });
    setFormError("");
    setDuplicateWarning(null);
    setModalOpen(true);
  };

  // Handle Form Input Change
  const handleFormChange = (field, value) => {
    const updated = { ...formData, [field]: value };

    if (field === "vehiclePlate") {
      const match = vehicles.find((v) => v.plate === value);
      updated.vehicleId = match?.id || "";
    }

    setFormData(updated);

    if (field === "vehiclePlate" || field === "mileageDate") {
      const idOrPlate = updated.vehicleId || updated.vehiclePlate;
      checkForDuplicate(idOrPlate, updated.mileageDate, editingRecord?.id);
    }
  };

  // Switch from duplicate warning to editing existing record
  const handleSwitchToEditDuplicate = () => {
    if (duplicateWarning) {
      handleOpenEditModal(duplicateWarning);
    }
  };

  // Save Record
  const handleSaveRecord = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.vehiclePlate) {
      setFormError("Please select a vehicle.");
      return;
    }

    const km = Number(formData.kilometersCovered);
    if (isNaN(km) || formData.kilometersCovered === "" || km < 0) {
      setFormError("Please enter a valid, non-negative distance in kilometers.");
      return;
    }

    if (!formData.mileageDate) {
      setFormError("Please select a valid date.");
      return;
    }

    // Duplicate check
    const isDup = checkForDuplicate(
      formData.vehicleId || formData.vehiclePlate,
      formData.mileageDate,
      editingRecord?.id
    );
    if (isDup) {
      setFormError(
        `A mileage entry for ${formData.vehiclePlate} on ${formData.mileageDate} already exists. Please edit that record instead.`
      );
      return;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await dailyMileageService.update(editingRecord.id, {
          vehicle_id: formData.vehicleId,
          vehicle_plate: formData.vehiclePlate,
          mileage_date: formData.mileageDate,
          kilometers_covered: km,
          notes: formData.notes,
        });
      } else {
        await dailyMileageService.create(
          {
            vehicle_id: formData.vehicleId,
            vehicle_plate: formData.vehiclePlate,
            mileage_date: formData.mileageDate,
            kilometers_covered: km,
            notes: formData.notes,
          },
          user?.id || null
        );
      }

      if (refreshMileage) refreshMileage();
      setModalOpen(false);
    } catch (err) {
      console.error("Save mileage error:", err);
      setFormError(err.message || "Failed to save mileage entry.");
    } finally {
      setSaving(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (record) => {
    setRecordToDelete(record);
    setDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    try {
      await dailyMileageService.delete(recordToDelete.id);
      if (refreshMileage) refreshMileage();
      setDeleteModalOpen(false);
      setRecordToDelete(null);
    } catch (err) {
      console.error("Delete mileage error:", err);
      alert("Failed to delete record: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER BANNER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
              🛣️
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Daily Mileage Tracking
                </h1>
                {syncStatus?.tableExists === true ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Cloud Synced
                  </span>
                ) : syncStatus?.tableExists === false ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Offline Cache Only
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Independent daily distance logging per vehicle for fleet monitoring & maintenance scheduling.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => exportMileageCSV(filteredRecords, { vehicle: selectedVehicle })}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
          >
            <span>📊</span>
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportMileagePDF(filteredRecords, {
                title: "Daily Mileage Report",
                dateRangeLabel: activeDateRange.label,
                vehicleFilter: selectedVehicle === "all" ? "All Vehicles" : selectedVehicle,
                summary: periodSummary,
              })
            }
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
          >
            <span>📥</span>
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-sm shadow-sky-600/25 cursor-pointer hover:scale-[1.02]"
          >
            <span>+</span>
            <span>Record Today's Mileage</span>
          </button>
        </div>
      </div>

      {/* ── DATABASE SYNC WARNING BANNER ── */}
      {syncStatus?.tableExists === false && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50/90 p-4 sm:p-5 text-amber-950 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-2xl shrink-0">⚠️</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-amber-950">Database Table Not Provisioned in Supabase</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
                    Saved on This Device Only
                  </span>
                </div>
                <p className="text-xs text-amber-900/80 mt-1 leading-relaxed break-words">
                  Your mileage logs are currently saved safely in this browser's local cache. To sync across other computers, phones, and team members, run the setup SQL in your Supabase SQL Editor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <span>📋</span>
                <span>{copiedSql ? "✓ SQL Copied!" : "Copy Setup SQL"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900 text-xs font-bold transition-all cursor-pointer"
              >
                <span>📄</span>
                <span>View Setup SQL</span>
              </button>
              <button
                type="button"
                onClick={handleVerifyAndSync}
                disabled={syncingNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>🔄</span>
                <span>{syncingNow ? "Verifying…" : "Verify & Sync Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLEET TODAY STATUS STRIP ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-base">🚚</span>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Today's Fleet Activity ({formatDateDisplay(todayStr)})
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {todayStats.recordedCount} of {vehicles.length || 2} vehicles logged today
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {vehicles.map((v) => {
            const km = todayStats.vehicleBreakdown[v.plate];
            const isLogged = km !== undefined;
            return (
              <div
                key={v.id || v.plate}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isLogged
                    ? "bg-emerald-50/60 border-emerald-200/80 shadow-2xs"
                    : "bg-slate-50/70 border-slate-200/70"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-sm text-slate-900">{v.plate}</span>
                    <span className="text-[10px] text-slate-400 font-medium truncate">
                      {v.type || v.name || "Bowser"}
                    </span>
                  </div>
                  <p className="text-xs mt-1">
                    {isLogged ? (
                      <span className="font-mono font-black text-emerald-800 text-sm">
                        {km.toLocaleString("en-KE")} KM
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium text-[11px]">Not recorded yet</span>
                    )}
                  </p>
                </div>

                {isLogged ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ✓ Logged
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(v.plate)}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-sky-50 text-sky-700 border border-slate-200 hover:border-sky-300 shadow-2xs transition-all cursor-pointer shrink-0"
                  >
                    + Log KM
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── KPI STATISTIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Today's Fleet Mileage"
          value={`${todayStats.totalKm.toLocaleString("en-KE")} KM`}
          icon="⚡"
          color="sky"
          sub={`${todayStats.recordedCount} vehicles active today`}
        />
        <StatCard
          label="Weekly Mileage (This Week)"
          value={`${weekStats.totalKm.toLocaleString("en-KE")} KM`}
          icon="📅"
          color="blue"
          sub={`${weekStats.count} daily records logged`}
        />
        <StatCard
          label="Monthly Mileage (This Month)"
          value={`${monthStats.thisMonthKm.toLocaleString("en-KE")} KM`}
          icon="📈"
          color="green"
          sub={
            monthStats.pctChange !== null
              ? `${monthStats.pctChange >= 0 ? "▲ +" : "▼ "}${monthStats.pctChange}% vs last month (${monthStats.lastMonthKm.toLocaleString("en-KE")} KM)`
              : "Current month fleet total"
          }
        />
        <StatCard
          label="Yearly Mileage (This Year)"
          value={`${yearStats.totalKm.toLocaleString("en-KE")} KM`}
          icon="🏆"
          color="amber"
          sub={`Fleet cumulative in ${new Date().getFullYear()}`}
        />
      </div>

      {/* ── FILTER & DATE RANGE BAR ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Preset Period Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {Object.values(presets).map((p) => {
              const active = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setActivePreset(p.key);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100/80 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setActivePreset("custom");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activePreset === "custom"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100/80 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Vehicle Filter & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedVehicle}
              onChange={(e) => {
                setSelectedVehicle(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
            >
              <option value="all">🚚 All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id || v.plate} value={v.plate}>
                  {v.plate} ({v.type || v.name || "Bowser"})
                </option>
              ))}
            </select>

            <div className="relative">
              <input
                type="text"
                placeholder="Search notes or plate..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-44 sm:w-56 px-3 py-1.5 pl-8 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-sky-500 shadow-2xs"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                🔍
              </span>
            </div>
          </div>
        </div>

        {/* Custom Date Pickers (visible only when 'custom' is selected) */}
        {activePreset === "custom" && (
          <div className="pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap bg-slate-50/70 p-3 rounded-2xl">
            <span className="text-xs font-bold text-slate-700">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-sky-500"
            />
            <span className="text-xs font-bold text-slate-700">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-sky-500"
            />
          </div>
        )}

        {/* Period Summary Indicator Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>📅 Showing records for:</span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
              {activeDateRange.label}
            </span>
            {selectedVehicle !== "all" && (
              <span className="font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
                Vehicle: {selectedVehicle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>
              Total: <strong className="text-slate-900">{periodSummary.totalKm.toLocaleString("en-KE")} KM</strong>
            </span>
            <span>
              Daily Avg: <strong className="text-slate-900">{periodSummary.dailyAvg.toLocaleString("en-KE")} KM</strong>
            </span>
            <span>
              Logged Days: <strong className="text-slate-900">{periodSummary.daysCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── VISUAL TREND & COMPARISON CHARTS ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Mileage Distance Analysis ({activeDateRange.label})
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setChartView("trend")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartView === "trend" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Daily Trend
            </button>
            <button
              type="button"
              onClick={() => setChartView("vehicles")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartView === "vehicles" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Vehicle Comparison
            </button>
          </div>
        </div>

        {trendChartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <span className="text-3xl">🛣️</span>
            <p className="text-xs font-semibold">No mileage records in selected date range.</p>
          </div>
        ) : chartView === "trend" ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="mileageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const totalVal = payload[0]?.value || 0;
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-3 shadow-xl text-xs">
                        <p className="font-bold text-slate-800 pb-1 mb-1.5 border-b border-slate-100">📅 {label}</p>
                        <p className="font-mono font-black text-sky-700 text-sm">{Number(totalVal).toLocaleString("en-KE")} KM Total</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#mileageGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: "bold", fill: "#334155" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val) => [`${Number(val).toLocaleString("en-KE")} KM`, "Total Distance"]}
                  contentStyle={{ borderRadius: "1rem", border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="kilometers" radius={[8, 8, 0, 0]}>
                  {vehicleChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── MILEAGE HISTORY TABLE ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900">Mileage History Ledger</h3>
            <p className="text-xs text-slate-500">
              Showing {filteredRecords.length} recorded daily mileage {filteredRecords.length === 1 ? "entry" : "entries"}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl">
              🛣️
            </div>
            <h4 className="text-sm font-bold text-slate-700">No mileage records found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no recorded distance logs matching your selected vehicle or date range.
            </p>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
            >
              + Record Mileage Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4 text-right">Distance (KM)</th>
                  <th className="py-3 px-4">Operational Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRecords.map((r) => {
                  const vehObj = vehicles.find((v) => v.plate === r.vehicle_plate || v.id === r.vehicle_id);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {formatDateDisplay(r.mileage_date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-xs px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                            {r.vehicle_plate}
                          </span>
                          {r._pendingSync && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="Saved locally in this browser. Will sync automatically once Supabase table is created.">
                              Local Cache
                            </span>
                          )}
                          {vehObj?.type && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {vehObj.type}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-slate-900">
                        {Number(r.kilometers_covered || 0).toLocaleString("en-KE")} KM
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {r.notes || <span className="text-slate-300 italic">Normal operations</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(r)}
                            title="Edit Record"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                          >
                            ✏️
                          </button>
                          {isPrivileged && (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(r)}
                              title="Delete Record"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-bold"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RECORD / EDIT MILEAGE MODAL ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRecord ? "Edit Daily Mileage Entry" : "Record Daily Mileage"}
      >
        <form onSubmit={handleSaveRecord} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              ⚠️ {formError}
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Duplicate Entry Notice</span>
              </p>
              <p>
                A record for <strong>{duplicateWarning.vehicle_plate}</strong> on{" "}
                <strong>{duplicateWarning.mileage_date}</strong> already exists (
                <strong>{duplicateWarning.kilometers_covered} KM</strong>).
              </p>
              <button
                type="button"
                onClick={handleSwitchToEditDuplicate}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
              >
                Edit That Existing Record Instead →
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Vehicle <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.vehiclePlate}
              onChange={(e) => handleFormChange("vehiclePlate", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 outline-none focus:border-sky-500 shadow-2xs"
            >
              {vehicles.map((v) => (
                <option key={v.id || v.plate} value={v.plate}>
                  {v.plate} — {v.type || v.name || "Water Bowser"} {v.capacity ? `(${v.capacity})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mileage Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.mileageDate}
              onChange={(e) => handleFormChange("mileageDate", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 shadow-2xs"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Recorded once per vehicle per day. Historical dates can be selected if logging previous runs.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Total Kilometers Covered (KM) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 185"
                value={formData.kilometersCovered}
                onChange={(e) => handleFormChange("kilometersCovered", e.target.value)}
                className="w-full px-3 py-2.5 pr-12 rounded-xl border border-slate-200 bg-white text-base font-black font-mono text-slate-900 outline-none focus:border-sky-500 shadow-2xs"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                KM
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Operational Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Normal operations, Nanyuki highway run, depot transfer..."
              value={formData.notes}
              onChange={(e) => handleFormChange("notes", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 outline-none focus:border-sky-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm shadow-sky-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : editingRecord ? "Update Mileage" : "Save Daily Mileage"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Mileage Record"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete the daily mileage record for{" "}
            <strong className="text-slate-900">{recordToDelete?.vehicle_plate}</strong> on{" "}
            <strong className="text-slate-900">{formatDateDisplay(recordToDelete?.mileage_date)}</strong> (
            <strong className="text-slate-900">{recordToDelete?.kilometers_covered} KM</strong>)?
          </p>
          <p className="text-[11px] text-rose-600 font-semibold">
            This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── SUPABASE SQL SETUP MODAL ── */}
      <Modal
        open={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        title="Supabase Database Table Setup (Daily Mileage)"
        wide
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-sky-50 border border-sky-200/80 p-4 text-xs text-sky-950 space-y-2">
            <p className="font-black text-sm text-sky-900 flex items-center gap-1.5">
              <span>🚀</span>
              <span>1-Minute Database Setup Instructions</span>
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-sky-900/90 leading-relaxed font-medium">
              <li>Open your <strong>Supabase Project Dashboard</strong> (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold text-sky-700">supabase.com</a>).</li>
              <li>Navigate to <strong>SQL Editor</strong> on the left sidebar navigation.</li>
              <li>Click <strong>+ New query</strong>, paste the SQL script below, and click <strong>Run</strong> (or press Cmd/Ctrl + Enter).</li>
              <li>Return here and click <strong>"Verify & Sync Now"</strong> below. All existing and future mileage entries will sync across all browsers and devices!</li>
            </ol>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72 scrollbar-thin select-all">
              {DAILY_MILEAGE_SQL}
            </pre>
            <button
              type="button"
              onClick={handleCopySql}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all backdrop-blur-md cursor-pointer shadow-sm"
            >
              {copiedSql ? "✓ Copied to Clipboard!" : "📋 Copy SQL"}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              File reference: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">supabase/daily_mileage.sql</code>
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleVerifyAndSync}
                disabled={syncingNow}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {syncingNow ? "Verifying with Supabase…" : "✓ I Ran the Script — Verify & Sync Now"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
