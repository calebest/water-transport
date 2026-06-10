import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const maintenanceService = {
  add: async (data) => {
    return addDoc(collection(db, "maintenance"), {
      date: data.date,
      lorry: data.lorry,
      type: data.type,           // "Routine" | "Repair"
      description: data.description,
      cost: Number(data.cost || 0),
      vendor: data.vendor || "",
      odometer: data.odometer ? Number(data.odometer) : null,
      notes: data.notes || "",
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    return updateDoc(doc(db, "maintenance", id), {
      date: data.date,
      lorry: data.lorry,
      type: data.type,
      description: data.description,
      cost: Number(data.cost || 0),
      vendor: data.vendor || "",
      odometer: data.odometer ? Number(data.odometer) : null,
      notes: data.notes || ""
    });
  },
  delete: async (id) => deleteDoc(doc(db, "maintenance", id)),
  subscribe: (callback) => {
    return onSnapshot(collection(db, "maintenance"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      callback(docs);
    }, (err) => {
      console.error("maintenance subscribe error:", err.code, err.message);
    });
  }
};
