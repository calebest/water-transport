/**
 * Report Dispatcher for Bolas AI
 * Connects natural language report requests to existing application PDF generators:
 * - Trip Operations PDF Report (exportPDF)
 * - Financial Reconciliation PDF Statement (generateReconciliationPDF)
 * - Payment Records & Remittances Report (generatePaymentReportPDF)
 * - CSV Spreadsheet Export (exportCSV)
 */

import { exportPDF, exportCSV } from "../../utils/export";
import { generateReconciliationPDF, calculateReconciliation } from "../../utils/reconciliationPdfGenerator";
import { generatePaymentReportPDF } from "../../utils/paymentPdfGenerator";
import { today, getWeekRange, getMonthRange, filterByRange } from "../../utils/helpers";

/**
 * Detect if a user message is asking for a report
 */
export const detectReportIntent = (message = "") => {
  const lower = message.toLowerCase();
  const isReportRequest = lower.includes("report") || lower.includes("generate") || lower.includes("prepare") || lower.includes("download") || lower.includes("pdf");

  if (!isReportRequest) return null;

  // Detect time period
  let period = "today";
  let [start, end] = [today(), today()];

  if (lower.includes("month") || lower.includes("monthly")) {
    period = "month";
    [start, end] = getMonthRange();
  } else if (lower.includes("week") || lower.includes("weekly")) {
    period = "week";
    [start, end] = getWeekRange();
  } else if (lower.includes("yesterday")) {
    period = "yesterday";
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    [start, end] = [yStr, yStr];
  }

  // Detect report type
  let type = "trips";
  let title = "Operations Trip Report";

  if (lower.includes("reconcil") || lower.includes("reconciliation") || lower.includes("audit") || lower.includes("deduction")) {
    type = "reconciliation";
    title = `Financial Reconciliation Statement (${period.toUpperCase()})`;
  } else if (lower.includes("payment") || lower.includes("sent to boss") || lower.includes("remittance") || lower.includes("transactions")) {
    type = "payments";
    title = `Payment Records & Remittances Report (${period.toUpperCase()})`;
  } else if (lower.includes("profit") || lower.includes("revenue") || lower.includes("trip")) {
    type = "trips";
    title = `Water Deliveries & Profit Report (${period.toUpperCase()})`;
  }

  // Detect vehicle filter
  let vehicle = "all";
  if (lower.includes("kbz")) vehicle = "KBZ";
  if (lower.includes("kbl")) vehicle = "KBL";

  return {
    type,
    title,
    period,
    startDate: start,
    endDate: end,
    vehicleFilter: vehicle,
  };
};

/**
 * Execute report generation and trigger file download
 */
export const executeReportDownload = ({
  type = "trips",
  title = "Operations Report",
  startDate,
  endDate,
  vehicleFilter = "all",
  trips = [],
  paymentRecords = [],
  financialDeductions = [],
  vehicles = [],
}) => {
  const start = startDate || today();
  const end = endDate || today();

  try {
    if (type === "reconciliation") {
      const activeTrips = trips.filter(
        (t) => !t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit"
      );
      const reconData = calculateReconciliation({
        trips: activeTrips,
        deductions: financialDeductions,
        payments: paymentRecords,
        startDate: start,
        endDate: end,
        vehicleFilter,
        vehicles,
      });

      generateReconciliationPDF(reconData, {
        startDate: start,
        endDate: end,
        vehicleFilter,
        vehicles,
        companyName: "Mount Kenya Water Distributors",
      });
      return { ok: true, filename: `Reconciliation_${start}_to_${end}.pdf` };
    }

    if (type === "payments") {
      const filteredPayments = paymentRecords.filter((p) => {
        const pDate = p.date || p.created_at?.slice(0, 10);
        return pDate >= start && pDate <= end;
      });

      generatePaymentReportPDF(filteredPayments, {
        dateRange: { start, end, label: `${start} to ${end}` },
        recipient: "all",
      });
      return { ok: true, filename: `Payments_${start}_to_${end}.pdf` };
    }

    // Default: Trip Operations Report
    let filteredTrips = filterByRange(trips, start, end).filter(
      (t) => !t.approvalStatus || t.approvalStatus === "approved" || t.approvalStatus === "pending_edit"
    );
    if (vehicleFilter !== "all") {
      filteredTrips = filteredTrips.filter((t) => t.lorry === vehicleFilter);
    }

    if (filteredTrips.length === 0) {
      alert(`No trip records found for the range ${start} to ${end}.`);
      return { ok: false, error: "No trips found in this date range." };
    }

    const reportTitle = `${title} (${start} to ${end}${vehicleFilter !== "all" ? ` · ${vehicleFilter}` : ""})`;
    exportPDF(filteredTrips, reportTitle);
    return { ok: true, filename: `TripReport_${start}_to_${end}.pdf` };
  } catch (err) {
    console.error("Failed to generate PDF report:", err);
    alert("Could not generate PDF report: " + err.message);
    return { ok: false, error: err.message };
  }
};
