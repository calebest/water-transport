import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { calcExpenses, calcProfit } from "../utils/helpers";

export const tripService = {
  add: async (data) => {
    const totalExpenses = calcExpenses(data.expenses);
    const profit = calcProfit(data.revenue, totalExpenses);
    return addDoc(collection(db, "trips"), {
      ...data,
      revenue: Number(data.revenue),
      totalExpenses,
      profit,
      status: data.status || "Pending",
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    const totalExpenses = calcExpenses(data.expenses);
    const profit = calcProfit(data.revenue, totalExpenses);
    return updateDoc(doc(db, "trips", id), {
      ...data,
      revenue: Number(data.revenue),
      totalExpenses,
      profit
    });
  },
  delete: async (id) => deleteDoc(doc(db, "trips", id)),
  subscribe: (callback) => {
    const q = query(collection(db, "trips"), orderBy("date", "desc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }
};
