import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_CONFIG = {
  ratePerTrip: 200,
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
    const currentRate = snap.exists() ? Number(snap.data()?.ratePerTrip || DEFAULT_CONFIG.ratePerTrip) : DEFAULT_CONFIG.ratePerTrip;
    const nextRate = Number(updates.ratePerTrip || DEFAULT_CONFIG.ratePerTrip);

    const tripsSnap = await getDocs(query(collection(db, "trips"), where("status", "==", "Paid")));
    const batch = writeBatch(db);
    let pendingWrites = 0;

    tripsSnap.forEach((tripDoc) => {
      const trip = tripDoc.data();
      if (trip.earningsAmount !== undefined && trip.earningsAmount !== null && trip.earningsAmount !== "") return;
      if (trip.earningsRate !== undefined && trip.earningsRate !== null && trip.earningsRate !== "") return;
      batch.update(tripDoc.ref, {
        earningsRate: currentRate,
        earningsAmount: currentRate,
      });
      pendingWrites += 1;
    });

    if (pendingWrites > 0) {
      await batch.commit();
    }

    const payload = {
      ratePerTrip: nextRate,
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      return setDoc(ref, payload);
    }

    return updateDoc(ref, payload);
  },
};
