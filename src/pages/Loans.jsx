import { useEffect, useMemo, useState } from "react";
import { loanService } from "../services/loans";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Modal, StatCard } from "../components/ui";
import { fmt, today } from "../utils/helpers";

const LOAN_CATEGORIES = ["Diesel", "Water", "Petrol", "Salary", "Repair", "Other"];
const REPAYMENT_METHODS = ["Cash", "M-Pesa", "Bank Transfer"];

const toNumber = (value) => Number(value || 0);

const loanStatusColor = (status) => {
  if (status === "Cleared") return "green";
  if (status === "Partially Paid") return "amber";
  return "red";
};

const lenderStatusColor = (status) => {
  if (status === "cleared") return "green";
  if (status === "partial") return "amber";
  return "red";
};

const lenderAggregate = (items) => {
  const balance = items.reduce((sum, loan) => sum + toNumber(loan.balance), 0);
  const hasOutstanding = items.some((loan) => loan.status === "Outstanding");
  const hasPartial = items.some((loan) => loan.status === "Partially Paid");
  return {
    balance,
    status: hasOutstanding ? "outstanding" : hasPartial ? "partial" : "cleared",
  };
};

function LoanForm({ initial, lenderNames = [], onSave, onCancel }) {
  const [lenderName, setLenderName] = useState(initial?.lenderName || "");
  const [category, setCategory] = useState(initial?.category || "Other");
  const [purpose, setPurpose] = useState(initial?.purpose || "");
  const [amount, setAmount] = useState(initial?.amount || "");
  const [dateBorrowed, setDateBorrowed] = useState(initial?.dateBorrowed || today());
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!lenderName.trim() || !purpose.trim() || amount === "") {
      alert("Lender name, purpose, and amount are required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        lenderName: lenderName.trim(),
        category,
        purpose: purpose.trim(),
        amount: Number(amount),
        dateBorrowed,
        dueDate: dueDate || "",
        notes: notes.trim(),
      });
      onCancel();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-4">
      <datalist id="loan-lenders">
        {lenderNames.map((name) => <option key={name} value={name} />)}
      </datalist>
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Lender Name *</label>
          <input list="loan-lenders" className={inp} value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="Person or supplier" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Category *</label>
          <select className={inp} value={category} onChange={(e) => setCategory(e.target.value)}>
            {LOAN_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Amount Borrowed (KES) *</label>
          <input type="number" className={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Purpose / Description *</label>
          <input className={inp} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Diesel for KBZ trip 007" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Date Borrowed *</label>
          <input type="date" className={inp} value={dateBorrowed} onChange={(e) => setDateBorrowed(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Due Date</label>
          <input type="date" className={inp} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Notes</label>
        <textarea rows="3" className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2 mobile-action-stack sm:flex-row">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving..." : "Save Loan"}
        </button>
      </div>
    </div>
  );
}

function RepaymentForm({ loan, onSave, onCancel }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (amount === "") {
      alert("Amount is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        amount: Number(amount),
        date,
        method,
        notes,
      });
      setAmount("");
      setNotes("");
      onCancel?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Add Repayment</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{loan?.lenderName || "Selected loan"}</p>
        </div>
        <Badge color={loanStatusColor(loan?.status)}>{loan?.status || "Outstanding"}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Amount *</label>
          <input type="number" className={inp} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" max={loan?.balance || undefined} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Date *</label>
          <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Method *</label>
          <select className={inp} value={method} onChange={(e) => setMethod(e.target.value)}>
            {REPAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Notes</label>
          <textarea rows="2" className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-1 mobile-action-stack sm:flex-row">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Recording..." : "Record Repayment"}
        </button>
      </div>
    </div>
  );
}

