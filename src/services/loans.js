import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
};

const toNumber = (value) => Number(value || 0);

const statusFromLoan = (amount, amountRepaid) => {
  const balance = Math.max(amount - amountRepaid, 0);
  const status = balance <= 0 ? "Cleared" : amountRepaid > 0 ? "Partially Paid" : "Outstanding";
  return { balance, status };
};

const normaliseLoan = (data, existing = {}) => {
  const amount = toNumber(data.amount ?? existing.amount);
  const amountRepaid = toNumber(data.amountRepaid ?? existing.amountRepaid);
  const { balance, status } = statusFromLoan(amount, amountRepaid);

  return {
    lenderName: (data.lenderName ?? existing.lenderName ?? "").trim(),
    purpose: (data.purpose ?? existing.purpose ?? "").trim(),
    category: data.category ?? existing.category ?? "Other",
    amount,
    amountRepaid,
    balance,
    status,
    dateBorrowed: data.dateBorrowed ?? existing.dateBorrowed ?? "",
    dueDate: data.dueDate ?? existing.dueDate ?? "",
    notes: (data.notes ?? existing.notes ?? "").trim(),
  };
};

export const loanService = {
  add: async (data) => {
    const loan = normaliseLoan({ ...data, amountRepaid: 0 }, {});
    return addDoc(collection(db, "loans"), {
      ...loan,
      amountRepaid: 0,
      balance: loan.amount,
      status: "Outstanding",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  update: async (id, data) => {
    const ref = doc(db, "loans", id);
    const snap = await runTransaction(db, async (tx) => {
      const existingSnap = await tx.get(ref);
      if (!existingSnap.exists()) {
        throw new Error("Loan not found");
      }
      const existing = existingSnap.data();
      const loan = normaliseLoan(data, existing);
      tx.update(ref, {
        ...loan,
        updatedAt: serverTimestamp(),
      });
    });
    return snap;
  },

  delete: async (id) => deleteDoc(doc(db, "loans", id)),

  addRepayment: async (loanId, repaymentData) => {
    const loanRef = doc(db, "loans", loanId);
    const repaymentRef = doc(collection(db, "loans", loanId, "repayments"));
    const amount = toNumber(repaymentData.amount);

    if (amount <= 0) {
      throw new Error("Repayment amount must be greater than zero.");
    }

    await runTransaction(db, async (tx) => {
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists()) {
        throw new Error("Loan not found");
      }

      const loan = loanSnap.data();
      const currentBalance = Math.max(toNumber(loan.amount) - toNumber(loan.amountRepaid), 0);
      if (amount > currentBalance) {
        throw new Error("Repayment cannot exceed the outstanding balance.");
      }

      const amountRepaid = toNumber(loan.amountRepaid) + amount;
      const { balance, status } = statusFromLoan(toNumber(loan.amount), amountRepaid);

      tx.set(repaymentRef, {
        amount,
        date: repaymentData.date || "",
        method: repaymentData.method || "Cash",
        notes: (repaymentData.notes || "").trim(),
        recordedAt: serverTimestamp(),
      });

      tx.update(loanRef, {
        amountRepaid,
        balance,
        status,
        updatedAt: serverTimestamp(),
      });
    });
  },

  subscribe: (callback) => {
    return onSnapshot(collection(db, "loans"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const dateDiff = (b.dateBorrowed || "").localeCompare(a.dateBorrowed || "");
        if (dateDiff !== 0) return dateDiff;
        return toMillis(b.updatedAt) - toMillis(a.updatedAt);
      });
      callback(docs);
    }, (err) => {
      console.error("loans subscribe error:", err.code, err.message);
    });
  },

  subscribeRepayments: (loanId, callback) => {
    return onSnapshot(collection(db, "loans", loanId, "repayments"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => toMillis(b.recordedAt) - toMillis(a.recordedAt));
      callback(docs);
    }, (err) => {
      console.error("loan repayments subscribe error:", err.code, err.message);
    });
  },
};
