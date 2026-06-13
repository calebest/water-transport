import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
};

export const complaintService = {
  add: async (data) => {
    return addDoc(collection(db, "complaints"), {
      ...data,
      status: data.status || "open",
      createdAt: serverTimestamp(),
    });
  },

  subscribe: (callback) => {
    return onSnapshot(collection(db, "complaints"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(docs);
    }, (err) => {
      console.error("complaints subscribe error:", err.code, err.message);
    });
  }
};
