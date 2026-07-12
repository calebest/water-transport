import { supabase } from "./supabase";
import { calcDeductions, calcOperatingExpenses, calcProfit, OPERATING_EXPENSE_KEYS, splitCustomExpenses } from "../utils/helpers";

const calcFields = (data) => {
  const revenue = Number(data.revenue || 0);
  const operatingExpenses = calcOperatingExpenses(data.expenses);
  const operatingProfit = calcProfit(revenue, operatingExpenses);
  const totalDeductions = calcDeductions(data.deductions, data.expenses);
  const netPayable = operatingProfit - totalDeductions;

  let status = data.status || "Pending";
  let amountPaid;

  if (status === "Paid") {
    amountPaid = revenue;
  } else if (status === "Pending") {
    amountPaid = 0;
  } else if (status === "Partial") {
    amountPaid = data.amountPaid !== undefined && data.amountPaid !== "" ? Number(data.amountPaid) : 0;
    if (amountPaid >= revenue) status = "Paid";
    else if (amountPaid <= 0) status = "Pending";
  } else {
    amountPaid = data.amountPaid !== undefined && data.amountPaid !== "" ? Number(data.amountPaid) : revenue;
    status = amountPaid >= revenue ? "Paid" : (amountPaid > 0 ? "Partial" : "Pending");
  }

  return {
    totalExpenses: operatingExpenses,
    profit: operatingProfit,
    revenue,
    amountPaid,
    status,
    operatingExpenses,
    operatingProfit,
    totalDeductions,
    netPayable,
  };
};

const applyEarningsSnapshot = (data, earningsRate) => {
  const next = { ...data };
  if (next.status === "Paid") {
    if (!next.paidAt) next.paidAt = new Date().toISOString();
  }
  if (earningsRate !== undefined && earningsRate !== null) {
    next.earningsRate = earningsRate;
    next.earningsAmount = earningsRate;
  }
  return next;
};

const syncLedgers = async (tripId, data, isApproved) => {
  await supabase.from('broker_ledger').delete().eq('trip_id', tripId);
  await supabase.from('personnel_ledger').delete().eq('trip_id', tripId);

  if (!isApproved) return;

  const fields = calcFields(data);
  const date = data.date || new Date().toISOString().slice(0, 10);

  if (fields.revenue > 0) {
    await supabase.from('broker_ledger').insert({ trip_id: tripId, broker_id: data.brokerId || null, date, type: "revenue", amount: fields.revenue, notes: `Trip ${data.tripNumber || ""}` });
  }

  const exp = data.expenses || {};
  const defaultPayer = exp._defaultPayer || "Company";
  const payersObj = exp._payers || {};

  const processExpense = async (label, amount, payer) => {
    const amt = Number(amount || 0);
    if (amt <= 0) return;
    
    if (payer === 'Broker' && data.brokerId) {
      await supabase.from('broker_ledger').insert({ trip_id: tripId, broker_id: data.brokerId, date, type: "expense_paid", amount: amt, notes: `Trip ${data.tripNumber || ""} - ${label} Paid` });
    } else if (payer === 'Driver' && data.driverId) {
      await supabase.from('personnel_ledger').insert({ trip_id: tripId, personnel_id: data.driverId, date, type: "earning", amount: amt, notes: `Trip ${data.tripNumber || ""} - ${label} Reimbursed` });
    } else if (payer === 'Conductor' && data.conductorId) {
      await supabase.from('personnel_ledger').insert({ trip_id: tripId, personnel_id: data.conductorId, date, type: "earning", amount: amt, notes: `Trip ${data.tripNumber || ""} - ${label} Reimbursed` });
    }
  };

  for (const k of OPERATING_EXPENSE_KEYS) {
    const value = Number((k === "petrol" ? (exp.petrol ?? exp.fuel) : exp[k]) || 0);
    const payer = payersObj[k] || defaultPayer;
    const label = k.charAt(0).toUpperCase() + k.slice(1);
    
    if (value > 0) {
      // Direct mappings: Driver expense goes to Driver Earnings, Conductor to Conductor
      if (k === 'driver' && data.driverId) {
        await supabase.from('personnel_ledger').insert({ trip_id: tripId, personnel_id: data.driverId, date, type: "earning", amount: value, notes: `Trip ${data.tripNumber || ""} - Driver Earnings` });
      } else if (k === 'conductor' && data.conductorId) {
        await supabase.from('personnel_ledger').insert({ trip_id: tripId, personnel_id: data.conductorId, date, type: "earning", amount: value, notes: `Trip ${data.tripNumber || ""} - Conductor Earnings` });
      } else {
        // Normal reimbursement logic for everything else
        await processExpense(label, value, payer);
      }
    }
  }

  for (const c of splitCustomExpenses(exp.custom || []).operating) {
    const payer = c.paidBy || defaultPayer;
    await processExpense(c.label || "Custom", c.amount, payer);
  }
};

const toDB = (obj) => {
  const result = { ...obj };

  const mapping = {
    driverId: 'driver_id', conductorId: 'conductor_id', odometerStart: 'odometer_start',
    odometerEnd: 'odometer_end', approvalStatus: 'approval_status', submittedBy: 'created_by',
    paidAt: 'paid_at', earningsRate: 'earnings_rate', earningsAmount: 'earnings_amount',
    amountPaid: 'amount_paid', tripNumber: 'trip_number', brokerId: 'broker_id'
  };
  for (const [jsKey, dbKey] of Object.entries(mapping)) {
    if (jsKey in result) {
      result[dbKey] = result[jsKey];
      delete result[jsKey];
    }
  }

  // Remove any fields not in the trips table schema
  const stripKeys = [
    "totalExpenses", "profit", "operatingExpenses", "operatingProfit",
    "totalDeductions", "netPayable", "pendingEdits", "pending_edits"
  ];
  stripKeys.forEach(k => delete result[k]);

  return result;
};

