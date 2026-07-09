import { useEffect, useMemo, useState } from "react";
import { personalFinanceService } from "../services/personalFinance";
import { Badge, Modal, StatCard } from "../components/ui";
import { fmt, today } from "../utils/helpers";
import EarningsPage from "./Earnings";

const METHODS = ["Cash", "M-Pesa", "Bank Transfer"];
const CATEGORIES = ["Personal", "Business", "Family", "Supplier", "Emergency", "Other"];

const toNumber = (value) => Number(value || 0);

const statusColor = (status) => (status === "Cleared" ? "green" : "red");

const daysSince = (date) => {
  if (!date) return 0;
  const start = new Date(`${date}T00:00:00`);
  const now = new Date();
  return Math.max(Math.floor((now - start) / 86400000), 0);
};

const isOverdue = (record) => record.status !== "Cleared" && record.dueDate && record.dueDate < today();

function RecordForm({ initial, people, defaultType = "i_owe", onSave, onCancel }) {
  const [type, setType] = useState(initial?.type || defaultType);
  const [personName, setPersonName] = useState(initial?.personName || "");
  const [category, setCategory] = useState(initial?.category || "Personal");
  const [description, setDescription] = useState(initial?.description || "");
  const [principalAmount, setPrincipalAmount] = useState(initial?.principalAmount || "");
  const [startDate, setStartDate] = useState(initial?.startDate || today());
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [method, setMethod] = useState(initial?.method || "Cash");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const handleSubmit = async () => {
    if (!personName.trim() || !description.trim() || principalAmount === "") {
      alert("Person, description, and amount are required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        type,
        personName: personName.trim(),
        category,
        description: description.trim(),
        principalAmount: Number(principalAmount),
        amountAdded: initial?.amountAdded ?? Number(principalAmount),
        amountPaid: initial?.amountPaid ?? 0,
        startDate,
        dueDate,
        method,
        notes: notes.trim(),
      });
      onCancel();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <datalist id="personal-finance-people">
        {people.map((name) => <option key={name} value={name} />)}
      </datalist>
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Direction</label>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="i_owe">Money I Owe</option>
            <option value="owed_to_me">Money Owed To Me</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Person / Lender</label>
          <input list="personal-finance-people" className={inputClass} value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Name" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the money is for" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Amount</label>
          <input type="number" className={inputClass} value={principalAmount} onChange={(e) => setPrincipalAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Method</label>
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Start Date</label>
          <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Due Date</label>
          <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Notes</label>
        <textarea rows="3" className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-3 mobile-action-stack sm:flex-row">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Saving..." : "Save Record"}
        </button>
      </div>
    </div>
  );
}

