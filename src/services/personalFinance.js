import { supabase } from "./supabase";

const statusFromBalance = (balance) => (balance <= 0 ? "Cleared" : "Open");

const normaliseRecord = (data, existing = {}) => {
  const principalAmount = Number(data.principalAmount ?? existing.principal_amount ?? 0);
  const amountAdded = Number(data.amountAdded ?? existing.amount_added ?? principalAmount);
  const amountPaid = Number(data.amountPaid ?? existing.amount_paid ?? 0);
  const balance = Math.max(amountAdded - amountPaid, 0);

  return {
    type: data.type ?? existing.type ?? "i_owe",
    person_name: (data.personName ?? existing.person_name ?? "").trim(),
    category: data.category ?? existing.category ?? "Personal",
    description: (data.description ?? existing.description ?? "").trim(),
    principal_amount: principalAmount,
    amount_added: amountAdded,
    amount_paid: amountPaid,
    balance,
    status: statusFromBalance(balance),
    start_date: data.startDate ?? existing.start_date ?? "",
    due_date: data.dueDate ?? existing.due_date ?? "",
    method: data.method ?? existing.method ?? "Cash",
    notes: (data.notes ?? existing.notes ?? "").trim(),
  };
};

const transactionEffect = (recordType, transactionType) => {
  if (transactionType === "top_up") return "increase";
  if (transactionType === "payment") return "decrease";
  if (transactionType === "received") return "decrease";
  if (transactionType === "lent_more") return "increase";
  return recordType === "i_owe" ? "decrease" : "increase";
};

const fromDB = (obj) => ({
  ...obj,
  personName: obj.person_name,
  principalAmount: obj.principal_amount,
  amountAdded: obj.amount_added,
  amountPaid: obj.amount_paid,
  startDate: obj.start_date,
  dueDate: obj.due_date,
  person_name: undefined, principal_amount: undefined, amount_added: undefined, amount_paid: undefined, start_date: undefined, due_date: undefined
});

const fromDBTx = (obj) => ({
  ...obj,
  transactionType: obj.transaction_type,
  recordedAt: obj.recorded_at,
  transaction_type: undefined, recorded_at: undefined
});

export const personalFinanceService = {
  add: async (data) => {
    const record = normaliseRecord({ ...data, amountPaid: 0 }, {});
    const { data: inserted, error } = await supabase
      .from('personal_finance')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return fromDB(inserted);
  },

  update: async (id, data) => {
    const { data: existing, error: fetchError } = await supabase.from('personal_finance').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

    const { error } = await supabase.from('personal_finance').update(normaliseRecord(data, existing)).eq('id', id);
    if (error) throw error;
  },

  delete: async (id) => {
    const { error } = await supabase.from('personal_finance').delete().eq('id', id);
    if (error) throw error;
  },

  addTransaction: async (recordId, transaction) => {
    const amount = Number(transaction.amount);
    if (amount <= 0) throw new Error("Amount must be greater than zero.");

    const { data: record, error: fetchError } = await supabase.from('personal_finance').select('*').eq('id', recordId).single();
    if (fetchError) throw fetchError;

    const effect = transactionEffect(record.type, transaction.transactionType);
    const amountAdded = Number(record.amount_added) + (effect === "increase" ? amount : 0);
    const amountPaid = Number(record.amount_paid) + (effect === "decrease" ? amount : 0);
    const balance = Math.max(amountAdded - amountPaid, 0);

    const { error: txError } = await supabase.from('personal_finance_tx').insert({
      record_id: recordId,
      transaction_type: transaction.transactionType || (record.type === "i_owe" ? "payment" : "received"),
      amount,
      date: transaction.date || "",
      method: transaction.method || "Cash",
      notes: (transaction.notes || "").trim(),
      effect,
    });
    if (txError) throw txError;

    const { error: updateError } = await supabase.from('personal_finance').update({
      amount_added: amountAdded,
      amount_paid: amountPaid,
      balance,
      status: statusFromBalance(balance),
    }).eq('id', recordId);
    if (updateError) throw updateError;
  },

  subscribe: (callback) => {
    supabase.from('personal_finance').select('*').order('start_date', { ascending: false }).then(({ data, error }) => {
      if (!error && data) callback(data.map(fromDB));
    });

    const channel = supabase
      .channel('public:personal_finance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_finance' }, async () => {
        const { data } = await supabase.from('personal_finance').select('*').order('start_date', { ascending: false });
        if (data) callback(data.map(fromDB));
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  },

  subscribeTransactions: (recordId, callback) => {
    supabase.from('personal_finance_tx').select('*').eq('record_id', recordId).order('date', { ascending: false }).then(({ data, error }) => {
      if (!error && data) callback(data.map(fromDBTx));
    });

    const channel = supabase
      .channel(`public:personal_finance_tx:record_id=eq.${recordId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_finance_tx', filter: `record_id=eq.${recordId}` }, async () => {
        const { data } = await supabase.from('personal_finance_tx').select('*').eq('record_id', recordId).order('date', { ascending: false });
        if (data) callback(data.map(fromDBTx));
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  },
};
