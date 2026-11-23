import { supabase, notifyDbMutated } from "./supabase.js";

const STORAGE_KEY = "mk_daily_mileage_cache";

const getLocalRecords = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("[DailyMileage] Error reading local cache:", e);
    return [];
  }
};

const saveLocalRecords = (records) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn("[DailyMileage] Error saving local cache:", e);
  }
};

const normalizeRecord = (item) => ({
  id: item.id || `mil-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  vehicle_id: item.vehicle_id || item.vehicleId || "",
  vehicle_plate: item.vehicle_plate || item.vehiclePlate || item.plate || "Unknown",
  mileage_date: item.mileage_date || item.mileageDate || item.date || new Date().toISOString().slice(0, 10),
  kilometers_covered: Number(item.kilometers_covered || item.kilometersCovered || item.kilometers || 0),
  notes: item.notes || "",
  created_by: item.created_by || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
});

export const dailyMileageService = {
  fetchAll: async () => {
    try {
      const { data, error } = await supabase
        .from("daily_mileage")
        .select("*")
        .order("mileage_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[DailyMileage] Supabase fetch notice (falling back to cache):", error.message);
        return getLocalRecords().map(normalizeRecord);
      }

      const normalized = (data || []).map(normalizeRecord);
      saveLocalRecords(normalized);
      return normalized;
    } catch (e) {
      console.warn("[DailyMileage] Network or fetch error, using local cache:", e.message);
      return getLocalRecords().map(normalizeRecord);
    }
  },

  create: async (payload, userId = null) => {
    const id = `mil-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const dateStr = payload.mileage_date || payload.date || nowIso.slice(0, 10);

    const recordPayload = {
      id,
      vehicle_id: payload.vehicle_id || payload.vehicleId || "",
      vehicle_plate: (payload.vehicle_plate || payload.vehiclePlate || payload.plate || "").trim(),
      mileage_date: dateStr,
      kilometers_covered: Math.max(0, Number(payload.kilometers_covered || payload.kilometersCovered || 0)),
      notes: (payload.notes || "").trim(),
      created_by: userId || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Update local cache first
    const current = getLocalRecords();
    // Check if duplicate in local cache
    const existingIdx = current.findIndex(
      (r) =>
        (r.vehicle_id === recordPayload.vehicle_id || r.vehicle_plate === recordPayload.vehicle_plate) &&
        r.mileage_date === recordPayload.mileage_date
    );

    let updatedList;
    if (existingIdx >= 0) {
      throw new Error(`A mileage entry for ${recordPayload.vehicle_plate} on ${dateStr} already exists (${current[existingIdx].kilometers_covered} KM). Please edit that record instead.`);
    } else {
      updatedList = [recordPayload, ...current];
    }
    saveLocalRecords(updatedList);

    // Try Supabase insert
    try {
      const { data, error } = await supabase
        .from("daily_mileage")
        .insert([recordPayload])
        .select()
        .single();

      if (error) {
        // If unique constraint violation in Supabase
        if (error.code === "23505" || error.message?.includes("unique")) {
          // Rollback local cache
          saveLocalRecords(current);
          throw new Error(`A mileage entry for this vehicle on ${dateStr} already exists in the database.`);
        }
        console.warn("[DailyMileage] Supabase insert warning (cached locally):", error.message);
      } else if (data) {
        const norm = normalizeRecord(data);
        const refreshed = [norm, ...current.filter((r) => r.id !== id && r.id !== norm.id)];
        saveLocalRecords(refreshed);
      }
    } catch (e) {
      if (e.message?.includes("already exists")) throw e;
      console.warn("[DailyMileage] Supabase insert exception (cached locally):", e.message);
    }

    notifyDbMutated("daily_mileage", "POST");
    return recordPayload;
  },

  update: async (id, payload) => {
    const nowIso = new Date().toISOString();
    const updatePayload = {
      vehicle_id: payload.vehicle_id || payload.vehicleId,
      vehicle_plate: (payload.vehicle_plate || payload.vehiclePlate || payload.plate || "").trim(),
      mileage_date: payload.mileage_date || payload.date,
      kilometers_covered: Math.max(0, Number(payload.kilometers_covered || payload.kilometersCovered || 0)),
      notes: (payload.notes || "").trim(),
      updated_at: nowIso,
    };

    // Update local cache
    const current = getLocalRecords();
    const updatedList = current.map((r) => (r.id === id ? { ...r, ...updatePayload } : r));
    saveLocalRecords(updatedList);

    // Try Supabase update
    try {
      const { error } = await supabase
        .from("daily_mileage")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        if (error.code === "23505" || error.message?.includes("unique")) {
          saveLocalRecords(current);
          throw new Error("Another entry for this vehicle on this date already exists.");
        }
        console.warn("[DailyMileage] Supabase update warning:", error.message);
      }
    } catch (e) {
      if (e.message?.includes("already exists")) throw e;
      console.warn("[DailyMileage] Supabase update exception:", e.message);
    }

    notifyDbMutated("daily_mileage", "PATCH");
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
        .from("daily_mileage")
        .delete()
        .eq("id", id);

      if (error) {
        console.warn("[DailyMileage] Supabase delete warning:", error.message);
      }
    } catch (e) {
      console.warn("[DailyMileage] Supabase delete exception:", e.message);
    }

    notifyDbMutated("daily_mileage", "DELETE");
  },

  checkExists: (records = [], vehicleIdOrPlate, dateStr, excludeId = null) => {
    return records.find(
      (r) =>
        r.id !== excludeId &&
        r.mileage_date === dateStr &&
        (r.vehicle_id === vehicleIdOrPlate || r.vehicle_plate?.toLowerCase() === vehicleIdOrPlate?.toLowerCase())
    );
  },

  subscribe: (callback) => {
    let mounted = true;

    const refresh = async () => {
      const data = await dailyMileageService.fetchAll();
      if (mounted) callback(data);
    };

    refresh();

    const channelId = `daily_mileage-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_mileage" }, refresh);

    channel.subscribe();

    const handleLocalMutated = (e) => {
      if (!e.detail?.table || e.detail?.table === "daily_mileage") {
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
