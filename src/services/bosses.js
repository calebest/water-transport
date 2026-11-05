import { supabase, notifyDbMutated } from "./supabase.js";
import { paymentRecordsService } from "./paymentRecords.js";

const STORAGE_KEY = "mk_bosses_cache";

const INITIAL_DEMO_BOSSES = [
  {
    id: "boss-1",
    name: "John",
    title: "Director",
    phone: "+254 712 345 678",
    notes: "Executive Director",
    created_at: "2026-06-01T08:00:00.000Z",
  },
  {
    id: "boss-2",
    name: "Peter",
    title: "Managing Director",
    phone: "+254 723 456 789",
    notes: "Operations & Fleet",
    created_at: "2026-06-01T08:00:00.000Z",
  },
  {
    id: "boss-3",
    name: "David",
    title: "Director / Shareholder",
    phone: "+254 734 567 890",
    notes: "Partner & Finance",
    created_at: "2026-06-01T08:00:00.000Z",
  },
];

const getLocalBosses = () => {
  if (typeof window === "undefined") return INITIAL_DEMO_BOSSES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_BOSSES));
      return INITIAL_DEMO_BOSSES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : INITIAL_DEMO_BOSSES;
  } catch (e) {
    console.warn("[BossesService] Error reading local cache:", e);
    return INITIAL_DEMO_BOSSES;
  }
};

const saveLocalBosses = (bosses) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bosses));
  } catch (e) {
    console.warn("[BossesService] Error saving local cache:", e);
  }
};

const normalizeBoss = (b) => ({
  id: b.id || `boss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: (b.name || "").trim(),
  title: b.title || "Director",
  phone: b.phone || "",
  notes: b.notes || "",
  created_at: b.created_at || new Date().toISOString(),
  updated_at: b.updated_at || new Date().toISOString(),
});

export const bossesService = {
  fetchAll: async () => {
    try {
      const { data, error } = await supabase
        .from("bosses")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.warn("[BossesService] Supabase notice (using local cache):", error.message);
        return getLocalBosses().map(normalizeBoss);
      }

      const normalized = (data || []).map(normalizeBoss);
      if (normalized.length > 0) {
        saveLocalBosses(normalized);
        return normalized;
      }
      return getLocalBosses().map(normalizeBoss);
    } catch (e) {
      console.warn("[BossesService] Network error, using local cache:", e.message);
      return getLocalBosses().map(normalizeBoss);
    }
  },

  create: async (payload) => {
    const id = `boss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    const bossPayload = {
      id,
      name: (payload.name || "").trim(),
      title: payload.title || "Director",
      phone: (payload.phone || "").trim(),
      notes: (payload.notes || "").trim(),
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Update local cache
    const current = getLocalBosses();
    const updated = [...current.filter((b) => b.name.toLowerCase() !== bossPayload.name.toLowerCase()), bossPayload];
    saveLocalBosses(updated);

    // Supabase insert
    try {
      const { data, error } = await supabase
        .from("bosses")
        .insert([bossPayload])
        .select()
        .single();

      if (error) {
        console.warn("[BossesService] Supabase insert warning:", error.message);
      } else if (data) {
        const norm = normalizeBoss(data);
        saveLocalBosses([...current.filter((b) => b.id !== id && b.id !== norm.id), norm]);
      }
    } catch (e) {
      console.warn("[BossesService] Supabase insert exception:", e.message);
    }

    notifyDbMutated("bosses", "POST");
    return bossPayload;
  },

  update: async (id, payload, oldName = null) => {
    const nowIso = new Date().toISOString();
    const newName = (payload.name || "").trim();

    const updatePayload = {
      name: newName,
      title: payload.title || "Director",
      phone: (payload.phone || "").trim(),
      notes: (payload.notes || "").trim(),
      updated_at: nowIso,
    };

    // Update local cache
    const current = getLocalBosses();
    const updated = current.map((b) => (b.id === id ? { ...b, ...updatePayload } : b));
    saveLocalBosses(updated);

    // Supabase update
    try {
      const { error } = await supabase
        .from("bosses")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.warn("[BossesService] Supabase update warning:", error.message);
      }
    } catch (e) {
      console.warn("[BossesService] Supabase update exception:", e.message);
    }

    // IF the name changed, automatically update all historical payment records for this boss!
    if (oldName && newName && oldName.toLowerCase() !== newName.toLowerCase()) {
      try {
        const allPayments = await paymentRecordsService.fetchAll();
        const paymentsToUpdate = allPayments.filter(
          (p) => (p.recipient_name || "").toLowerCase() === oldName.toLowerCase()
        );

        for (const p of paymentsToUpdate) {
          await paymentRecordsService.update(p.id, {
            ...p,
            recipient_name: newName,
          });
        }
      } catch (cascadeErr) {
        console.warn("[BossesService] Cascade name update warning:", cascadeErr.message);
      }
    }

    notifyDbMutated("bosses", "PATCH");
    return { id, ...updatePayload };
  },

  delete: async (id) => {
    // Update local cache
    const current = getLocalBosses();
    const updated = current.filter((b) => b.id !== id);
    saveLocalBosses(updated);

    // Supabase delete
    try {
      const { error } = await supabase
        .from("bosses")
        .delete()
        .eq("id", id);

      if (error) {
        console.warn("[BossesService] Supabase delete warning:", error.message);
      }
    } catch (e) {
      console.warn("[BossesService] Supabase delete exception:", e.message);
    }

    notifyDbMutated("bosses", "DELETE");
  },

  subscribe: (callback) => {
    let mounted = true;

    const refresh = async () => {
      const data = await bossesService.fetchAll();
      if (mounted) callback(data);
    };

    refresh();

    const channelId = `bosses-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "bosses" }, refresh);

    channel.subscribe();

    const handleLocalMutated = (e) => {
      if (!e.detail?.table || e.detail?.table === "bosses") {
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

