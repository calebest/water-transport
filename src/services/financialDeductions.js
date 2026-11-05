import { supabase, notifyDbMutated } from "./supabase.js";

const STORAGE_KEY = "mk_financial_deductions_cache";

const getLocalDeductions = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("[FinancialDeductions] Error reading local cache:", e);
    return [];
  }
};

const saveLocalDeductions = (deductions) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deductions));
  } catch (e) {
    console.warn("[FinancialDeductions] Error saving local cache:", e);
  }
};

const normalizeDeduction = (item) => ({
  id: item.id || `ded-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: (item.description || "").trim(),
  amount: Number(item.amount || 0),
  date: item.date || new Date().toISOString().slice(0, 10),
  category: item.category || "Vehicle Repairs & Maintenance",
  reference_number: (item.reference_number || item.referenceNumber || "").trim(),
  notes: (item.notes || "").trim(),
  included_in_trips: Boolean(item.included_in_trips ?? item.includedInTrips ?? false),
  allocated_boss: item.allocated_boss || item.allocatedBoss || "All Bosses",
  created_by: item.created_by || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
});

export const financialDeductionsService = {
  fetchAll: async () => {
    try {
      const { data, error } = await supabase
        .from("financial_deductions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[FinancialDeductions] Supabase fetch notice (falling back to cache):", error.message);
        return getLocalDeductions().map(normalizeDeduction);
      }

      const normalized = (data || []).map(normalizeDeduction);
      saveLocalDeductions(normalized);
      return normalized;
    } catch (e) {
      console.warn("[FinancialDeductions] Network/fetch exception (falling back to cache):", e.message);
      return getLocalDeductions().map(normalizeDeduction);
    }
  },

  create: async (payload, userId = null) => {
    const id = `ded-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const recordPayload = {
      id,
      description: (payload.description || "").trim(),
      amount: Number(payload.amount || 0),
      date: payload.date || nowIso.slice(0, 10),
      category: payload.category || "Vehicle Repairs & Maintenance",
      reference_number: (payload.reference_number || payload.referenceNumber || "").trim(),
      notes: (payload.notes || "").trim(),
      included_in_trips: Boolean(payload.included_in_trips ?? payload.includedInTrips ?? false),
      allocated_boss: payload.allocated_boss || payload.allocatedBoss || "All Bosses",
      created_by: userId || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Update local cache first
    const current = getLocalDeductions();
    const updatedList = [recordPayload, ...current.filter((d) => d.id !== id)];
    saveLocalDeductions(updatedList);

    // Try Supabase insert
    try {
      const { data, error } = await supabase
        .from("financial_deductions")
        .insert([recordPayload])
        .select()
        .single();

      if (error) {
        console.warn("[FinancialDeductions] Supabase insert notice (cached locally):", error.message);
      } else if (data) {
        const norm = normalizeDeduction(data);
        const refreshed = [norm, ...current.filter((d) => d.id !== id && d.id !== norm.id)];
        saveLocalDeductions(refreshed);
      }
    } catch (e) {
      console.warn("[FinancialDeductions] Supabase insert exception (cached locally):", e.message);
    }

    notifyDbMutated("financial_deductions", "POST");
    return recordPayload;
  },

  update: async (id, payload) => {
    const nowIso = new Date().toISOString();
    const updatePayload = {
      description: (payload.description || "").trim(),
      amount: Number(payload.amount || 0),
      date: payload.date,
      category: payload.category || "Vehicle Repairs & Maintenance",
      reference_number: (payload.reference_number || payload.referenceNumber || "").trim(),
      notes: (payload.notes || "").trim(),
      included_in_trips: Boolean(payload.included_in_trips ?? payload.includedInTrips ?? false),
      allocated_boss: payload.allocated_boss || payload.allocatedBoss || "All Bosses",
      updated_at: nowIso,
    };

    // Update local cache
    const current = getLocalDeductions();
    const updatedList = current.map((d) => (d.id === id ? { ...d, ...updatePayload } : d));
    saveLocalDeductions(updatedList);

    // Try Supabase update
    try {
      const { error } = await supabase
        .from("financial_deductions")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.warn("[FinancialDeductions] Supabase update notice (cached locally):", error.message);
      }
    } catch (e) {
      console.warn("[FinancialDeductions] Supabase update exception (cached locally):", e.message);
    }

    notifyDbMutated("financial_deductions", "PATCH");
    return { id, ...updatePayload };
  },

  delete: async (id) => {
    // Delete from local cache
    const current = getLocalDeductions();
    const updatedList = current.filter((d) => d.id !== id);
    saveLocalDeductions(updatedList);

    // Try Supabase delete
    try {
      const { error } = await supabase
        .from("financial_deductions")
        .delete()
        .eq("id", id);

      if (error) {
        console.warn("[FinancialDeductions] Supabase delete notice:", error.message);
      }
    } catch (e) {
      console.warn("[FinancialDeductions] Supabase delete exception:", e.message);
    }

    notifyDbMutated("financial_deductions", "DELETE");
  },

  subscribe: (callback) => {
    let mounted = true;

    const refresh = async () => {
      const data = await financialDeductionsService.fetchAll();
      if (mounted) callback(data);
    };

    refresh();

    const channelId = `financial_deductions-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_deductions" }, refresh);

    channel.subscribe();

    const handleLocalMutated = (e) => {
      if (!e.detail?.table || e.detail?.table === "financial_deductions") {
        refresh();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("db_mutated", handleLocalMutated);
    }

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("db_mutated", handleLocalMutated);
      }
    };
  },
};
