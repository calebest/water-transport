import { supabase } from "./supabase";

export const financeService = {
  // --- BROKER LEDGER & SETTLEMENTS ---

  makeBrokerSettlement: async (brokerId, amount, { date, method, notes, userId, entryType = "remittance", lorry = null, startDate = null } = {}) => {
    if (!brokerId) throw new Error("Broker ID is required");
    let remainingAmount = Number(amount);
    if (isNaN(remainingAmount) || remainingAmount <= 0) throw new Error("Invalid settlement amount");

    const paymentDate = date || new Date().toISOString().slice(0, 10);

    // 1. Fetch unpaid approved trips (optionally filtered by lorry)
    let query = supabase
      .from('trips')
      .select('*')
      .eq('broker_id', brokerId)
      .eq('approval_status', 'approved')
      .neq('status', 'Paid');

    if (lorry) query = query.eq('lorry', lorry);
    if (startDate) query = query.gte('date', startDate);
      
    const { data: unpaidTripsRaw, error: tripsError } = await query;
      
    if (tripsError) throw tripsError;
    
    let unpaidTrips = unpaidTripsRaw
      .filter(t => Number(t.revenue || 0) > 0)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const linkedTrips = [];
    const updates = [];

    // 2. Apply payment across trips (FIFO)
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

    // 3. Log settlement (include lorry if provided)
    const { data: settlementData, error: settlementError } = await supabase.from('settlements').insert({
      amount: Number(amount),
      date: paymentDate,
      method: method || "Cash",
      notes: notes || `Payment via ${method || "Cash"}`,
      linked_trips: linkedTrips,
      created_by: userId,
      broker_id: brokerId,
      lorry: lorry || null,
    }).select().single();

    if (settlementError) throw settlementError;
    const settlementId = settlementData.id;

    // 4. Log to broker_ledger (include lorry if provided)
    const { error: ledgerError } = await supabase.from('broker_ledger').insert({
      settlement_id: settlementId,
      date: paymentDate,
      type: entryType,
      amount: Number(amount),
      notes: notes || `Payment via ${method || "Cash"}`,
      broker_id: brokerId,
      lorry: lorry || null,
    });

    if (ledgerError) throw ledgerError;

    return settlementId;
  },

  deleteBrokerSettlement: async (settlementId) => {
    // 1. Fetch the settlement to see which trips were affected
    const { data: settlement, error: fetchError } = await supabase
      .from('settlements')
      .select('*')
      .eq('id', settlementId)
      .single();
    if (fetchError) throw fetchError;

    const linkedTrips = settlement.linked_trips || [];

    // 2. Reverse the payments on those trips
    for (const link of linkedTrips) {
      const { data: trip } = await supabase.from('trips').select('amount_paid, revenue').eq('id', link.tripId).single();
      if (!trip) continue;
      
      const newAmountPaid = Math.max(0, Number(trip.amount_paid || 0) - Number(link.applied || 0));
      const newStatus = newAmountPaid <= 0 ? "Pending" : (newAmountPaid >= Number(trip.revenue) ? "Paid" : "Partial");
      
      await supabase.from('trips').update({
        amount_paid: newAmountPaid,
        status: newStatus,
        paid_at: newStatus === "Paid" ? new Date().toISOString() : null
      }).eq('id', link.tripId);
    }

    // 3. Delete the settlement record (broker_ledger entry cascades automatically)
    const { error: delError } = await supabase.from('settlements').delete().eq('id', settlementId);
    if (delError) throw delError;
  },

  closeBrokerPeriod: async (brokerId, { startDate, endDate, tripIds, settlementIds, ledgerIds, totals, notes, userId }) => {
    // 1. Create statement
    const { data: stmt, error: stmtError } = await supabase.from('broker_statements').insert({
      broker_id: brokerId,
      created_by: userId,
      start_date: startDate,
      end_date: endDate,
      total_revenue: totals.revenue,
      total_expenses: totals.expenses,
      total_remitted: totals.remitted,
      total_write_off: totals.writeOff,
      closing_balance: totals.balance,
      notes: notes || "Period closed manually"
    }).select().single();

    if (stmtError) throw stmtError;
    const stmtId = stmt.id;

    // 2. Link trips
    if (tripIds && tripIds.length > 0) {
      await supabase.from('trips').update({ statement_id: stmtId }).in('id', tripIds);
    }

    // 3. Link settlements
    if (settlementIds && settlementIds.length > 0) {
      await supabase.from('settlements').update({ statement_id: stmtId }).in('id', settlementIds);
    }

    // 4. Link broker_ledger entries
    if (ledgerIds && ledgerIds.length > 0) {
      await supabase.from('broker_ledger').update({ statement_id: stmtId }).in('id', ledgerIds);
    }

    return stmtId;
  },

  // Manual ledger entry (no FIFO trip distribution)
  addDirectBrokerEntry: async (brokerId, { date, type, amount, notes, lorry }) => {
    if (!brokerId) throw new Error("Broker ID required");
    const { error } = await supabase.from('broker_ledger').insert({
      broker_id: brokerId,
      date: date || new Date().toISOString().slice(0, 10),
      type,           // 'revenue' | 'expense_paid' | 'remittance' | 'write_off'
      amount: Number(amount),
      notes: notes || "",
      lorry: lorry || null,
    });
    if (error) throw error;
  },

  subscribeBrokerLedger: (brokerId, callback) => {
    if (!brokerId) {
        callback([]);
        return () => {};
    }
    
    const sortLedger = (a, b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;
      
      const numA = parseInt(String(a.trips?.trip_number || a.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.trips?.trip_number || b.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;

      if (a.type === "remittance" && b.type !== "remittance") return 1;
      if (a.type !== "remittance" && b.type === "remittance") return -1;
      return 0;
    };

    supabase.from('broker_ledger').select('*, trips(location, trip_number, lorry)').eq('broker_id', brokerId).then(({ data, error }) => {
      if (!error && data) {
        data.sort(sortLedger);
        callback(data);
      }
    });

    const channel = supabase
      .channel(`public:broker_ledger:${brokerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broker_ledger', filter: `broker_id=eq.${brokerId}` }, async () => {
        const { data } = await supabase.from('broker_ledger').select('*, trips(location, trip_number, lorry)').eq('broker_id', brokerId);
        if (data) {
          data.sort(sortLedger);
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
    const sortLedger = (a, b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;
      
      const numA = parseInt(String(a.trips?.trip_number || a.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.trips?.trip_number || b.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;

      if (a.type === "payment" && b.type !== "payment") return 1;
      if (a.type !== "payment" && b.type === "payment") return -1;
      return 0;
    };

    supabase.from('personnel_ledger').select('*, trips(trip_number)').eq('personnel_id', personnelId).then(({ data, error }) => {
      if (!error && data) {
        data.sort(sortLedger);
        callback(data);
      }
    });

    const channel = supabase
      .channel(`public:personnel_ledger:personnel_id=eq.${personnelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel_ledger', filter: `personnel_id=eq.${personnelId}` }, async () => {
        const { data } = await supabase.from('personnel_ledger').select('*, trips(trip_number)').eq('personnel_id', personnelId);
        if (data) {
          data.sort(sortLedger);
          callback(data);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  },

  subscribeAllPersonnelLedger: (callback) => {
    const sortLedger = (a, b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;
      
      const numA = parseInt(String(a.trips?.trip_number || a.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(String(b.trips?.trip_number || b.notes?.match(/Trip (\d+)/)?.[1] || "0").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numA - numB;

      if (a.type === "payment" && b.type !== "payment") return 1;
      if (a.type !== "payment" && b.type === "payment") return -1;
      return 0;
    };

    supabase.from('personnel_ledger').select('*, trips(trip_number)').then(({ data, error }) => {
      if (!error && data) {
        data.sort(sortLedger);
        callback(data);
      }
    });

    const channel = supabase
      .channel('public:personnel_ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel_ledger' }, async () => {
        const { data } = await supabase.from('personnel_ledger').select('*, trips(trip_number)');
        if (data) {
          data.sort(sortLedger);
          callback(data);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }
};
