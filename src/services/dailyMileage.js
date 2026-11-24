import { supabase, notifyDbMutated } from "./supabase.js";

const STORAGE_KEY = "mk_daily_mileage_cache";
const SYNC_STATUS_EVENT = "mileage_sync_status";

// In-memory cache for table existence to prevent spamming check queries
let _cachedTableStatus = null;
let _isSyncing = false;

const isValidUUID = (str) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || "");

export const getLocalRecords = () => {
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

export const saveLocalRecords = (records) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn("[DailyMileage] Error saving local cache:", e);
  }
};

const normalizeRecord = (item) => ({
  id: item.id || `mil-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  vehicle_id: (item.vehicle_id || item.vehicleId || "").trim() || null,
  vehicle_plate: (item.vehicle_plate || item.vehiclePlate || item.plate || "Unknown").trim(),
  mileage_date: item.mileage_date || item.mileageDate || item.date || new Date().toISOString().slice(0, 10),
  kilometers_covered: Number(item.kilometers_covered || item.kilometersCovered || item.kilometers || 0),
  notes: item.notes || "",
  created_by: isValidUUID(item.created_by) ? item.created_by : null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
  _pendingSync: Boolean(item._pendingSync),
});

const broadcastSyncStatus = (status) => {
  _cachedTableStatus = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: status }));
  }
};

export const dailyMileageService = {
  /**
   * Check if the daily_mileage table is provisioned in the connected Supabase database
   */
  checkTableStatus: async (forceRefresh = false) => {
    if (!forceRefresh && _cachedTableStatus !== null) {
      return _cachedTableStatus;
    }

    try {
      const { error } = await supabase.from("daily_mileage").select("id").limit(1);

      if (error) {
        const isMissing =
          error.code === "PGRST205" ||
          error.code === "42P01" ||
          error.message?.toLowerCase().includes("does not exist") ||
          error.message?.toLowerCase().includes("not find the table");

        const status = {
          tableExists: !isMissing,
          isOnline: true,
          error: error.message,
          errorCode: error.code,
        };
        broadcastSyncStatus(status);
        return status;
      }

      const status = { tableExists: true, isOnline: true, error: null };
      broadcastSyncStatus(status);
      return status;
    } catch (e) {
      const status = { tableExists: false, isOnline: false, error: e.message };
      broadcastSyncStatus(status);
      return status;
    }
  },

  /**
   * Automatically upload / sync any locally cached records to Supabase when table is ready
   */
  syncLocalToRemote: async () => {
    if (_isSyncing) return { success: false, reason: "Already syncing" };
    _isSyncing = true;

    try {
      const tableStatus = await dailyMileageService.checkTableStatus(true);
      if (!tableStatus.tableExists) {
        return { success: false, reason: "Database table not provisioned yet" };
      }

      const local = getLocalRecords();
      if (!local.length) {
        return { success: true, count: 0 };
      }

      // Fetch existing remote records
      const { data: remoteData, error: fetchErr } = await supabase
        .from("daily_mileage")
        .select("id, vehicle_plate, mileage_date");

      if (fetchErr) {
        return { success: false, reason: fetchErr.message };
      }

      const remoteKeys = new Set(
        (remoteData || []).map((r) => `${r.vehicle_plate?.toUpperCase()}__${r.mileage_date}`)
      );

      // Find local entries not yet in Supabase
      const unsynced = local.filter(
        (l) => !remoteKeys.has(`${l.vehicle_plate?.toUpperCase()}__${l.mileage_date}`)
      );

      if (unsynced.length === 0) {
        return { success: true, count: 0 };
      }

      console.log(`[DailyMileage] Uploading ${unsynced.length} unsynced local records to Supabase...`);

      const payloads = unsynced.map((item) => ({
        // If it's a temporary local id, generate a uuid or omit so Postgres creates it
        id: item.id && !item.id.startsWith("mil-") ? item.id : undefined,
        vehicle_id: (item.vehicle_id || "").trim() || null,
        vehicle_plate: (item.vehicle_plate || "").trim(),
        mileage_date: item.mileage_date,
        kilometers_covered: Math.max(0, Number(item.kilometers_covered || 0)),
        notes: (item.notes || "").trim(),
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from("daily_mileage")
        .upsert(payloads, { onConflict: "vehicle_plate,mileage_date" })
        .select();

      if (insertErr) {
        console.warn("[DailyMileage] syncLocalToRemote insert notice:", insertErr.message);
        return { success: false, reason: insertErr.message };
      }

      console.log(`[DailyMileage] Synced ${inserted?.length || unsynced.length} records to Supabase successfully.`);

      // Refresh cache from server
      const { data: freshRemote } = await supabase
        .from("daily_mileage")
        .select("*")
        .order("mileage_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (freshRemote) {
        saveLocalRecords(freshRemote.map(normalizeRecord));
      }

      notifyDbMutated("daily_mileage", "SYNC");
      return { success: true, count: inserted?.length || unsynced.length };
    } catch (e) {
      console.warn("[DailyMileage] syncLocalToRemote exception:", e.message);
      return { success: false, reason: e.message };
    } finally {
      _isSyncing = false;
    }
  },

  /**
   * Fetch all records: fetches from Supabase when available, with automatic local upload
   */
  fetchAll: async () => {
    try {
      const { data, error } = await supabase
        .from("daily_mileage")
        .select("*")
        .order("mileage_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        const isMissingTable =
          error.code === "PGRST205" ||
          error.code === "42P01" ||
          error.message?.toLowerCase().includes("does not exist") ||
          error.message?.toLowerCase().includes("not find the table");

        broadcastSyncStatus({
          tableExists: !isMissingTable,
          isOnline: true,
          error: error.message,
          errorCode: error.code,
        });

        // Return local cache as fallback so the app continues operating
        return getLocalRecords().map(normalizeRecord);
      }

      broadcastSyncStatus({ tableExists: true, isOnline: true, error: null });

      const normalizedRemote = (data || []).map(normalizeRecord);

      // Check if local cache has any unsynced records to preserve
      const local = getLocalRecords();
      const remoteKeys = new Set(
        normalizedRemote.map((r) => `${r.vehicle_plate?.toUpperCase()}__${r.mileage_date}`)
      );
      const unsynced = local.filter(
        (l) => !remoteKeys.has(`${l.vehicle_plate?.toUpperCase()}__${l.mileage_date}`)
      );

      if (unsynced.length > 0) {
        // Trigger background sync to upload these local records to Supabase
        queueMicrotask(() => dailyMileageService.syncLocalToRemote());
        // Merge so user sees everything immediately
        const merged = [...unsynced.map((u) => ({ ...u, _pendingSync: true })), ...normalizedRemote];
        saveLocalRecords(merged);
        return merged;
      }

      saveLocalRecords(normalizedRemote);
      return normalizedRemote;
    } catch (e) {
      console.warn("[DailyMileage] Network exception, using local cache:", e.message);
      broadcastSyncStatus({ tableExists: false, isOnline: false, error: e.message });
      return getLocalRecords().map(normalizeRecord);
    }
  },

  /**
   * Create a new daily mileage record
   */
  create: async (payload, userId = null) => {
    const id = `mil-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const dateStr = payload.mileage_date || payload.date || nowIso.slice(0, 10);
    const safeVehicleId = (payload.vehicle_id || payload.vehicleId || "").trim() || null;
    const safePlate = (payload.vehicle_plate || payload.vehiclePlate || payload.plate || "").trim();
    const safeUserId = isValidUUID(userId) ? userId : null;

    const recordPayload = {
      id,
      vehicle_id: safeVehicleId,
      vehicle_plate: safePlate,
      mileage_date: dateStr,
      kilometers_covered: Math.max(0, Number(payload.kilometers_covered || payload.kilometersCovered || 0)),
      notes: (payload.notes || "").trim(),
      created_by: safeUserId,
      created_at: nowIso,
      updated_at: nowIso,
      _pendingSync: true,
    };

    // Check local duplicate first
    const current = getLocalRecords();
    const existingIdx = current.findIndex(
      (r) =>
        r.vehicle_plate?.toLowerCase() === safePlate.toLowerCase() &&
        r.mileage_date === dateStr
    );

    if (existingIdx >= 0) {
      throw new Error(
        `A mileage entry for ${safePlate} on ${dateStr} already exists (${current[existingIdx].kilometers_covered} KM). Please edit that record instead.`
      );
    }

    // Save to local cache immediately so UI is optimistic and responsive
    saveLocalRecords([recordPayload, ...current]);

    // Try Supabase insert
    try {
      const dbInsertPayload = {
        vehicle_id: safeVehicleId,
        vehicle_plate: safePlate,
        mileage_date: dateStr,
        kilometers_covered: recordPayload.kilometers_covered,
        notes: recordPayload.notes,
        created_by: safeUserId,
      };

      const { data, error } = await supabase
        .from("daily_mileage")
        .insert([dbInsertPayload])
        .select()
        .single();

      if (error) {
        if (error.code === "23505" || error.message?.includes("unique")) {
          // Rollback local cache
          saveLocalRecords(current);
          throw new Error(
            `A mileage entry for ${safePlate} on ${dateStr} already exists in the database.`
          );
        }

        console.warn("[DailyMileage] Supabase insert warning (cached locally):", error.message);
        broadcastSyncStatus({
          tableExists: error.code !== "PGRST205",
          isOnline: true,
          error: error.message,
        });
      } else if (data) {
        const norm = { ...normalizeRecord(data), _pendingSync: false };
        const refreshed = [norm, ...current.filter((r) => r.id !== id && r.id !== norm.id)];
        saveLocalRecords(refreshed);
        broadcastSyncStatus({ tableExists: true, isOnline: true, error: null });
        recordPayload.id = norm.id;
        recordPayload._pendingSync = false;
      }
    } catch (e) {
      if (e.message?.includes("already exists")) throw e;
      console.warn("[DailyMileage] Supabase insert exception (cached locally):", e.message);
    }

    notifyDbMutated("daily_mileage", "POST");
    return recordPayload;
  },

  /**
   * Update an existing daily mileage record
   */
  update: async (id, payload) => {
    const nowIso = new Date().toISOString();
    const safeVehicleId = (payload.vehicle_id || payload.vehicleId || "").trim() || null;
    const safePlate = (payload.vehicle_plate || payload.vehiclePlate || payload.plate || "").trim();

    const updatePayload = {
      vehicle_id: safeVehicleId,
      vehicle_plate: safePlate,
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
      } else {
        broadcastSyncStatus({ tableExists: true, isOnline: true, error: null });
      }
    } catch (e) {
      if (e.message?.includes("already exists")) throw e;
      console.warn("[DailyMileage] Supabase update exception:", e.message);
    }

    notifyDbMutated("daily_mileage", "PATCH");
    return { id, ...updatePayload };
  },

  /**
   * Delete a mileage record
   */
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
      } else {
        broadcastSyncStatus({ tableExists: true, isOnline: true, error: null });
      }
    } catch (e) {
      console.warn("[DailyMileage] Supabase delete exception:", e.message);
    }

    notifyDbMutated("daily_mileage", "DELETE");
  },

  checkExists: (records = [], vehiclePlateOrId, dateStr, excludeId = null) => {
    const searchTarget = (vehiclePlateOrId || "").toLowerCase().trim();
    return records.find(
      (r) =>
        r.id !== excludeId &&
        r.mileage_date === dateStr &&
        ((r.vehicle_plate || "").toLowerCase().trim() === searchTarget ||
          (r.vehicle_id || "").toLowerCase().trim() === searchTarget)
    );
  },

  /**
   * Subscribe to real-time database changes and local mutation events
   */
  subscribe: (callback) => {
    let mounted = true;

    const refresh = async () => {
      const data = await dailyMileageService.fetchAll();
      if (mounted) callback(data);
    };

    refresh();

    // Check table status on initial subscribe
    dailyMileageService.checkTableStatus();

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
