import { doc, getDoc, updateDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";

export const settingsService = {
  subscribe: (callback) => {
    return onSnapshot(doc(db, "settings", "general"), (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      } else {
        // Default settings
        callback({ directApproval: false });
      }
    }, (err) => {
      console.error("settings subscribe error:", err.code, err.message);
    });
  },

  update: async (updates) => {
    const ref = doc(db, "settings", "general");
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return setDoc(ref, { directApproval: false, ...updates });
    }
    return updateDoc(ref, updates);
  }
};
