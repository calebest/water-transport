import { supabase } from "./supabase";

const fromDB = (obj) => ({
  ...obj,
  personnelId: obj.personnel_id,
  dateBorrowed: obj.date,
  category: obj.type,
  purpose: obj.reason,
  amountRepaid: obj.amount_repaid,
});

const normaliseLoan = (data, existing = {}) => {
  const amount = Number(data.amount ?? existing.amount ?? 0);
  const amountRepaid = Number(data.amountRepaid ?? existing.amount_repaid ?? 0);
  const balance = Math.max(amount - amountRepaid, 0);
  const status = balance <= 0 ? "Cleared" : amountRepaid > 0 ? "Partially Paid" : "Outstanding";

  return {
    personnel_id: data.personnelId ?? existing.personnel_id,
    amount,
    date: data.dateBorrowed ?? existing.date,
    type: data.category ?? existing.type ?? "Other",
    reason: (data.purpose ?? existing.reason ?? "").trim(),
    status,
    amount_repaid: amountRepaid,
    balance,
  };
};

const fetchLoans = async () => {
  const { data, error } = await supabase.from('loans').select('*').order('date', { ascending: false });
  if (error) { console.error("loans fetch error:", error.message); return []; }
  return (data || []).map(fromDB);
};

export const loanService = {
  add: async (data) => {
    const loan = normaliseLoan({ ...data, amountRepaid: 0 }, {});
    const { data: inserted, error } = await supabase
      .from('loans')
      .insert({ ...loan, amount_repaid: 0, balance: loan.amount, status: "Outstanding" })
      .select()
      .single();
    if (error) throw error;
    return fromDB(inserted);
  },

  update: async (id, data) => {
    const { data: existing, error: fetchError } = await supabase.from('loans').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;
    const loan = normaliseLoan(data, existing);
    const { error } = await supabase.from('loans').update(loan).eq('id', id);
    if (error) throw error;
  },

  delete: async (id) => {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) throw error;
  },

  addRepayment: async (loanId, repaymentData) => {
    const amount = Number(repaymentData.amount);
    if (amount <= 0) throw new Error("Repayment amount must be greater than zero.");

    const { data: loan, error: loanError } = await supabase.from('loans').select('*').eq('id', loanId).single();
    if (loanError) throw loanError;

    const currentBalance = Math.max(Number(loan.amount) - Number(loan.amount_repaid || 0), 0);
    if (amount > currentBalance) throw new Error("Repayment cannot exceed the outstanding balance.");

    const amountRepaid = Number(loan.amount_repaid || 0) + amount;
    const balance = Math.max(Number(loan.amount) - amountRepaid, 0);
    const status = balance <= 0 ? "Cleared" : amountRepaid > 0 ? "Partially Paid" : "Outstanding";

    const { error: repError } = await supabase.from('loan_repayments').insert({
      loan_id: loanId,
      amount,
      date: repaymentData.date || new Date().toISOString().slice(0, 10),
      method: repaymentData.method || "Cash",
      notes: (repaymentData.notes || "").trim()
    });
    if (repError) throw repError;

    const { error: updateError } = await supabase.from('loans').update({ amount_repaid: amountRepaid, balance, status }).eq('id', loanId);
    if (updateError) throw updateError;
  },

  subscribe: (callback) => {
    const channelId = `loans-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    fetchLoans().then(data => { if (mounted) callback(data); });

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, async () => {
        const data = await fetchLoans();
        if (mounted) callback(data);
      })
      .subscribe();
      
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  },

  subscribeRepayments: (loanId, callback) => {
    const channelId = `loan-repayments-${loanId}-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    supabase.from('loan_repayments').select('*').eq('loan_id', loanId).order('recorded_at', { ascending: false }).then(({ data }) => {
      if (mounted && data) callback(data);
    });

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_repayments', filter: `loan_id=eq.${loanId}` }, async () => {
        const { data } = await supabase.from('loan_repayments').select('*').eq('loan_id', loanId).order('recorded_at', { ascending: false });
        if (mounted && data) callback(data);
      })
      .subscribe();
      
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  },
};
