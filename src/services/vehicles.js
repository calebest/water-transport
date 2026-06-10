import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
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
    const q = collection(db, "vehicles");
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.plate || "").localeCompare(b.plate || ""));
      callback(docs);
    }, (err) => {
      console.error("vehicles subscribe error:", err.code, err.message);
    });
  }
};