function LoanDetailModal({ loan, repayments, onClose, onAddRepayment, onEdit, onRepayQuick, isAdmin }) {
  const [inlineRepaymentOpen, setInlineRepaymentOpen] = useState(false);

  useEffect(() => {
    setInlineRepaymentOpen(false);
  }, [loan?.id]);

  if (!loan) return null;

  return (
    <Modal open={!!loan} onClose={onClose} title="Loan Detail" wide>
      <div className="space-y-5">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Lender</p>
              <h3 className="mt-1 text-2xl font-black text-slate-800">{loan.lenderName}</h3>
              <p className="mt-1 text-sm text-slate-500">{loan.purpose}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="blue">{loan.category}</Badge>
              <Badge color={loanStatusColor(loan.status)}>{loan.status}</Badge>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Amount" value={fmt(loan.amount)} icon="💰" color="blue" />
            <StatCard label="Repaid" value={fmt(loan.amountRepaid)} icon="✅" color="green" />
            <StatCard label="Balance" value={fmt(loan.balance)} icon="📌" color={loan.balance > 0 ? "red" : "green"} />
            <StatCard label="Due" value={loan.dueDate || "None"} icon="📅" color="slate" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Date Borrowed</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{loan.dateBorrowed || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Due Date</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{loan.dueDate || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Balance</p>
            <p className={`mt-1 text-sm font-black ${loan.balance > 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmt(loan.balance)}</p>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{loan.notes || "No notes added."}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-slate-700">Repayment History</h4>
            <Badge color="slate">{repayments.length} entries</Badge>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Date", "Amount", "Method", "Notes"].map((head, index) => (
                      <th key={head} className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 ${index === 0 ? "sticky left-0 z-[3] bg-slate-50" : ""}`}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repayments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400">No repayments yet</td>
                    </tr>
                  ) : repayments.map((repayment) => (
                    <tr key={repayment.id} className="border-b border-slate-50 bg-white hover:bg-slate-50">
                      <td className="sticky left-0 z-[2] bg-white px-4 py-3 font-medium text-slate-700 group-hover:bg-slate-50">
                        {repayment.date || "N/A"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">{fmt(repayment.amount)}</td>
                      <td className="px-4 py-3 text-slate-500">{repayment.method || "Cash"}</td>
                      <td className="px-4 py-3 text-slate-600">{repayment.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isAdmin && loan.balance > 0 && (
          <div className="space-y-3">
            {!inlineRepaymentOpen ? (
              <button
                type="button"
                onClick={() => setInlineRepaymentOpen(true)}
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
              >
                Add Repayment
              </button>
            ) : (
              <RepaymentForm
                loan={loan}
                onSave={async (repayment) => {
                  await onAddRepayment(loan, repayment);
                  setInlineRepaymentOpen(false);
                }}
                onCancel={() => setInlineRepaymentOpen(false)}
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {isAdmin && loan.balance > 0 && (
            <button
              type="button"
              onClick={onRepayQuick}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Quick Repay
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Edit Loan
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function QuickRepaymentModal({ loan, open, onClose, onSave }) {
  return (
    <Modal open={open && !!loan} onClose={onClose} title="Record Repayment">
      {loan && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loan</p>
            <p className="mt-1 text-base font-black text-slate-800">{loan.lenderName}</p>
            <p className="text-sm text-slate-500">{loan.purpose}</p>
            <p className="mt-2 text-sm font-semibold text-rose-600">Outstanding: {fmt(loan.balance)}</p>
          </div>
          <RepaymentForm
            loan={loan}
            onSave={onSave}
            onCancel={onClose}
          />
        </div>
      )}
    </Modal>
  );
}

export default function LoansPage({ loans = [] }) {
  const { isAdmin } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [repaymentLoanId, setRepaymentLoanId] = useState(null);
  const [deletingLoanId, setDeletingLoanId] = useState(null);
  const [repayments, setRepayments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const selectedLoan = useMemo(() => loans.find((loan) => loan.id === selectedLoanId) || null, [loans, selectedLoanId]);
  const editingLoan = useMemo(() => loans.find((loan) => loan.id === editingLoanId) || null, [loans, editingLoanId]);
  const repaymentLoan = useMemo(() => loans.find((loan) => loan.id === repaymentLoanId) || null, [loans, repaymentLoanId]);
  const deletingLoan = useMemo(() => loans.find((loan) => loan.id === deletingLoanId) || null, [loans, deletingLoanId]);
  const lenderNames = useMemo(() => [...new Set(loans.map((loan) => loan.lenderName).filter(Boolean))].sort(), [loans]);

  useEffect(() => {
    if (!selectedLoanId) {
      setRepayments([]);
      return undefined;
    }
    return loanService.subscribeRepayments(selectedLoanId, setRepayments);
  }, [selectedLoanId]);

  const filteredLoans = useMemo(() => loans.filter((loan) => {
    if (statusFilter !== "All" && loan.status !== statusFilter) return false;
    if (categoryFilter !== "All" && loan.category !== categoryFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      return [loan.lenderName, loan.purpose, loan.category]
        .some((value) => String(value || "").toLowerCase().includes(term));
    }
    return true;
  }), [loans, search, statusFilter, categoryFilter]);

  const totals = useMemo(() => ({
    borrowed: loans.reduce((sum, loan) => sum + toNumber(loan.amount), 0),
    outstanding: loans.reduce((sum, loan) => sum + toNumber(loan.balance), 0),
    repaid: loans.reduce((sum, loan) => sum + toNumber(loan.amountRepaid), 0),
    active: loans.filter((loan) => loan.status !== "Cleared").length,
  }), [loans]);

  const lenderCards = useMemo(() => {
    const groups = loans.reduce((acc, loan) => {
      const key = loan.lenderName || "Unknown lender";
      if (!acc[key]) acc[key] = [];
      acc[key].push(loan);
      return acc;
    }, {});
    return Object.entries(groups).map(([name, items]) => {
      const aggregate = lenderAggregate(items);
      return {
        name,
        balance: aggregate.balance,
        count: items.length,
        status: aggregate.status,
      };
    });
  }, [loans]);

  const handleAddLoan = async (data) => loanService.add(data);
  const handleUpdateLoan = async (data) => loanService.update(editingLoan.id, data);
  const handleDeleteLoan = async () => loanService.delete(deletingLoan.id);
  const handleAddRepayment = async (loan, repayment) => loanService.addRepayment(loan.id, repayment);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">Loans</h2>
          <p className="mt-1 text-sm text-slate-500">Track borrowing, repayment progress, and who still needs to be settled.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
          >
            {showAddForm ? "Hide Form" : "+ Add Loan"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mobile-card-rail mobile-card-rail--compact">
        <StatCard label="Total Borrowed" value={fmt(totals.borrowed)} icon="💸" color="blue" />
        <StatCard label="Outstanding" value={fmt(totals.outstanding)} icon="⛔" color="red" />
        <StatCard label="Total Repaid" value={fmt(totals.repaid)} icon="✅" color="green" />
        <StatCard label="Active Loans" value={totals.active} icon="📌" color="amber" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lenderCards.map((card) => (
          <div key={card.name} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Lender</p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">{card.name}</h3>
              </div>
              <Badge color={lenderStatusColor(card.status)}>
                {card.status === "cleared" ? "Cleared" : card.status === "partial" ? "Partially Paid" : "Outstanding"}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Total Owed</p>
                <p className="mt-1 font-black text-slate-800">{fmt(card.balance)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Loans</p>
                <p className="mt-1 font-black text-slate-800">{card.count}</p>
              </div>
            </div>
          </div>
        ))}
        {lenderCards.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
            No loans recorded yet.
          </div>
        )}
      </div>

      {isAdmin && showAddForm && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-700">Add Loan</h3>
          <LoanForm lenderNames={lenderNames} onSave={handleAddLoan} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lender or purpose"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {["All", "Outstanding", "Partially Paid", "Cleared"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option>All</option>
            {LOAN_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="table-scroll-container">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-100">
                {["Date", "Lender", "Category", "Purpose", "Amount", "Repaid", "Balance", "Status", "Actions"].map((head, index) => (
                  <th
                    key={head}
                    className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 ${index === 0 ? "sticky left-0 z-[3] bg-slate-50" : ""}`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">No loans found</td>
                </tr>
              ) : filteredLoans.map((loan) => (
                <tr
                  key={loan.id}
                  onClick={() => setSelectedLoanId(loan.id)}
                  className="group cursor-pointer border-b border-slate-50 bg-white transition-colors hover:bg-slate-50"
                >
                  <td className="sticky left-0 z-[2] bg-white px-4 py-3 font-medium text-slate-700 group-hover:bg-slate-50">{loan.dateBorrowed || "N/A"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{loan.lenderName}</td>
                  <td className="px-4 py-3"><Badge color="blue">{loan.category}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">{loan.purpose}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">{fmt(loan.amount)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{fmt(loan.amountRepaid)}</td>
                  <td className="px-4 py-3 font-black text-rose-600">{fmt(loan.balance)}</td>
                  <td className="px-4 py-3"><Badge color={loanStatusColor(loan.status)}>{loan.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLoanId(loan.id);
                        }}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        View
                      </button>
                      {isAdmin && loan.balance > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRepaymentLoanId(loan.id);
                          }}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Repay
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLoanId(loan.id);
                            }}
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingLoanId(loan.id);
                            }}
                            className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                          >
                            Del
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LoanDetailModal
        loan={selectedLoan}
        repayments={repayments}
        onClose={() => setSelectedLoanId(null)}
        onAddRepayment={handleAddRepayment}
        onEdit={() => {
          setSelectedLoanId(null);
          setEditingLoanId(selectedLoan?.id || null);
        }}
        onRepayQuick={() => {
          setSelectedLoanId(null);
          setRepaymentLoanId(selectedLoan?.id || null);
        }}
        isAdmin={isAdmin}
      />

      <QuickRepaymentModal
        loan={repaymentLoan}
        open={!!repaymentLoan}
        onClose={() => setRepaymentLoanId(null)}
        onSave={async (repayment) => {
          await handleAddRepayment(repaymentLoan, repayment);
          setRepaymentLoanId(null);
        }}
      />

      <Modal open={!!editingLoan} onClose={() => setEditingLoanId(null)} title="Edit Loan" wide>
        {editingLoan && (
          <LoanForm
            initial={editingLoan}
            lenderNames={lenderNames}
            onSave={handleUpdateLoan}
            onCancel={() => setEditingLoanId(null)}
          />
        )}
      </Modal>

      <Modal open={!!deletingLoan} onClose={() => setDeletingLoanId(null)} title="Delete Loan">
        {deletingLoan && (
          <div className="space-y-4">
            <p className="text-slate-600">
              Delete loan from <strong>{deletingLoan.lenderName}</strong> for {fmt(deletingLoan.amount)}?
              <br /><span className="font-semibold text-rose-500">This cannot be undone.</span>
            </p>
            <div className="flex gap-3 mobile-action-stack sm:flex-row">
              <button onClick={() => setDeletingLoanId(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={async () => {
                  await handleDeleteLoan();
                  setDeletingLoanId(null);
                }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