const fromDB = (obj) => {
  const result = { ...obj };
  const mapping = {
    driver_id: 'driverId', conductor_id: 'conductorId', odometer_start: 'odometerStart',
    odometer_end: 'odometerEnd', approval_status: 'approvalStatus', created_by: 'submittedBy',
    paid_at: 'paidAt', earnings_rate: 'earningsRate', earnings_amount: 'earningsAmount',
    amount_paid: 'amountPaid', trip_number: 'tripNumber', pending_edits: 'pendingEdits',
    broker_id: 'brokerId'
  };
  for (const [dbKey, jsKey] of Object.entries(mapping)) {
    if (dbKey in result) {
      result[jsKey] = result[dbKey];
      delete result[dbKey];
    }
  }
  return result;
};

const fetchTrips = async () => {
  const { data, error } = await supabase.from('trips').select('*').order('date', { ascending: false });
  if (error) { console.error("trips fetch error:", error.message); return []; }
  return (data || []).map(fromDB);
};

export const tripService = {
  add: async (data, { userId = null, isAdmin = false, directApproval = false, earningsRate = null } = {}) => {
    const fields = calcFields(data);
    const isApproved = isAdmin || directApproval;
    
    let tripData = applyEarningsSnapshot({
      ...data,
      ...fields,
      brokerId: data.brokerId || null,
      driverId: data.driverId || null,
      conductorId: data.conductorId || null,
      odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
      odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
      approvalStatus: isApproved ? "approved" : "pending",
      submittedBy: userId,
    }, earningsRate);

    const { data: inserted, error } = await supabase
      .from('trips')
      .insert(toDB(tripData))
      .select()
      .single();

    if (error) throw error;
    
    await syncLedgers(inserted.id, tripData, isApproved);
    return { id: inserted.id };
  },

  update: async (id, data, { isAdmin = false, directApproval = false, isPending = false, earningsRate = null } = {}) => {
    if (isAdmin || directApproval) {
      const fields = calcFields(data);
      const tripData = applyEarningsSnapshot({
        ...data,
        ...fields,
        brokerId: data.brokerId || null,
        driverId: data.driverId || null,
        conductorId: data.conductorId || null,
        odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
        odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
        approvalStatus: "approved",
        pendingEdits: null,
      }, earningsRate);

      const { error } = await supabase.from('trips').update(toDB(tripData)).eq('id', id);
      if (error) throw error;
      await syncLedgers(id, tripData, true);
    } else if (isPending) {
      const fields = calcFields(data);
      const tripData = applyEarningsSnapshot({
        ...data,
        ...fields,
        brokerId: data.brokerId || null,
        driverId: data.driverId || null,
        conductorId: data.conductorId || null,
        odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
        odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
      }, earningsRate);

      const { error } = await supabase.from('trips').update({
        pending_edits: toDB(tripData),
        approval_status: "pending_edit"
      }).eq('id', id);
      if (error) throw error;
    }
  },

  approve: async (id, trip, { earningsRate = null } = {}) => {
    if (trip.pendingEdits) {
      const data = trip.pendingEdits;
      const fields = calcFields(data);
      const tripData = applyEarningsSnapshot({
        ...data,
        ...fields,
        brokerId: data.brokerId || null,
        driverId: data.driverId || null,
        conductorId: data.conductorId || null,
        odometerStart: data.odometerStart ? Number(data.odometerStart) : null,
        odometerEnd: data.odometerEnd ? Number(data.odometerEnd) : null,
        approvalStatus: "approved",
        pendingEdits: null,
      }, earningsRate ?? trip.earningsRate ?? trip.earningsAmount);

      const { error } = await supabase.from('trips').update(toDB(tripData)).eq('id', id);
      if (error) throw error;
      await syncLedgers(id, tripData, true);
    } else {
      const tripData = applyEarningsSnapshot({
        approvalStatus: "approved",
      }, earningsRate ?? trip.earningsRate ?? trip.earningsAmount);
      
      const { error } = await supabase.from('trips').update(toDB(tripData)).eq('id', id);
      if (error) throw error;
      await syncLedgers(id, { ...trip, ...tripData }, true);
    }
  },

  reject: async (id, trip) => {
    if (trip.approvalStatus === "pending_edit") {
      const { error } = await supabase.from('trips').update({
        approval_status: "approved",
        pending_edits: null,
      }).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (error) throw error;
      await syncLedgers(id, trip, false);
    }
  },

  delete: async (id) => {
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) throw error;
    await syncLedgers(id, {}, false);
  },

  markPaid: async (id, amountPaid, status) => {
    const isPaid = status === "Paid";
    const { error } = await supabase.from('trips').update({
      amount_paid: Number(amountPaid),
      status,
      earnings_rate: null,
      earnings_amount: 0,
      paid_at: isPaid ? new Date().toISOString() : null,
    }).eq('id', id);
    if (error) throw error;
  },

  fetchAll: async () => fetchTrips(),

  subscribe: (callback) => {
    const channelId = `trips-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    const refresh = async () => {
      const data = await fetchTrips();
      if (mounted) callback(data);
    };

    refresh();

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, refresh)
      .subscribe();

    const unsubscribe = () => {
      mounted = false;
      supabase.removeChannel(channel);
    };

    return unsubscribe;
  }
};
