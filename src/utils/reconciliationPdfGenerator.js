import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatKES, formatKESNumberOnly, formatDateKE } from "./paymentPdfGenerator.js";
import { getTripFinancials } from "./helpers.js";

/**
 * Perform complete financial reconciliation calculations
 *
 * Formula:
 *   Total Profit Generated (from trips)
 *   (-) Additional Approved Deductions (where included_in_trips === false)
 *   (=) Net Amount Payable to Boss
 *   (-) Actual Amount Sent to Boss (from payment records)
 *   (=) Outstanding Balance (Excess / Deficit)
 */
export const calculateReconciliation = ({
  trips = [],
  deductions = [],
  payments = [],
  dateRange = { start: "", end: "", label: "All Dates" },
  bossFilter = "all",
  allocationPercent = 100,
}) => {
  // 1. Filter trips in date range
  const filteredTrips = trips.filter((t) => {
    if (!t.date) return false;
    if (dateRange.start && t.date < dateRange.start) return false;
    if (dateRange.end && t.date > dateRange.end) return false;
    // Only count approved or completed trips in financial reconciliation
    if (t.approvalStatus && t.approvalStatus !== "approved") return false;
    return true;
  });

  const tripRevenue = filteredTrips.reduce((s, t) => s + getTripFinancials(t).revenue, 0);
  const tripOperatingExpenses = filteredTrips.reduce((s, t) => s + getTripFinancials(t).operatingExpenses, 0);
  const tripDeductions = filteredTrips.reduce((s, t) => s + getTripFinancials(t).totalDeductions, 0);
  // Total profit generated strictly from operations
  const totalProfitGenerated = filteredTrips.reduce((s, t) => s + getTripFinancials(t).netPayable, 0);

  // 2. Filter deductions in date range
  const filteredDeductions = deductions.filter((d) => {
    if (!d.date) return false;
    if (dateRange.start && d.date < dateRange.start) return false;
    if (dateRange.end && d.date > dateRange.end) return false;
    if (bossFilter !== "all" && d.allocated_boss && d.allocated_boss !== "All Bosses") {
      if (d.allocated_boss.toLowerCase() !== bossFilter.toLowerCase()) return false;
    }
    return true;
  });

  // Split deductions: Already in trips vs Additional deductions
  const deductionsAlreadyInTrips = filteredDeductions.filter((d) => Boolean(d.included_in_trips));
  const additionalDeductions = filteredDeductions.filter((d) => !d.included_in_trips);

  const totalDeductionsAll = filteredDeductions.reduce((s, d) => s + Number(d.amount || 0), 0);
  const sumDeductionsAlreadyInTrips = deductionsAlreadyInTrips.reduce((s, d) => s + Number(d.amount || 0), 0);
  // ONLY additional deductions are subtracted from generated profit!
  const sumAdditionalDeductions = additionalDeductions.reduce((s, d) => s + Number(d.amount || 0), 0);

  // 3. Net Amount Payable
  const grossPayable = Math.max(0, totalProfitGenerated - sumAdditionalDeductions);
  const percentFactor = Math.max(0, Math.min(100, Number(allocationPercent) || 100)) / 100;
  const netAmountPayable = grossPayable * percentFactor;

  // 4. Actual Payments Sent
  const filteredPayments = payments.filter((p) => {
    if (!p.date) return false;
    if (dateRange.start && p.date < dateRange.start) return false;
    if (dateRange.end && p.date > dateRange.end) return false;
    if (bossFilter !== "all" && (p.recipient_name || "").toLowerCase() !== bossFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const actualAmountSent = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  // 5. Outstanding Balance
  const outstandingBalance = netAmountPayable - actualAmountSent;

  let statusKey = "balanced";
  let statusLabel = "Fully Reconciled (Balanced)";
  let statusBadgeColor = "green";

  if (outstandingBalance > 1) {
    statusKey = "due";
    statusLabel = `Pending Remittance (${formatKES(outstandingBalance)} due to Boss)`;
    statusBadgeColor = "amber";
  } else if (outstandingBalance < -1) {
    statusKey = "overpaid";
    statusLabel = `Remittance Advance / Overpaid (${formatKES(Math.abs(outstandingBalance))} excess sent)`;
    statusBadgeColor = "blue";
  }

  return {
    dateRange,
    bossFilter,
    allocationPercent,
    // Component A: Profit
    tripCount: filteredTrips.length,
    tripRevenue,
    tripOperatingExpenses,
    tripDeductions,
    totalProfitGenerated,
    // Component B: Deductions
    allDeductions: filteredDeductions,
    totalDeductionsAll,
    deductionsAlreadyInTrips,
    sumDeductionsAlreadyInTrips,
    additionalDeductions,
    sumAdditionalDeductions,
    // Component C: Payable & Actual
    grossPayable,
    netAmountPayable,
    payments: filteredPayments,
    paymentCount: filteredPayments.length,
    actualAmountSent,
    // Final Audit Outcome
    outstandingBalance,
    statusKey,
    statusLabel,
    statusBadgeColor,
  };
};

/**
 * Generate branded Mount Kenya Financial Reconciliation Report (PDF)
 */
export const generateReconciliationPDF = (reconciliationData, options = {}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  let currentY = 16;

  const colors = {
    primary: [15, 23, 42],        // slate-900
    brandGreen: [5, 150, 105],     // emerald-600
    brandGreenDark: [4, 120, 87],  // emerald-700
    secondary: [100, 116, 139],    // slate-500
    lightBg: [248, 250, 252],      // slate-50
    headerBg: [15, 23, 42],       // slate-900
    border: [226, 232, 240],       // slate-200
    accentBg: [236, 253, 245],     // emerald-50
    textDark: [30, 41, 59],        // slate-800
    amber: [217, 119, 6],          // amber-600
    amberBg: [254, 243, 199],      // amber-100
    rose: [225, 29, 72],           // rose-600
  };

  const {
    dateRange = { start: "", end: "", label: "Selected Period" },
    bossFilter = "all",
  } = reconciliationData;

  const startDateStr = formatDateKE(dateRange.start);
  const endDateStr = formatDateKE(dateRange.end);
  const periodText = dateRange.start && dateRange.end
    ? `${startDateStr} to ${endDateStr}`
    : dateRange.label || "All Dates";

  // --- Top brand bar ---
  doc.setFillColor(...colors.brandGreen);
  doc.rect(0, 0, pageWidth, 4, "F");

  // --- REPORT HEADER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...colors.primary);
  doc.text("MOUNT KENYA WATER DISTRIBUTORS", marginX, currentY);

  currentY += 6;
  doc.setFontSize(12);
  doc.setTextColor(...colors.brandGreen);
  doc.text("FINANCIAL RECONCILIATION REPORT", marginX, currentY);

  currentY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.secondary);
  const bossText = bossFilter !== "all" ? ` | Target Boss: ${bossFilter}` : " | Target: Consolidated (All Bosses)";
  doc.text(`Reporting Period: ${periodText}${bossText}`, marginX, currentY);

  const genDate = new Date();
  const genDateStr = formatDateKE(genDate.toISOString().slice(0, 10));
  const genTimeStr = genDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  doc.text(`Generated: ${genDateStr} at ${genTimeStr}`, pageWidth - marginX, currentY, { align: "right" });

  currentY += 3;
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 5;

  // --- EXECUTIVE 5-PART KPI BANNER ---
  const kpiBoxWidth = (pageWidth - marginX * 2 - 8) / 3;
  const kpiBoxHeight = 16;

  // Card 1: Total Profit Generated
  doc.setFillColor(...colors.accentBg);
  doc.setDrawColor(...colors.brandGreen);
  doc.roundedRect(marginX, currentY, kpiBoxWidth, kpiBoxHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.brandGreenDark);
  doc.text("1. TOTAL PROFIT GENERATED", marginX + 3, currentY + 4.5);
  doc.setFontSize(10.5);
  doc.text(formatKES(reconciliationData.totalProfitGenerated), marginX + 3, currentY + 11.5);

  // Card 2: Additional Deductions
  const kpi2X = marginX + kpiBoxWidth + 4;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(248, 113, 113); // rose-400
  doc.roundedRect(kpi2X, currentY, kpiBoxWidth, kpiBoxHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.rose);
  doc.text("2. APPROVED DEDUCTIONS", kpi2X + 3, currentY + 4.5);
  doc.setFontSize(10.5);
  doc.text(`- ${formatKES(reconciliationData.sumAdditionalDeductions)}`, kpi2X + 3, currentY + 11.5);

  // Card 3: Net Payable to Boss
  const kpi3X = kpi2X + kpiBoxWidth + 4;
  doc.setFillColor(240, 249, 255); // sky-50
  doc.setDrawColor(56, 189, 248);  // sky-400
  doc.roundedRect(kpi3X, currentY, kpiBoxWidth, kpiBoxHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(3, 105, 161);
  doc.text("3. NET PAYABLE TO BOSS", kpi3X + 3, currentY + 4.5);
  doc.setFontSize(10.5);
  doc.text(formatKES(reconciliationData.netAmountPayable), kpi3X + 3, currentY + 11.5);

  currentY += kpiBoxHeight + 3;

  // Row 2 of Cards: Actual Sent & Outstanding Balance
  const kpiRow2Width = (pageWidth - marginX * 2 - 4) / 2;
  const kpiRow2Height = 15;

  // Card 4: Actual Sent
  doc.setFillColor(...colors.lightBg);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(marginX, currentY, kpiRow2Width, kpiRow2Height, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...colors.secondary);
  doc.text("4. ACTUAL CASH REMITTED TO BOSS", marginX + 3.5, currentY + 4.5);
  doc.setFontSize(10.5);
  doc.setTextColor(...colors.primary);
  doc.text(formatKES(reconciliationData.actualAmountSent), marginX + 3.5, currentY + 11);

  // Card 5: Outstanding Balance & Verdict
  const kpi5X = marginX + kpiRow2Width + 4;
  const isBalanced = Math.abs(reconciliationData.outstandingBalance) <= 1;
  const isDue = reconciliationData.outstandingBalance > 1;

  doc.setFillColor(isBalanced ? 236 : isDue ? 254 : 238, isBalanced ? 253 : isDue ? 243 : 242, isBalanced ? 245 : isDue ? 199 : 255);
  doc.setDrawColor(isBalanced ? 16 : isDue ? 217 : 99, isBalanced ? 185 : isDue ? 119 : 102, isBalanced ? 129 : isDue ? 6 : 241);
  doc.roundedRect(kpi5X, currentY, kpiRow2Width, kpiRow2Height, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(isBalanced ? 4 : isDue ? 180 : 67, isBalanced ? 120 : isDue ? 83 : 56, isBalanced ? 87 : isDue ? 9 : 202);
  doc.text(`5. OUTSTANDING BALANCE (${isBalanced ? "BALANCED" : isDue ? "DUE TO BOSS" : "ADVANCE/OVERPAID"})`, kpi5X + 3.5, currentY + 4.5);

  doc.setFontSize(11);
  doc.text(formatKES(Math.abs(reconciliationData.outstandingBalance)), kpi5X + 3.5, currentY + 11);

  currentY += kpiRow2Height + 6;

  // --- SECTION A: STEP-BY-STEP RECONCILIATION AUDIT SUMMARY TABLE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.textDark);
  doc.text("A. FINANCIAL RECONCILIATION EQUATION", marginX, currentY);
  currentY += 2;

  const formulaRows = [
    ["1", "Total Profit Generated from Operations", `${reconciliationData.tripCount} completed trips in period`, `+ ${formatKESNumberOnly(reconciliationData.totalProfitGenerated)}`],
    ["2", "Less: Additional Approved Deductions", `${reconciliationData.additionalDeductions.length} approved expenses not in trips`, `- ${formatKESNumberOnly(reconciliationData.sumAdditionalDeductions)}`],
    ["3", "Net Amount Payable to Boss", `${reconciliationData.allocationPercent}% entitlement allocation`, `= ${formatKESNumberOnly(reconciliationData.netAmountPayable)}`],
    ["4", "Less: Actual Amount Remitted to Boss", `${reconciliationData.paymentCount} transfers recorded in period`, `- ${formatKESNumberOnly(reconciliationData.actualAmountSent)}`],
    ["5", "Net Outstanding Balance (Closing Verdict)", reconciliationData.statusLabel, `= ${formatKESNumberOnly(reconciliationData.outstandingBalance)}`],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Step", "Financial Component", "Calculation Notes / Allocation", "Amount (KES)"]],
    body: formulaRows,
    theme: "grid",
    headStyles: {
      fillColor: colors.headerBg,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 2,
    },
    bodyStyles: {
      textColor: colors.textDark,
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 70, fontStyle: "bold" },
      2: { cellWidth: 70 },
      3: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        if (data.column.index === 3) {
          data.cell.styles.textColor = isBalanced ? [4, 120, 87] : isDue ? [180, 83, 9] : [67, 56, 202];
        }
      }
    },
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // --- SECTION B: DETAILED APPROVED DEDUCTIONS TABLE ---
  if (currentY + 20 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.textDark);
  doc.text(`B. APPROVED DEDUCTIONS & ADJUSTMENTS (${reconciliationData.allDeductions.length})`, marginX, currentY);
  currentY += 2;

  const deductionRows = reconciliationData.allDeductions.length === 0
    ? [["—", "No deductions recorded for this period", "—", "—", "—", "0"]]
    : reconciliationData.allDeductions.map((d, i) => [
        String(i + 1),
        formatDateKE(d.date),
        d.category || "General",
        d.description || "Deduction",
        d.reference_number || d.notes || "—",
        d.included_in_trips ? "YES (In Trips)" : "NO (Additional)",
        formatKESNumberOnly(d.amount),
      ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["No.", "Date", "Category", "Description", "Ref / Notes", "In Trips?", "Amount (KES)"]],
    body: deductionRows,
    showHead: "everyPage",
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 2,
    },
    bodyStyles: {
      textColor: colors.textDark,
      fontSize: 7,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 18 },
      2: { cellWidth: 32 },
      3: { cellWidth: 46 },
      4: { cellWidth: 34 },
      5: { cellWidth: 23, halign: "center" },
      6: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
    },
    foot: [
      [
        "",
        "",
        "",
        "Total Additional Deductions (Subtracted):",
        "",
        "",
        formatKES(reconciliationData.sumAdditionalDeductions),
      ],
    ],
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: colors.primary,
      fontStyle: "bold",
      fontSize: 7.5,
    },
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // --- SECTION C: ACTUAL REMITTANCES / PAYMENTS TO BOSS ---
  if (currentY + 20 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.textDark);
  doc.text(`C. ACTUAL TRANSFERS & REMITTANCES TO BOSS (${reconciliationData.payments.length})`, marginX, currentY);
  currentY += 2;

  const paymentRows = reconciliationData.payments.length === 0
    ? [["—", "No remittances recorded for this period", "—", "—", "—", "—", "0"]]
    : reconciliationData.payments.map((p, i) => [
        String(i + 1),
        formatDateKE(p.date),
        p.time || "—",
        p.recipient_name || "Boss",
        p.payment_method || "Cash",
        p.reference_number || "—",
        formatKESNumberOnly(p.amount),
      ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["No.", "Date", "Time", "Recipient", "Method", "Reference", "Amount (KES)"]],
    body: paymentRows,
    showHead: "everyPage",
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 2,
    },
    bodyStyles: {
      textColor: colors.textDark,
      fontSize: 7,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 35 },
      4: { cellWidth: 25 },
      5: { cellWidth: 35 },
      6: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
    },
    foot: [
      [
        "",
        "",
        "",
        "",
        "",
        "Total Remitted:",
        formatKES(reconciliationData.actualAmountSent),
      ],
    ],
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: colors.primary,
      fontStyle: "bold",
      fontSize: 7.5,
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // --- SECTION D: SIGN-OFF AUDIT BLOCK ---
  if (currentY + 28 > pageHeight) {
    doc.addPage();
    currentY = 16;
  }

  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 4;

  const colSignWidth = (pageWidth - marginX * 2) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.secondary);
  doc.text("PREPARED BY (ACCOUNTANT / ADMIN):", marginX, currentY);
  doc.text("CONFIRMED & RECEIVED BY (DIRECTOR / BOSS):", marginX + colSignWidth, currentY);

  currentY += 12;
  doc.setLineDash([1, 1], 0);
  doc.line(marginX, currentY, marginX + colSignWidth - 10, currentY);
  doc.line(marginX + colSignWidth, currentY, pageWidth - marginX, currentY);
  doc.setLineDash([], 0);

  currentY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("Signature & Date", marginX, currentY);
  doc.text("Signature & Date", marginX + colSignWidth, currentY);

  // --- FOOTERS ON EVERY PAGE ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.secondary);
    doc.text("Mount Kenya Water Distributors — Financial Reconciliation Report", marginX, pageHeight - 6.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 6.5, { align: "right" });
    doc.text("Confidential — For Internal Financial Accounting Only", pageWidth / 2, pageHeight - 6.5, { align: "center" });
  }

  // --- Generate Clean Filename & Save ---
  const fileStart = dateRange.start ? dateRange.start.replace(/-/g, "") : "start";
  const fileEnd = dateRange.end ? dateRange.end.replace(/-/g, "") : "end";
  const bossTag = bossFilter !== "all" ? `_${bossFilter.replace(/[^a-zA-Z0-9]/g, "")}` : "";
  const filename = `Mount_Kenya_Financial_Reconciliation_${fileStart}_to_${fileEnd}${bossTag}.pdf`;

  doc.save(filename);
  return filename;
};

