import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const locationService = {
  add: async (data) => {
    return addDoc(collection(db, "locations"), {
      name: data.name,
      revenue: Number(data.revenue),
      createdAt: serverTimestamp()
    });
  },
  update: async (id, data) => {
    return updateDoc(doc(db, "locations", id), {
      name: data.name,
      revenue: Number(data.revenue)
    });
  },
  delete: async (id) => deleteDoc(doc(db, "locations", id)),
  subscribe: (callback) => {
    const q = query(collection(db, "locations"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }
};
