import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const vehicleService = {
  add: async (data) => {
    return addDoc(collection(db, "vehicles"), {
      plate: data.plate,
      name: data.name,
      status: data.status || "Active",
      notes: data.notes || "",
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    return updateDoc(doc(db, "vehicles", id), {
      plate: data.plate,
      name: data.name,
      status: data.status || "Active",
      notes: data.notes || ""
    });
  },
  delete: async (id) => deleteDoc(doc(db, "vehicles", id)),
  subscribe: (callback) => {
    const q = query(collection(db, "vehicles"), orderBy("plate", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }
};