/**
 * Export reconciliation data to CSV format
 */
export const exportReconciliationCSV = (reconciliationData, filename = "Financial_Reconciliation.csv") => {
  const rows = [
    ["MOUNT KENYA WATER DISTRIBUTORS - FINANCIAL RECONCILIATION"],
    [`Reporting Period:`, `${reconciliationData.dateRange?.label || "Period"}`],
    [`Target Boss / Beneficiary:`, `${reconciliationData.bossFilter || "Consolidated"}`],
    [`Generated Date:`, `${new Date().toISOString()}`],
    [],
    ["--- RECONCILIATION SUMMARY ---"],
    ["Component", "Amount (KES)", "Notes"],
    ["1. Total Profit Generated (Trips)", reconciliationData.totalProfitGenerated, `${reconciliationData.tripCount} completed trips`],
    ["2. Additional Approved Deductions", reconciliationData.sumAdditionalDeductions, `${reconciliationData.additionalDeductions.length} deductions not in trips`],
    ["3. Net Amount Payable to Boss", reconciliationData.netAmountPayable, `${reconciliationData.allocationPercent}% entitlement`],
    ["4. Actual Amount Sent to Boss", reconciliationData.actualAmountSent, `${reconciliationData.paymentCount} remittances`],
    ["5. Outstanding Balance", reconciliationData.outstandingBalance, reconciliationData.statusLabel],
    [],
    ["--- APPROVED DEDUCTIONS DETAILS ---"],
    ["Date", "Category", "Description", "Ref Number", "Included In Trips", "Amount (KES)"],
    ...reconciliationData.allDeductions.map((d) => [
      d.date,
      `"${(d.category || "").replace(/"/g, '""')}"`,
      `"${(d.description || "").replace(/"/g, '""')}"`,
      `"${(d.reference_number || "").replace(/"/g, '""')}"`,
      d.included_in_trips ? "YES" : "NO",
      d.amount,
    ]),
    [],
    ["--- ACTUAL REMITTANCES DETAILS ---"],
    ["Date", "Time", "Recipient", "Method", "Reference", "Description", "Amount (KES)"],
    ...reconciliationData.payments.map((p) => [
      p.date,
      p.time || "",
      `"${(p.recipient_name || "").replace(/"/g, '""')}"`,
      p.payment_method || "",
      `"${(p.reference_number || "").replace(/"/g, '""')}"`,
      `"${(p.description || "").replace(/"/g, '""')}"`,
      p.amount,
    ]),
  ];

  const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
