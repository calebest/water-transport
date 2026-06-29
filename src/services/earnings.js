import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_CONFIG = {
  ratePerTrip: 200,
  dailyCommissionAmount: 200,
  commissionStatus: "Enabled",
  effectiveDate: "",
  notes: "",
};

export const earningsService = {
  subscribeConfig: (callback) => {
    return onSnapshot(doc(db, "settings", "earningsConfig"), (snap) => {
      callback(snap.exists() ? { ...DEFAULT_CONFIG, ...snap.data() } : { ...DEFAULT_CONFIG });
    }, (err) => {
      console.error("earnings config subscribe error:", err.code, err.message);
    });
  },

  updateConfig: async (updates) => {
    const ref = doc(db, "settings", "earningsConfig");
    const snap = await getDoc(ref);
    const nextAmount = Number(updates.dailyCommissionAmount ?? updates.ratePerTrip ?? DEFAULT_CONFIG.dailyCommissionAmount);

    const payload = {
      dailyCommissionAmount: nextAmount,
      ratePerTrip: nextAmount,
      commissionStatus: updates.commissionStatus || DEFAULT_CONFIG.commissionStatus,
      effectiveDate: updates.effectiveDate || "",
      notes: updates.notes || "",
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      return setDoc(ref, payload);
    }

    return updateDoc(ref, payload);
  },
};
