export const fmt = (n) => `KES ${Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
export const fmtN = (n) => Number(n || 0).toLocaleString("en-KE");

export const today = () => new Date().toISOString().slice(0, 10);

export const getWeekRange = () => {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  const sun = new Date(d); sun.setDate(d.getDate() - day);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  return [sun.toISOString().slice(0, 10), sat.toISOString().slice(0, 10)];
};

export const getMonthRange = () => {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return [first, last];
};

export const filterByRange = (trips, start, end) =>
  trips.filter(t => t.date >= start && t.date <= end);

export const OPERATING_EXPENSE_KEYS = ["water", "diesel", "petrol", "police", "driver", "conductor", "repairs"];
export const LEGACY_EXPENSE_KEYS = [];
export const FIXED_EXPENSE_KEYS = OPERATING_EXPENSE_KEYS;

export const DEDUCTION_KEYS = ["loanRecovery", "advanceRecovery", "other"];

export const EXPENSE_LABELS = {
  diesel: "Diesel",
  water: "Water",
  driver: "Driver",
  conductor: "Conductor",
  police: "Police",
  repairs: "Repairs",
  petrol: "Petrol",
};

export const DEDUCTION_LABELS = {
  loanRecovery: "Loan Recovery",
  advanceRecovery: "Advance Recovery",
  other: "Other deductions",
};

const DEDUCTION_LABEL_PATTERNS = [
  /loan\s*recovery/i,
  /advance\s*recovery/i,
  /\bdeduction(s)?\b/i,
];

export const isDeductionLabel = (label = "") =>
  DEDUCTION_LABEL_PATTERNS.some(pattern => pattern.test(label));

export const splitCustomExpenses = (custom = []) => {
  const operating = [];
  const deductions = [];
  custom.forEach(item => {
    if (isDeductionLabel(item.label)) deductions.push(item);
    else operating.push(item);
  });
  return { operating, deductions };
};

export const calcOperatingExpenses = (exp = {}) => {
  const fixedTotal = OPERATING_EXPENSE_KEYS.reduce((s, k) => {
    const value = k === "petrol" ? (exp.petrol ?? exp.fuel) : exp[k];
    return s + Number(value || 0);
  }, 0);
  const customTotal = splitCustomExpenses(exp.custom || []).operating
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  return fixedTotal + customTotal;
};

export const calcDeductions = (deductions = {}, expenses = {}) => {
  const fixedTotal = DEDUCTION_KEYS.reduce((s, k) => s + Number(deductions[k] || 0), 0);
  const legacyCustomTotal = splitCustomExpenses(expenses.custom || []).deductions
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  return fixedTotal + legacyCustomTotal;
};

export const calcExpenses = calcOperatingExpenses;

export const calcProfit = (revenue, expenses) => Number(revenue || 0) - expenses;

export const getTripFinancials = (trip = {}) => {
  trip = trip || {};
  const revenue = Number(trip.revenue || 0);
  const operatingExpenses = trip.operatingExpenses !== undefined
    ? Number(trip.operatingExpenses || 0)
    : calcOperatingExpenses(trip.expenses);
  const totalDeductions = trip.totalDeductions !== undefined
    ? Number(trip.totalDeductions || 0)
    : calcDeductions(trip.deductions, trip.expenses);
  const operatingProfit = trip.operatingProfit !== undefined
    ? Number(trip.operatingProfit || 0)
    : (trip.profit !== undefined ? Number(trip.profit || 0) : calcProfit(revenue, operatingExpenses));
  const netPayable = trip.netPayable !== undefined
    ? Number(trip.netPayable || 0)
    : operatingProfit - totalDeductions;

  return {
    revenue,
    operatingExpenses,
    totalExpenses: operatingExpenses,
    operatingProfit,
    totalDeductions,
    deductions: totalDeductions,
    netPayable,
    netProfit: netPayable,
  };
};

export const isPaidTrip = (trip = {}) =>
  trip?.status === "Paid";

export const summarize = (trips) => {
  const paidTrips = trips.filter(isPaidTrip).length;
  return {
    revenue: trips.reduce((s, t) => s + getTripFinancials(t).revenue, 0),
    expenses: trips.reduce((s, t) => s + getTripFinancials(t).operatingExpenses, 0),
    operatingExpenses: trips.reduce((s, t) => s + getTripFinancials(t).operatingExpenses, 0),
    profit: trips.reduce((s, t) => s + getTripFinancials(t).operatingProfit, 0),
    operatingProfit: trips.reduce((s, t) => s + getTripFinancials(t).operatingProfit, 0),
    deductions: trips.reduce((s, t) => s + getTripFinancials(t).totalDeductions, 0),
    totalDeductions: trips.reduce((s, t) => s + getTripFinancials(t).totalDeductions, 0),
    netProfit: trips.reduce((s, t) => s + getTripFinancials(t).netPayable, 0),
    netPayable: trips.reduce((s, t) => s + getTripFinancials(t).netPayable, 0),
    count: trips.length,
    paidCount: paidTrips,
    pendingCount: trips.length - paidTrips,
  };
};

export const collectExpenseKeys = (trips) => {
  const customLabels = new Set();
  trips.forEach(t => {
    splitCustomExpenses(t.expenses?.custom || []).operating.forEach(c => {
      if (c.label) customLabels.add(c.label);
    });
  });
  return { fixed: OPERATING_EXPENSE_KEYS, custom: [...customLabels] };
};

export const collectDeductionKeys = (trips) => {
  const customLabels = new Set();
  trips.forEach(t => {
    splitCustomExpenses(t.expenses?.custom || []).deductions.forEach(c => {
      if (c.label) customLabels.add(c.label);
    });
  });
  return { fixed: DEDUCTION_KEYS, custom: [...customLabels] };
};

export const sumExpenseKey = (trips, key, isCustom = false) => {
  if (!isCustom) return trips.reduce((s, t) => {
    const value = key === "petrol" ? (t.expenses?.petrol ?? t.expenses?.fuel) : t.expenses?.[key];
    return s + Number(value || 0);
  }, 0);
  return trips.reduce((s, t) => {
    const match = splitCustomExpenses(t.expenses?.custom || []).operating.find(c => c.label === key);
    return s + Number(match?.amount || 0);
  }, 0);
};

export const sumDeductionKey = (trips, key, isCustom = false) => {
  if (!isCustom) return trips.reduce((s, t) => s + Number(t.deductions?.[key] || 0), 0);
  return trips.reduce((s, t) => {
    const match = splitCustomExpenses(t.expenses?.custom || []).deductions.find(c => c.label === key);
    return s + Number(match?.amount || 0);
  }, 0);
};
