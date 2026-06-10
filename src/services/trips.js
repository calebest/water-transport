import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { calcExpenses, calcProfit } from "../utils/helpers";

const calcFields = (data) => {
  const totalExpenses = calcExpenses(data.expenses);
  const profit = calcProfit(data.revenue, totalExpenses);
  const revenue = Number(data.revenue || 0);
  const amountPaid = data.amountPaid !== undefined ? Number(data.amountPaid) : revenue;
  const status = amountPaid >= revenue ? "Paid" : (amountPaid > 0 ? "Partial" : "Pending");
  return { totalExpenses, profit, revenue, amountPaid, status };
};

export const tripService = {
  /**
   * Add a new trip.
   * - Admin: instantly approved.
   * - Driver/Conductor: saved as "pending" — requires admin approval.
   */
  add: async (data, { userId = null, isAdmin = false } = {}) => {
    const { totalExpenses, profit, revenue, amountPaid, status } = calcFields(data);
    return addDoc(collection(db, "trips"), {
      ...data,
      revenue,
      totalExpenses,
      profit,
      amountPaid,
      status,
      driverId: data.driverId || null,
      conductorId: data.conductorId || null,
      odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
      odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
      approvalStatus: isAdmin ? "approved" : "pending",
      submittedBy: userId,
      pendingEdits: null,
      createdAt: serverTimestamp(),
    });
  },

  /**
   * Update a trip.
   * - Admin: applies directly and marks as approved.
   * - Driver/Conductor: saves changes as pendingEdits — requires admin approval.
   */
  update: async (id, data, { isAdmin = false } = {}) => {
    if (isAdmin) {
      const { totalExpenses, profit, revenue, amountPaid, status } = calcFields(data);
      return updateDoc(doc(db, "trips", id), {
        ...data,
        revenue,
        totalExpenses,
        profit,
        amountPaid,
        status,
        driverId: data.driverId || null,
        conductorId: data.conductorId || null,
        odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
        odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
        approvalStatus: "approved",
        pendingEdits: null,
      });
    } else {
      // Store full form data as a pending edit; original is preserved.
      return updateDoc(doc(db, "trips", id), {
        pendingEdits: data,
        approvalStatus: "pending_edit",
      });
    }
  },

  /**
   * Admin approves a trip or a pending edit.
   */
  approve: async (id, trip) => {
    if (trip.pendingEdits) {
      // Apply the pending edits with fresh calculations.
      const data = trip.pendingEdits;
      const { totalExpenses, profit, revenue, amountPaid, status } = calcFields(data);
      return updateDoc(doc(db, "trips", id), {
        ...data,
        revenue,
        totalExpenses,
        profit,
        amountPaid,
        status,
        driverId: data.driverId || null,
        conductorId: data.conductorId || null,
        odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
        odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
        approvalStatus: "approved",
        pendingEdits: null,
      });
    } else {
      // Approve a new trip submission.
      return updateDoc(doc(db, "trips", id), { approvalStatus: "approved" });
    }
  },

  /**
   * Admin rejects a trip submission or discards a pending edit.
   * - New pending trip → marked as "rejected" (stays visible to driver).
   * - Pending edit → discarded, original trip restored to approved.
   */
  reject: async (id, trip) => {
    if (trip.approvalStatus === "pending_edit") {
      return updateDoc(doc(db, "trips", id), {
        approvalStatus: "approved",
        pendingEdits: null,
      });
    } else {
      return updateDoc(doc(db, "trips", id), { approvalStatus: "rejected" });
    }
  },

  delete: async (id) => deleteDoc(doc(db, "trips", id)),

  markPaid: async (id, amountPaid, status) => {
    return updateDoc(doc(db, "trips", id), {
      amountPaid: Number(amountPaid),
      status,
    });
  },

  subscribe: (callback) => {
    return onSnapshot(collection(db, "trips"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      callback(docs);
    }, (err) => {
      console.error("trips subscribe error:", err.code, err.message);
    });
  },

  /**
   * Scans all existing trips and returns the next sequential trip number
   * formatted as a zero-padded 3-digit string (e.g. "001", "042", "123").
   */
  getNextTripNumber: async () => {
    const snap = await getDocs(collection(db, "trips"));
    let max = 0;
    snap.forEach(d => {
      const raw = d.data().tripNumber || "";
      const num = parseInt(raw.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num > max) max = num;
    });
    return String(max + 1).padStart(3, "0");
  },
};
