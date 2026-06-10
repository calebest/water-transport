export const fmt = (n) => `KES ${Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
export const fmtN = (n) => Number(n || 0).toLocaleString("en-KE");

export const today = () => new Date().toISOString().slice(0, 10);

export const getWeekRange = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
};

export const getMonthRange = () => {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return [first, last];
};

export const filterByRange = (trips, start, end) =>
  trips.filter(t => t.date >= start && t.date <= end);

export const summarize = (trips) => ({
  revenue: trips.reduce((s, t) => s + Number(t.revenue || 0), 0),
  expenses: trips.reduce((s, t) => s + Number(t.totalExpenses || 0), 0),
  profit: trips.reduce((s, t) => s + Number(t.profit || 0), 0),
  count: trips.length,
});

export const FIXED_EXPENSE_KEYS = ["water", "diesel", "petrol", "police", "driver", "conductor"];

export const calcExpenses = (exp = {}) => {
  const fixedTotal = FIXED_EXPENSE_KEYS.reduce((s, k) => s + Number(exp[k] || 0), 0);
  const customTotal = (exp.custom || []).reduce((s, c) => s + Number(c.amount || 0), 0);
  return fixedTotal + customTotal;
};

export const calcProfit = (revenue, expenses) => Number(revenue || 0) - expenses;

export const collectExpenseKeys = (trips) => {
  const customLabels = new Set();
  trips.forEach(t => {
    (t.expenses?.custom || []).forEach(c => {
      if (c.label) customLabels.add(c.label);
    });
  });
  return { fixed: FIXED_EXPENSE_KEYS, custom: [...customLabels] };
};

export const sumExpenseKey = (trips, key, isCustom = false) => {
  if (!isCustom) return trips.reduce((s, t) => s + Number(t.expenses?.[key] || 0), 0);
  return trips.reduce((s, t) => {
    const match = (t.expenses?.custom || []).find(c => c.label === key);
    return s + Number(match?.amount || 0);
  }, 0);
};
