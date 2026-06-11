import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export const targetsService = {
  subscribe: (callback) => {
    return onSnapshot(collection(db, "targets"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    }, (err) => {
      console.error("targets subscribe error:", err.code, err.message);
    });
  },
  
  add: async (data) => {
    return addDoc(collection(db, "targets"), data);
  },

  update: async (id, data) => {
    return updateDoc(doc(db, "targets", id), data);
  },

  delete: async (id) => {
    return deleteDoc(doc(db, "targets", id));
  }
};
