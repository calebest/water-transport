import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const locationService = {
  add: async (data) => {
    return addDoc(collection(db, "locations"), {
      name: data.name,
      revenue: Number(data.revenue),
      status: data.status || "Active",
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    return updateDoc(doc(db, "locations", id), {
      name: data.name,
      revenue: Number(data.revenue),
      status: data.status || "Active"
    });
  },
  delete: async (id) => deleteDoc(doc(db, "locations", id)),
  subscribe: (callback) => {
    return onSnapshot(collection(db, "locations"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      callback(docs);
    }, (err) => {
      console.error("locations subscribe error:", err.code, err.message);
    });
  }
};
