import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { calcExpenses, calcProfit } from "../utils/helpers";

const calcFields = (data) => {
  const totalExpenses = calcExpenses(data.expenses);
  const profit = calcProfit(data.revenue, totalExpenses);
  const revenue = Number(data.revenue || 0);

  let status = data.status || "Pending";
  let amountPaid = 0;

  if (status === "Paid") {
    amountPaid = revenue;
  } else if (status === "Pending") {
    amountPaid = 0;
  } else if (status === "Partial") {
    amountPaid = data.amountPaid !== undefined && data.amountPaid !== "" ? Number(data.amountPaid) : 0;
    if (amountPaid >= revenue) status = "Paid";
    else if (amountPaid <= 0) status = "Pending";
  } else {
    // Fallback for old data logic
    amountPaid = data.amountPaid !== undefined && data.amountPaid !== "" ? Number(data.amountPaid) : revenue;
    status = amountPaid >= revenue ? "Paid" : (amountPaid > 0 ? "Partial" : "Pending");
  }

  return { totalExpenses, profit, revenue, amountPaid, status };
};

const applyEarningsSnapshot = (data, earningsRate) => {
  const next = { ...data };
  if (next.status === "Paid") {
    const rate = Number(earningsRate ?? next.earningsRate ?? next.earningsAmount ?? 0);
    next.earningsRate = rate;
    next.earningsAmount = rate;
    if (!next.paidAt) next.paidAt = serverTimestamp();
  }
  return next;
};

export const tripService = {
  /**
   * Add a new trip.
   * - Admin or DirectApproval: instantly approved.
   * - Driver/Conductor: saved as "pending" — requires admin approval.
   */
  add: async (data, { userId = null, isAdmin = false, directApproval = false, earningsRate = null } = {}) => {
    const { totalExpenses, profit, revenue, amountPaid, status } = calcFields(data);
    return addDoc(collection(db, "trips"), applyEarningsSnapshot({
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
      approvalStatus: (isAdmin || directApproval) ? "approved" : "pending",
      submittedBy: userId,
      pendingEdits: null,
      createdAt: serverTimestamp(),
    }, earningsRate));
  },

  /**
   * Update a trip.
   * - Admin or DirectApproval: applies directly and marks as approved.
   * - Driver/Conductor: saves changes as pendingEdits — requires admin approval.
   */
  update: async (id, data, { isAdmin = false, directApproval = false, isPending = false, earningsRate = null } = {}) => {
    if (isAdmin || directApproval) {
      const { totalExpenses, profit, revenue, amountPaid, status } = calcFields(data);
      return updateDoc(doc(db, "trips", id), applyEarningsSnapshot({
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
      }, earningsRate));
    } else if (isPending) {
      // Direct update for drivers/conductors editing their own pending (unapproved) trips
      const { totalExpenses, profit, revenue, amountPaid, status } = calcFields(data);
      return updateDoc(doc(db, "trips", id), applyEarningsSnapshot({
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
      }, earningsRate));
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
  approve: async (id, trip, { earningsRate = null } = {}) => {
    if (trip.pendingEdits) {
      // Apply the pending edits with fresh calculations.
      const data = trip.pendingEdits;
      const { totalExpenses, profit, revenue, amountPaid, status } = calcFields(data);
      return updateDoc(doc(db, "trips", id), applyEarningsSnapshot({
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
      }, earningsRate ?? trip.earningsRate ?? trip.earningsAmount));
    } else {
      // Approve a new trip submission.
      return updateDoc(doc(db, "trips", id), applyEarningsSnapshot({
        approvalStatus: "approved",
      }, earningsRate ?? trip.earningsRate ?? trip.earningsAmount));
    }
  },

  /**
   * Admin rejects a trip submission or discards a pending edit.
   * - New pending trip → removed entirely.
   * - Pending edit → discarded, original trip restored to approved.
   */
  reject: async (id, trip) => {
    if (trip.approvalStatus === "pending_edit") {
      return updateDoc(doc(db, "trips", id), {
        approvalStatus: "approved",
        pendingEdits: null,
      });
    } else {
      return deleteDoc(doc(db, "trips", id));
    }
  },

  delete: async (id) => deleteDoc(doc(db, "trips", id)),

  markPaid: async (id, amountPaid, status, earningsRate = null) => {
    const isPaid = status === "Paid";
    return updateDoc(doc(db, "trips", id), {
      amountPaid: Number(amountPaid),
      status,
      earningsRate: isPaid ? Number(earningsRate || 0) : null,
      earningsAmount: isPaid ? Number(earningsRate || 0) : 0,
      paidAt: isPaid ? serverTimestamp() : null,
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
  }
};
