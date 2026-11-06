/**
 * Business Intelligence & Analytics Grounding Engine for Bolas AI
 * Evaluates real Supabase records (Trips, Vehicles, Payments, Deductions, Maintenance)
 * with 100% audited deterministic financial mathematics.
 */

import { getTripFinancials, summarize, isPaidTrip, fmt, today, getWeekRange, getMonthRange } from "../../utils/helpers";
import { calculateReconciliation } from "../../utils/reconciliationPdfGenerator";

/**
 * Format a Date object as YYYY-MM-DD
 */
const toISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Filter an array of items by date range
 */
export const filterRecordsByRange = (records = [], start, end) => {
  if (!start && !end) return records;
  return records.filter((r) => {
    const itemDate = r.date || r.created_at?.slice(0, 10);
    if (!itemDate) return false;
    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;
    return true;
  });
};

/**
 * Calculate complete, audited financial position for a specific date range
 */
export const computeFinancialAudit = ({
  trips = [],
  vehicles = [],
  paymentRecords = [],
  financialDeductions = [],
  maintenance = [],
  startDate,
  endDate,
  vehicleFilter = "all",
}) => {
  const start = startDate || "2000-01-01";
  const end = endDate || today();

  // 1. Filter approved / active trips
  const approvedTrips = trips.filter(
    (t) => !t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit"
  );

  const rangeTrips = filterRecordsByRange(approvedTrips, start, end).filter((t) =>
    vehicleFilter === "all" ? true : t.lorry === vehicleFilter
  );

  // 2. Trip Financials (Gross Revenue, Operating Expenses, Operating Profit, Net Payable)
  const tripSummary = summarize(rangeTrips);

  // 3. Additional Financial Deductions (excluding items already included in trips to avoid double-deductions)
  const rangeDeductions = filterRecordsByRange(financialDeductions, start, end).filter(
    (d) => !d.included_in_trips
  );
  const totalAdditionalDeductions = rangeDeductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  // Group deductions by category
  const deductionsByCategory = {};
  rangeDeductions.forEach((d) => {
    const cat = d.category || "Uncategorized";
    deductionsByCategory[cat] = (deductionsByCategory[cat] || 0) + Number(d.amount || 0);
  });

  // 4. Actual Money Sent to Boss/Director (from payment_records)
  const rangePayments = filterRecordsByRange(paymentRecords, start, end);
  const totalActualPayments = rangePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Payments grouped by recipient
  const paymentsByRecipient = {};
  rangePayments.forEach((p) => {
    const recipient = p.recipient_name || "Boss / Director";
    paymentsByRecipient[recipient] = (paymentsByRecipient[recipient] || 0) + Number(p.amount || 0);
  });

  // 5. Net Payable & Outstanding Balance Calculations
  // Net Payable to Boss = Operating Profit - Additional Deductions
  const netPayable = Math.max(0, tripSummary.operatingProfit - totalAdditionalDeductions);
  // Outstanding Balance = Net Payable - Actual Money Sent
  const outstandingBalance = netPayable - totalActualPayments;

  // 6. Maintenance Records in range
  const rangeMaintenance = filterRecordsByRange(maintenance, start, end).filter((m) =>
    vehicleFilter === "all" ? true : m.lorry === vehicleFilter
  );
  const totalMaintenanceCost = rangeMaintenance.reduce((sum, m) => sum + Number(m.cost || 0), 0);

  // 7. Per-Vehicle Breakdown (e.g. KBZ vs KBL)
  const vehicleStats = {};
  vehicles.forEach((v) => {
    const vTrips = rangeTrips.filter((t) => t.lorry === v.plate);
    const vMaint = rangeMaintenance.filter((m) => m.lorry === v.plate);
    const vSummary = summarize(vTrips);
    const vMaintCost = vMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0);

    // Fuel expenses for this vehicle
    const vFuelSpend = vTrips.reduce((sum, t) => {
      const fuelVal = t.expenses?.petrol ?? t.expenses?.fuel ?? t.expenses?.diesel ?? 0;
      return sum + Number(fuelVal || 0);
    }, 0);

    vehicleStats[v.plate] = {
      plate: v.plate,
      type: v.type,
      tripsCount: vSummary.count,
      paidTrips: vSummary.paidCount,
      revenue: vSummary.revenue,
      operatingExpenses: vSummary.operatingExpenses,
      operatingProfit: vSummary.operatingProfit,
      netProfit: vSummary.netProfit,
      fuelSpend: vFuelSpend,
      maintenanceCost: vMaintCost,
      marginPct: vSummary.revenue > 0 ? Math.round((vSummary.netProfit / vSummary.revenue) * 100) : 0,
    };
  });

  // 8. Trip Anomalies / High Expense Flags
  const anomalies = [];
  rangeTrips.forEach((t) => {
    const f = getTripFinancials(t);
    const expenseRatio = f.revenue > 0 ? f.operatingExpenses / f.revenue : 1;
    if (expenseRatio > 0.5 && f.revenue > 0) {
      anomalies.push({
        id: t.id,
        date: t.date,
        lorry: t.lorry,
        tripNumber: t.tripNumber,
        location: t.location,
        revenue: f.revenue,
        expenses: f.operatingExpenses,
        ratio: Math.round(expenseRatio * 100),
        reason: `High expenses (${Math.round(expenseRatio * 100)}% of revenue)`,
      });
    } else if (f.revenue <= 0) {
      anomalies.push({
        id: t.id,
        date: t.date,
        lorry: t.lorry,
        tripNumber: t.tripNumber,
        location: t.location,
        revenue: 0,
        expenses: f.operatingExpenses,
        reason: "Zero revenue recorded for trip",
      });
    }
  });

  return {
    dateRange: { start, end },
    tripSummary,
    tripsCount: rangeTrips.length,
    revenue: tripSummary.revenue,
    operatingExpenses: tripSummary.operatingExpenses,
    operatingProfit: tripSummary.operatingProfit,
    tripDeductions: tripSummary.totalDeductions,
    additionalDeductions: totalAdditionalDeductions,
    deductionsByCategory,
    netPayable,
    actualPaymentsSent: totalActualPayments,
    paymentsByRecipient,
    outstandingBalance,
    totalMaintenanceCost,
    vehicleStats,
    anomalies: anomalies.slice(0, 5),
    recentTrips: rangeTrips.slice(-5).reverse(),
  };
};

