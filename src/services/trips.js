import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { calcExpenses, calcProfit } from "../utils/helpers";

export const tripService = {
  add: async (data) => {
    const totalExpenses = calcExpenses(data.expenses);
    const profit = calcProfit(data.revenue, totalExpenses);
    
    const revenue = Number(data.revenue || 0);
    const amountPaid = data.amountPaid !== undefined ? Number(data.amountPaid) : revenue; // Default to fully paid if not specified
    const status = amountPaid >= revenue ? "Paid" : (amountPaid > 0 ? "Partial" : "Pending");

    return addDoc(collection(db, "trips"), {
      ...data,
      revenue,
      totalExpenses,
      profit,
      amountPaid,
      status,
      // Optional tracking fields (will be undefined if not provided)
      driverId: data.driverId || null,
      conductorId: data.conductorId || null,
      odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
      odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
      createdAt: serverTimestamp()
    });
  },
  
  update: async (id, data) => {
    const totalExpenses = calcExpenses(data.expenses);
    const profit = calcProfit(data.revenue, totalExpenses);
    
    const revenue = Number(data.revenue || 0);
    const amountPaid = data.amountPaid !== undefined ? Number(data.amountPaid) : revenue;
    const status = amountPaid >= revenue ? "Paid" : (amountPaid > 0 ? "Partial" : "Pending");

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
    });
  },
  
  delete: async (id) => deleteDoc(doc(db, "trips", id)),
  
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
