import { supabase, notifyDbMutated } from "./supabase.js";

const STORAGE_KEY = "mk_payment_records_cache";

// Clean slate: No demo or example payment records
const INITIAL_DEMO_RECORDS = [];

const getLocalRecords = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ensure all demo records are purged so the user gets a 100% clean slate
    const cleaned = parsed.filter((r) => !String(r.id || "").startsWith("demo-pmt-"));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    console.warn("[PaymentRecords] Error reading local cache:", e);
    return [];
  }
};

const saveLocalRecords = (records) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn("[PaymentRecords] Error saving local cache:", e);
  }
};

const normalizeRecord = (item) => ({
  id: item.id || `pmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  recipient_name: item.recipient_name || item.recipientName || "Unknown",
  recipient_category: item.recipient_category || item.recipientCategory || "Boss / Director",
  amount: Number(item.amount || item.amountPaid || 0),
  date: item.date || new Date().toISOString().slice(0, 10),
  time: item.time || "12:00 PM",
  description: item.description || item.reason || "",
  payment_method: item.payment_method || item.paymentMethod || "Cash",
  reference_number: item.reference_number || item.referenceNumber || "",
  created_by: item.created_by || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
});

export const paymentRecordsService = {
  fetchAll: async () => {
    try {
      const { data, error } = await supabase
        .from("payment_records")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        // Table not created yet or schema cache warming up
        console.warn("[PaymentRecords] Supabase fetch notice (falling back to cache):", error.message);
        return getLocalRecords().map(normalizeRecord);
      }

      const normalized = (data || []).map(normalizeRecord);
      saveLocalRecords(normalized);
      return normalized;
    } catch (e) {
      console.warn("[PaymentRecords] Network or fetch error, using local cache:", e.message);
      return getLocalRecords().map(normalizeRecord);
    }
  },

  create: async (payload, userId = null) => {
    const id = `pmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    
    const recordPayload = {
      id,
      recipient_name: (payload.recipient_name || payload.recipientName || "").trim(),
      recipient_category: payload.recipient_category || payload.recipientCategory || "Boss / Director",
      amount: Number(payload.amount || payload.amountPaid || 0),
      date: payload.date || nowIso.slice(0, 10),
      time: payload.time || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      description: (payload.description || payload.reason || "").trim(),
      payment_method: payload.payment_method || payload.paymentMethod || "Cash",
      reference_number: (payload.reference_number || payload.referenceNumber || "").trim(),
      created_by: userId || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Update local cache first
    const current = getLocalRecords();
    const updatedList = [recordPayload, ...current.filter((r) => r.id !== id)];
    saveLocalRecords(updatedList);

    // Try Supabase insert
    try {
      const { data, error } = await supabase
        .from("payment_records")
        .insert([recordPayload])
        .select()
        .single();

      if (error) {
        console.warn("[PaymentRecords] Supabase insert warning (cached locally):", error.message);
      } else if (data) {
        const norm = normalizeRecord(data);
        const refreshed = [norm, ...current.filter((r) => r.id !== id && r.id !== norm.id)];
        saveLocalRecords(refreshed);
      }
    } catch (e) {
      console.warn("[PaymentRecords] Supabase insert exception (cached locally):", e.message);
    }

    notifyDbMutated("payment_records", "POST");
    return recordPayload;
  },

  update: async (id, payload) => {
    const nowIso = new Date().toISOString();
    const updatePayload = {
      recipient_name: (payload.recipient_name || payload.recipientName || "").trim(),
      recipient_category: payload.recipient_category || payload.recipientCategory || "Boss / Director",
      amount: Number(payload.amount || payload.amountPaid || 0),
      date: payload.date,
      time: payload.time,
      description: (payload.description || payload.reason || "").trim(),
      payment_method: payload.payment_method || payload.paymentMethod || "Cash",
      reference_number: (payload.reference_number || payload.referenceNumber || "").trim(),
      updated_at: nowIso,
    };

    // Update local cache
    const current = getLocalRecords();
    const updatedList = current.map((r) => (r.id === id ? { ...r, ...updatePayload } : r));
    saveLocalRecords(updatedList);

    // Try Supabase update
    try {
      const { error } = await supabase
        .from("payment_records")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.warn("[PaymentRecords] Supabase update warning:", error.message);
      }
    } catch (e) {
      console.warn("[PaymentRecords] Supabase update exception:", e.message);
    }

    notifyDbMutated("payment_records", "PATCH");
    return { id, ...updatePayload };
  },

  delete: async (id) => {
    // Delete from local cache
    const current = getLocalRecords();
    const updatedList = current.filter((r) => r.id !== id);
    saveLocalRecords(updatedList);

    // Try Supabase delete
    try {
      const { error } = await supabase
        .from("payment_records")
        .delete()
        .eq("id", id);

      if (error) {
        console.warn("[PaymentRecords] Supabase delete warning:", error.message);
      }
    } catch (e) {
      console.warn("[PaymentRecords] Supabase delete exception:", e.message);
    }

    notifyDbMutated("payment_records", "DELETE");
  },

  subscribe: (callback) => {
    let mounted = true;

    const refresh = async () => {
      const data = await paymentRecordsService.fetchAll();
      if (mounted) callback(data);
    };

    refresh();

    const channelId = `payment_records-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_records" }, refresh);

    channel.subscribe();

    const handleLocalMutated = (e) => {
      if (!e.detail?.table || e.detail?.table === "payment_records") {
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