function TransactionForm({ record, onSave, onCancel }) {
  const [transactionType, setTransactionType] = useState(record?.type === "i_owe" ? "payment" : "received");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTransactionType(record?.type === "i_owe" ? "payment" : "received");
  }, [record?.id, record?.type]);

  const inputClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const options = record?.type === "i_owe"
    ? [["payment", "I Paid Back"], ["top_up", "Lender Added More"]]
    : [["received", "They Paid Me"], ["lent_more", "I Added More"]];

  const handleSubmit = async () => {
    if (amount === "") {
      alert("Amount is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ transactionType, amount: Number(amount), date, method, notes });
      onCancel();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Selected Record</p>
        <p className="mt-1 font-black text-slate-800">{record?.personName}</p>
        <p className="text-sm text-slate-500">{record?.description}</p>
        <p className="mt-2 text-sm font-bold text-rose-600">Balance: {fmt(record?.balance)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mobile-form-grid">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Action</label>
          <select className={inputClass} value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
            {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Amount</label>
          <input type="number" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Date</label>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Method</label>
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Notes</label>
          <textarea rows="2" className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 mobile-action-stack sm:flex-row">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? "Recording..." : "Record"}
        </button>
      </div>
    </div>
  );
}

function RecordDetailModal({ record, transactions, onClose, onEdit, onDelete, onTransact }) {
  if (!record) return null;
  return (
    <Modal open={!!record} onClose={onClose} title="Finance Record" wide>
      <div className="space-y-5">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{record.type === "i_owe" ? "I Owe" : "Owed To Me"}</p>
              <h3 className="mt-1 text-2xl font-black text-slate-800">{record.personName}</h3>
              <p className="mt-1 text-sm text-slate-500">{record.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge color="blue">{record.category}</Badge>
              <Badge color={statusColor(record.status)}>{record.status}</Badge>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Added" value={fmt(record.amountAdded)} icon="+" color="blue" />
            <StatCard label={record.type === "i_owe" ? "Paid Back" : "Received"} value={fmt(record.amountPaid)} icon="-" color="green" />
            <StatCard label="Balance" value={fmt(record.balance)} icon="KES" color={record.balance > 0 ? "red" : "green"} />
            <StatCard label="Open Days" value={daysSince(record.startDate)} icon="D" color="slate" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Start</p><p className="mt-1 font-semibold text-slate-700">{record.startDate || "N/A"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Due</p><p className="mt-1 font-semibold text-slate-700">{record.dueDate || "None"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Method</p><p className="mt-1 font-semibold text-slate-700">{record.method || "Cash"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Status</p><p className={`mt-1 font-black ${record.balance > 0 ? "text-rose-600" : "text-emerald-700"}`}>{record.status}</p></div>
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{record.notes || "No notes added."}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-700">Money Movement</h4>
            <Badge color="slate">{transactions.length} entries</Badge>
          </div>
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No top-ups or payments recorded yet.</div>
            ) : transactions.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.date || "N/A"} - {item.transactionType}</p>
                  <p className="text-xs text-slate-500">{item.method || "Cash"} {item.notes ? `- ${item.notes}` : ""}</p>
                </div>
                <p className={`font-black ${item.effect === "increase" ? "text-blue-700" : "text-emerald-700"}`}>{item.effect === "increase" ? "+" : "-"} {fmt(item.amount)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <button onClick={onTransact} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Add Movement</button>
          <button onClick={onEdit} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Edit</button>
          <button onClick={onDelete} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Delete</button>
          <button onClick={onClose} className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-900">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function FinanceRecords({ records, type, people }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [transactionId, setTransactionId] = useState(null);
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState([]);

  const scopedRecords = useMemo(() => records.filter((record) => record.type === type), [records, type]);
  const selectedRecord = useMemo(() => records.find((record) => record.id === selectedId) || null, [records, selectedId]);
  const editingRecord = useMemo(() => records.find((record) => record.id === editingId) || null, [records, editingId]);
  const transactionRecord = useMemo(() => records.find((record) => record.id === transactionId) || null, [records, transactionId]);

  useEffect(() => {
    if (!selectedId) {
      setTransactions([]);
      return undefined;
    }
    return personalFinanceService.subscribeTransactions(selectedId, setTransactions);
  }, [selectedId]);

  const filtered = useMemo(() => scopedRecords.filter((record) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return [record.personName, record.description, record.category, record.notes].some((value) => String(value || "").toLowerCase().includes(term));
  }), [scopedRecords, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-800">{type === "i_owe" ? "Money I Owe" : "Money Owed To Me"}</h3>
          <p className="text-sm text-slate-500">{type === "i_owe" ? "Track lenders, top-ups, repayments, and overdue promises." : "Track people who owe you, added advances, and money received."}</p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">
          {showForm ? "Hide Form" : "+ Add Record"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <RecordForm defaultType={type} people={people} onSave={personalFinanceService.add} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs font-semibold text-slate-500">Search</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search person, description, or notes" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">No records found.</div>
        ) : filtered.map((record) => (
          <button key={record.id} onClick={() => setSelectedId(record.id)} className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{record.category}</p>
                <h4 className="mt-1 truncate text-lg font-black text-slate-800">{record.personName}</h4>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{record.description}</p>
              </div>
              <Badge color={statusColor(record.status)}>{record.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs font-bold text-blue-500">Total</p><p className="font-black text-blue-700">{fmt(record.amountAdded)}</p></div>
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-500">{type === "i_owe" ? "Paid" : "Received"}</p><p className="font-black text-emerald-700">{fmt(record.amountPaid)}</p></div>
              <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-bold text-rose-500">Balance</p><p className="font-black text-rose-700">{fmt(record.balance)}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
              <span>{daysSince(record.startDate)} days open</span>
              {isOverdue(record) && <Badge color="red">Overdue</Badge>}
            </div>
          </button>
        ))}
      </div>

      <RecordDetailModal
        record={selectedRecord}
        transactions={transactions}
        onClose={() => setSelectedId(null)}
        onEdit={() => {
          setEditingId(selectedRecord?.id || null);
          setSelectedId(null);
        }}
        onDelete={async () => {
          await personalFinanceService.delete(selectedRecord.id);
          setSelectedId(null);
        }}
        onTransact={() => {
          setTransactionId(selectedRecord?.id || null);
          setSelectedId(null);
        }}
      />

      <Modal open={!!editingRecord} onClose={() => setEditingId(null)} title="Edit Finance Record" wide>
        {editingRecord && (
          <RecordForm initial={editingRecord} people={people} onSave={(data) => personalFinanceService.update(editingRecord.id, data)} onCancel={() => setEditingId(null)} />
        )}
      </Modal>

      <Modal open={!!transactionRecord} onClose={() => setTransactionId(null)} title="Add Money Movement">
        {transactionRecord && (
          <TransactionForm
            record={transactionRecord}
            onSave={(data) => personalFinanceService.addTransaction(transactionRecord.id, data)}
            onCancel={() => setTransactionId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function PeopleSummary({ records }) {
  const people = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      const key = record.personName || "Unknown";
      const item = map.get(key) || { name: key, iOwe: 0, owedToMe: 0, records: 0, overdue: 0 };
      if (record.type === "i_owe") item.iOwe += toNumber(record.balance);
      else item.owedToMe += toNumber(record.balance);
      item.records += 1;
      if (isOverdue(record)) item.overdue += 1;
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => (b.iOwe + b.owedToMe) - (a.iOwe + a.owedToMe));
  }, [records]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {people.length === 0 ? (
        <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">No people to summarize yet.</div>
      ) : people.map((person) => (
        <div key={person.name} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Person</p>
              <h3 className="mt-1 text-lg font-black text-slate-800">{person.name}</h3>
            </div>
            <Badge color={person.overdue > 0 ? "red" : "slate"}>{person.records} records</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-bold text-rose-500">I Owe</p><p className="font-black text-rose-700">{fmt(person.iOwe)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-500">Owed To Me</p><p className="font-black text-emerald-700">{fmt(person.owedToMe)}</p></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionCenter({ records }) {
  const overdue = records.filter(isOverdue);
  const open = records.filter((record) => record.status !== "Cleared");
  const largest = [...open].sort((a, b) => toNumber(b.balance) - toNumber(a.balance)).slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700">Action Center</h3>
        <div className="mt-3 space-y-2">
          {overdue.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">No overdue personal finance records.</p>
          ) : overdue.slice(0, 5).map((record) => (
            <div key={record.id} className="rounded-xl bg-rose-50 p-3">
              <p className="text-sm font-black text-rose-700">{record.personName} - {fmt(record.balance)}</p>
              <p className="text-xs text-rose-500">Due {record.dueDate} - {record.type === "i_owe" ? "you owe them" : "they owe you"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700">Useful Additions</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600">
          <p className="rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-800">Promise dates:</span> show what must be paid or collected this week.</p>
          <p className="rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-800">Person statements:</span> one-click view of all money movements with one person.</p>
          <p className="rounded-xl bg-slate-50 p-3"><span className="font-bold text-slate-800">Cash planning:</span> compare upcoming obligations against manager earnings.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-bold text-slate-700">Largest Open Balances</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {largest.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 md:col-span-2">No open balances.</p>
          ) : largest.map((record) => (
            <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <div>
                <p className="font-bold text-slate-800">{record.personName}</p>
                <p className="text-xs text-slate-500">{record.description}</p>
              </div>
              <p className="font-black text-rose-600">{fmt(record.balance)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PersonalFinancePage({ records = [], trips, vehicles, earningsConfig, onOpenTripReview, onMarkTripPaid }) {
  const [activeTab, setActiveTab] = useState("overview");

  const people = useMemo(() => [...new Set(records.map((record) => record.personName).filter(Boolean))].sort(), [records]);
  const totals = useMemo(() => ({
    iOwe: records.filter((record) => record.type === "i_owe").reduce((sum, record) => sum + toNumber(record.balance), 0),
    owedToMe: records.filter((record) => record.type === "owed_to_me").reduce((sum, record) => sum + toNumber(record.balance), 0),
    overdue: records.filter(isOverdue).length,
    open: records.filter((record) => record.status !== "Cleared").length,
  }), [records]);

  const netPosition = totals.owedToMe - totals.iOwe;
  const tabs = [
    ["overview", "Overview"],
    ["owe", "I Owe"],
    ["owed", "Owed To Me"],
    ["people", "People"],
    ["earnings", "Earnings"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">Personal Finance</h2>
          <p className="mt-1 text-sm text-slate-500">Track private obligations, lenders, people who owe you, money movements, and manager earnings in one place.</p>
        </div>
        <Badge color={netPosition >= 0 ? "green" : "red"}>{netPosition >= 0 ? "Positive" : "Payables High"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mobile-card-rail mobile-card-rail--compact">
        <StatCard label="Money I Owe" value={fmt(totals.iOwe)} icon="OUT" color="red" />
        <StatCard label="Owed To Me" value={fmt(totals.owedToMe)} icon="IN" color="green" />
        <StatCard label="Net Position" value={fmt(netPosition)} icon="NET" color={netPosition >= 0 ? "green" : "amber"} />
        <StatCard label="Open Records" value={totals.open} icon="OPEN" color="slate" sub={`${totals.overdue} overdue`} />
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${activeTab === id ? "bg-emerald-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && <ActionCenter records={records} />}
      {activeTab === "owe" && <FinanceRecords records={records} type="i_owe" people={people} />}
      {activeTab === "owed" && <FinanceRecords records={records} type="owed_to_me" people={people} />}
      {activeTab === "people" && <PeopleSummary records={records} />}
      {activeTab === "earnings" && (
        <EarningsPage
          trips={trips}
          vehicles={vehicles}
          earningsConfig={earningsConfig}
          onOpenTripReview={onOpenTripReview}
          onMarkTripPaid={onMarkTripPaid}
        />
      )}
    </div>
  );
}
