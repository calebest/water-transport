import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getMonthRange, filterByRange, summarize, fmt, collectExpenseKeys, sumExpenseKey } from "../../utils/helpers";
import { StatCard } from "../../components/ui";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function OwnerFinancialsPage({ trips }) {
  const [monthStart, monthEnd] = getMonthRange();
  
  const d = new Date();
  const lastMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);

  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);
  const lastMonthTrips = useMemo(() => filterByRange(trips, lastMonthStart, lastMonthEnd), [trips, lastMonthStart, lastMonthEnd]);

  const monthSummary = useMemo(() => summarize(monthTrips), [monthTrips]);
  const lastMonthSummary = useMemo(() => summarize(lastMonthTrips), [lastMonthTrips]);

  const calcChange = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
  
  const revChange = calcChange(monthSummary.revenue, lastMonthSummary.revenue);
  const expChange = calcChange(monthSummary.expenses, lastMonthSummary.expenses);
  const profitChange = calcChange(monthSummary.profit, lastMonthSummary.profit);

  // Expense Breakdown
  const expenseData = useMemo(() => {
    const keys = collectExpenseKeys(monthTrips);
    const data = [];
    keys.fixed.forEach(k => {
      const val = sumExpenseKey(monthTrips, k, false);
      if (val > 0) data.push({ name: k.charAt(0).toUpperCase() + k.slice(1), value: val });
    });
    keys.custom.forEach(k => {
      const val = sumExpenseKey(monthTrips, k, true);
      if (val > 0) data.push({ name: k, value: val });
    });
    return data.sort((a, b) => b.value - a.value);
  }, [monthTrips]);

  const totalExpCalc = expenseData.reduce((s, e) => s + e.value, 0);

  // Payment Collection
  const collectionData = useMemo(() => {
    let collected = 0;
    let outstanding = 0;
    let paidCount = 0;
    let pendingCount = 0;

    monthTrips.forEach(t => {
      const paid = Number(t.amountPaid || 0);
      const rev = Number(t.revenue || 0);
      collected += paid;
      outstanding += (rev - paid);
      
      if (t.status === "Paid") paidCount++;
      else pendingCount++;
    });

    const rate = monthSummary.revenue > 0 ? (collected / monthSummary.revenue) * 100 : 0;
    
    return {
      collected, outstanding, paidCount, pendingCount, rate,
      ringData: [
        { name: "Collected", value: collected },
        { name: "Outstanding", value: outstanding }
      ]
    };
  }, [monthTrips, monthSummary]);

  // 6-Month Collection Trend
  const sixMonthData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date();
      dt.setMonth(dt.getMonth() - i);
      const start = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().slice(0, 10);
      
      const monTrips = filterByRange(trips, start, end);
      const rev = monTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
      const col = monTrips.reduce((s, t) => s + Number(t.amountPaid || 0), 0);
      
      data.push({
        month: dt.toLocaleString('default', { month: 'short' }),
        rate: rev > 0 ? (col / rev) * 100 : 0
      });
    }
    return data;
  }, [trips]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Financials</h2>
        <p className="text-sm text-slate-500">In-depth revenue, expenses, and collection analysis.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Gross Revenue" value={fmt(monthSummary.revenue)} 
          change={`${revChange >= 0 ? "+" : ""}${revChange.toFixed(1)}%`} positive={revChange >= 0} />
        <StatCard title="Total Expenses" value={fmt(monthSummary.expenses)} 
          change={`${expChange >= 0 ? "+" : ""}${expChange.toFixed(1)}%`} positive={expChange <= 0} />
        <StatCard title="Net Profit" value={fmt(monthSummary.profit)} 
          change={`${profitChange >= 0 ? "+" : ""}${profitChange.toFixed(1)}%`} positive={profitChange >= 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Expense Breakdown (This Month)</h3>
          
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex-1 w-full space-y-3">
              {expenseData.map((e, i) => (
                <div key={e.name}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                      <span className="text-slate-600">{e.name}</span>
                    </div>
                    <span className="text-slate-800">{fmt(e.value)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${(e.value / totalExpCalc) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}></div>
                  </div>
                </div>
              ))}
              {expenseData.length === 0 && <p className="text-sm text-slate-400">No expenses recorded yet.</p>}
            </div>
          </div>
        </div>

        {/* Payment Collection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Payment Collection</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-700 mb-1">Collected ({collectionData.paidCount} trips)</p>
              <p className="text-xl font-black text-emerald-600">{fmt(collectionData.collected)}</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
              <p className="text-xs font-bold text-rose-700 mb-1">Outstanding ({collectionData.pendingCount} trips)</p>
              <p className="text-xl font-black text-rose-600">{fmt(collectionData.outstanding)}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-32 h-32 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={collectionData.ringData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                    <Cell fill="#10b981" />
                    <Cell fill="#f43f5e" />
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-800">{collectionData.rate.toFixed(0)}%</span>
              </div>
            </div>

            <div className="flex-1 h-32">
              <p className="text-xs font-bold text-slate-500 mb-2 text-center">6-Month Collection Rate</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sixMonthData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{fontSize: 10}} tickMargin={5} stroke="#94a3b8" />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{fontSize: 10}} stroke="#94a3b8" domain={[0, 100]} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="rate" fill="#6366f1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