/**
 * Generate a comprehensive, audited Business Grounding Context string
 * that is injected into the Gemini prompt. This ensures 100% mathematical
 * fidelity and prevents any hallucinations.
 */
export const buildBusinessContext = ({
  trips = [],
  vehicles = [],
  paymentRecords = [],
  financialDeductions = [],
  maintenance = [],
  brokers = [],
  personnel = [],
}) => {
  const todayStr = today();
  const [weekStart, weekEnd] = getWeekRange();
  const [monthStart, monthEnd] = getMonthRange();

  // 1. Today's Audit
  const todayAudit = computeFinancialAudit({
    trips,
    vehicles,
    paymentRecords,
    financialDeductions,
    maintenance,
    startDate: todayStr,
    endDate: todayStr,
  });

  // 2. This Week's Audit
  const weekAudit = computeFinancialAudit({
    trips,
    vehicles,
    paymentRecords,
    financialDeductions,
    maintenance,
    startDate: weekStart,
    endDate: weekEnd,
  });

  // 3. This Month's Audit
  const monthAudit = computeFinancialAudit({
    trips,
    vehicles,
    paymentRecords,
    financialDeductions,
    maintenance,
    startDate: monthStart,
    endDate: monthEnd,
  });

  // 4. Pending Approval Trips count
  const pendingApprovalTrips = trips.filter(
    (t) => t.approvalStatus === "pending" || t.approvalStatus === "pending_edit"
  );

  // 5. Unpaid delivered trips
  const unpaidTrips = trips.filter((t) => !isPaidTrip(t) && t.approvalStatus !== "rejected");
  const unpaidRevenue = unpaidTrips.reduce((sum, t) => {
    const rev = Number(t.revenue || 0);
    const paid = Number(t.amountPaid || 0);
    return sum + (rev - paid);
  }, 0);

  // Compile vehicle plate list
  const vehiclePlates = vehicles.map((v) => v.plate).join(", ") || "KBZ, KBL";

  return `
=== VERIFIED BUSINESS AUDIT DATA (GROUND TRUTH FROM SUPABASE DATABASE) ===
Current Date: ${todayStr} (East Africa Time / Kenya)
Active Fleet Lorries: ${vehiclePlates}

--- TODAY'S OPERATIONS (${todayStr}) ---
- Completed Approved Trips: ${todayAudit.tripsCount}
- Gross Revenue: KES ${todayAudit.revenue.toLocaleString()}
- Trip Operating Expenses: KES ${todayAudit.operatingExpenses.toLocaleString()}
- Operating Profit: KES ${todayAudit.operatingProfit.toLocaleString()}
- Trip Deductions: KES ${todayAudit.tripDeductions.toLocaleString()}
- Net Profit Today: KES ${todayAudit.tripSummary.netProfit.toLocaleString()}
- Additional Deductions: KES ${todayAudit.additionalDeductions.toLocaleString()}
- Payments Sent to Boss Today: KES ${todayAudit.actualPaymentsSent.toLocaleString()}
- Outstanding Balance for Today: KES ${todayAudit.outstandingBalance.toLocaleString()}

--- THIS WEEK'S PERFORMANCE (${weekStart} to ${weekEnd}) ---
- Total Completed Trips: ${weekAudit.tripsCount}
- Weekly Gross Revenue: KES ${weekAudit.revenue.toLocaleString()}
- Weekly Operating Expenses: KES ${weekAudit.operatingExpenses.toLocaleString()}
- Weekly Operating Profit: KES ${weekAudit.operatingProfit.toLocaleString()}
- Weekly Net Profit: KES ${weekAudit.tripSummary.netProfit.toLocaleString()}
- Additional Deductions This Week: KES ${weekAudit.additionalDeductions.toLocaleString()}
- Payments Sent to Boss This Week: KES ${weekAudit.actualPaymentsSent.toLocaleString()}
- Net Outstanding Balance This Week: KES ${weekAudit.outstandingBalance.toLocaleString()}

--- THIS MONTH'S PERFORMANCE (${monthStart} to ${monthEnd}) ---
- Monthly Completed Trips: ${monthAudit.tripsCount}
- Monthly Gross Revenue: KES ${monthAudit.revenue.toLocaleString()}
- Monthly Operating Expenses: KES ${monthAudit.operatingExpenses.toLocaleString()}
- Monthly Operating Profit: KES ${monthAudit.operatingProfit.toLocaleString()}
- Monthly Net Profit: KES ${monthAudit.tripSummary.netProfit.toLocaleString()}
- Additional Deductions This Month: KES ${monthAudit.additionalDeductions.toLocaleString()}
  (Deduction Breakdown: ${Object.entries(monthAudit.deductionsByCategory).map(([k, v]) => `${k}: KES ${v.toLocaleString()}`).join(", ") || "None"})
- Net Payable to Boss This Month: KES ${monthAudit.netPayable.toLocaleString()}
- Actual Payments Sent to Boss This Month: KES ${monthAudit.actualPaymentsSent.toLocaleString()}
  (Payments Breakdown: ${Object.entries(monthAudit.paymentsByRecipient).map(([k, v]) => `${k}: KES ${v.toLocaleString()}`).join(", ") || "None"})
- Current Outstanding Balance to Boss: KES ${monthAudit.outstandingBalance.toLocaleString()}
- Total Maintenance & Repair Expenses This Month: KES ${monthAudit.totalMaintenanceCost.toLocaleString()}

--- LORRY COMPARISON (THIS MONTH'S RECORD) ---
${Object.values(monthAudit.vehicleStats).map((v) => `
* Lorry ${v.plate}:
  - Trips: ${v.tripsCount} (Paid: ${v.paidTrips})
  - Gross Revenue: KES ${v.revenue.toLocaleString()}
  - Operating Expenses: KES ${v.operatingExpenses.toLocaleString()} (Fuel spend: KES ${v.fuelSpend.toLocaleString()})
  - Operating Profit: KES ${v.operatingProfit.toLocaleString()}
  - Net Profit: KES ${v.netProfit.toLocaleString()} (${v.marginPct}% profit margin)
  - Maintenance Cost: KES ${v.maintenanceCost.toLocaleString()}
`).join("")}

--- PENDING / UNSETTLED OPERATIONS ---
- Trips Awaiting Approval: ${pendingApprovalTrips.length}
- Unpaid Delivered Trips: ${unpaidTrips.length} trips (KES ${unpaidRevenue.toLocaleString()} outstanding from customers)
- Recent Trip Anomaly Flags: ${todayAudit.anomalies.length > 0 ? todayAudit.anomalies.map(a => `${a.lorry} #${a.tripNumber} (${a.location}): ${a.reason}`).join("; ") : "None. All recent trips within healthy expense limits."}

=== RECONCILIATION EXPLANATION FORMULA ===
When asked "why actual payments are lower than total profit":
1. Operating Profit (Trips Revenue - Trip Operating Costs) is generated.
2. From this, Additional Deductions (vehicle repairs, permits, administrative costs not in trips) are deducted to arrive at Net Payable to Boss.
3. Actual payments are what was physically transferred to the Boss via M-Pesa or Bank (recorded in Payment Records).
4. Any difference between Net Payable and Actual Payments Sent is the "Outstanding Balance" currently held or pending transfer.
`.trim();
};
