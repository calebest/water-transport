import { supabase } from "./supabase";

export const financeService = {
  // --- BROKER LEDGER & SETTLEMENTS ---

  makeBrokerSettlement: async (amount, { date, method, notes, userId } = {}) => {
    let remainingAmount = Number(amount);
    if (isNaN(remainingAmount) || remainingAmount <= 0) throw new Error("Invalid settlement amount");

    const paymentDate = date || new Date().toISOString().slice(0, 10);

    // 1. Fetch unpaid approved trips
    const { data: unpaidTripsRaw, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .eq('approval_status', 'approved')
      .neq('status', 'Paid');
      
    if (tripsError) throw tripsError;
    
    let unpaidTrips = unpaidTripsRaw
      .filter(t => Number(t.revenue || 0) > 0)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const linkedTrips = [];
    const updates = [];

    // 2. Apply payment across trips
    for (const trip of unpaidTrips) {
      if (remainingAmount <= 0) break;

      const revenue = Number(trip.revenue || 0);
      const currentPaid = Number(trip.amount_paid || 0);
      const tripBalance = revenue - currentPaid;

      if (tripBalance <= 0) continue;

      let paymentToApply = 0;
      let newStatus = trip.status;

      if (remainingAmount >= tripBalance) {
        paymentToApply = tripBalance;
        remainingAmount -= tripBalance;
        newStatus = "Paid";
      } else {
        paymentToApply = remainingAmount;
        remainingAmount = 0;
        newStatus = "Partial";
      }

      linkedTrips.push({ tripId: trip.id, applied: paymentToApply });

      updates.push({
        id: trip.id,
        amount_paid: currentPaid + paymentToApply,
        status: newStatus,
        paid_at: newStatus === "Paid" ? new Date().toISOString() : trip.paid_at || null
      });
    }

    // Since Supabase doesn't have a single bulk update via REST, we await updates sequentially
    for (const update of updates) {
      const { error: updateError } = await supabase.from('trips').update(update).eq('id', update.id);
      if (updateError) throw updateError;
    }

    // 3. Log settlement
    const { data: settlementData, error: settlementError } = await supabase.from('settlements').insert({
      amount: Number(amount),
      date: paymentDate,
      method: method || "Cash",
      notes: notes || "",
      linked_trips: linkedTrips,
      created_by: userId,
    }).select().single();

    if (settlementError) throw settlementError;
    const settlementId = settlementData.id;

    // 4. Log to broker_ledger
    const { error: ledgerError } = await supabase.from('broker_ledger').insert({
      settlement_id: settlementId,
      date: paymentDate,
      type: "remittance",
      amount: Number(amount),
      notes: notes || `Settlement via ${method || "Cash"}`,
    });

    if (ledgerError) throw ledgerError;

    return settlementId;
  },

  subscribeBrokerLedger: (callback) => {
    supabase.from('broker_ledger').select('*').then(({ data, error }) => {
      if (!error && data) {
        data.sort((a, b) => {
          const dateCompare = (a.date || "").localeCompare(b.date || "");
          if (dateCompare !== 0) return dateCompare;
          if (a.type === "remittance" && b.type !== "remittance") return 1;
          if (a.type !== "remittance" && b.type === "remittance") return -1;
          return 0;
        });
        callback(data);
      }
    });

    const channel = supabase
      .channel('public:broker_ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broker_ledger' }, async () => {
        const { data } = await supabase.from('broker_ledger').select('*');
        if (data) {
          data.sort((a, b) => {
            const dateCompare = (a.date || "").localeCompare(b.date || "");
            if (dateCompare !== 0) return dateCompare;
            if (a.type === "remittance" && b.type !== "remittance") return 1;
            if (a.type !== "remittance" && b.type === "remittance") return -1;
            return 0;
          });
          callback(data);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  },

  // --- PERSONNEL ACCOUNTS ---

  makePersonnelPayment: async (personnelId, amount, { date, notes } = {}) => {
    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) throw new Error("Invalid payment amount");

    const { data: inserted, error } = await supabase.from('personnel_ledger').insert({
      personnel_id: personnelId,
      date: date || new Date().toISOString().slice(0, 10),
      type: "payment",
      amount: paymentAmount,
      notes: notes || "Payment"
    }).select().single();

    if (error) throw error;
    return inserted.id;
  },

  subscribePersonnelLedger: (personnelId, callback) => {
    supabase.from('personnel_ledger').select('*').eq('personnel_id', personnelId).then(({ data, error }) => {
      if (!error && data) {
        data.sort((a, b) => {
          const dateCompare = (a.date || "").localeCompare(b.date || "");
          if (dateCompare !== 0) return dateCompare;
          if (a.type === "payment" && b.type !== "payment") return 1;
          if (a.type !== "payment" && b.type === "payment") return -1;
          return 0;
        });
        callback(data);
      }
    });

    const channel = supabase
      .channel(`public:personnel_ledger:personnel_id=eq.${personnelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel_ledger', filter: `personnel_id=eq.${personnelId}` }, async () => {
        const { data } = await supabase.from('personnel_ledger').select('*').eq('personnel_id', personnelId);
        if (data) {
          data.sort((a, b) => {
            const dateCompare = (a.date || "").localeCompare(b.date || "");
            if (dateCompare !== 0) return dateCompare;
            if (a.type === "payment" && b.type !== "payment") return 1;
            if (a.type !== "payment" && b.type === "payment") return -1;
            return 0;
          });
          callback(data);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  },

  subscribeAllPersonnelLedger: (callback) => {
    supabase.from('personnel_ledger').select('*').then(({ data, error }) => {
      if (!error && data) callback(data);
    });

    const channel = supabase
      .channel('public:personnel_ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel_ledger' }, async () => {
        const { data } = await supabase.from('personnel_ledger').select('*');
        if (data) callback(data);
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }
};
