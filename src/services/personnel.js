import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const personnelService = {
  add: async (data) => {
    return addDoc(collection(db, "personnel"), {
      name: data.name,
      role: data.role,        // "Driver" | "Conductor" | "Both"
      phone: data.phone || "",
      idNumber: data.idNumber || "",
      status: data.status || "Active",
      notes: data.notes || "",
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    return updateDoc(doc(db, "personnel", id), {
      name: data.name,
      role: data.role,
      phone: data.phone || "",
      idNumber: data.idNumber || "",
      status: data.status || "Active",
      notes: data.notes || ""
    });
  },
  delete: async (id) => deleteDoc(doc(db, "personnel", id)),
  subscribe: (callback) => {
    return onSnapshot(collection(db, "personnel"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      callback(docs);
    }, (err) => {
      console.error("personnel subscribe error:", err.code, err.message);
    });
  }
};
