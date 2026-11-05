import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format currency number in Kenyan Shillings
 */
export const formatKES = (num) => {
  const n = Number(num);
  return isNaN(n) ? "KES 0" : `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
};

export const formatKESNumberOnly = (num) => {
  const n = Number(num);
  return isNaN(n) ? "0" : n.toLocaleString("en-KE", { minimumFractionDigits: 0 });
};

/**
 * Format date string (YYYY-MM-DD) to British/Kenyan standard DD/MM/YYYY
 */
export const formatDateKE = (dateStr) => {
  if (!dateStr) return "";
  try {
    const parts = String(dateStr).split("-");
    if (parts.length === 3) {
      return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
};

/**
 * Generate and download professional PDF report for Payment Records
 *
 * @param {Array} records - Array of payment records to include
 * @param {Object} options - Options including dateRange { start, end, label }
 */
export const generatePaymentReportPDF = (records = [], options = {}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  let currentY = 16;

  // --- Corporate Theme Colors ---
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
  };

  const {
    dateRange = { start: "", end: "", label: "Selected Period" },
    recipient = "all",
  } = options;
  const isSingleRecipient = recipient && recipient !== "all";
  const startDateStr = formatDateKE(dateRange.start);
  const endDateStr = formatDateKE(dateRange.end);
  const periodText = dateRange.start && dateRange.end
    ? `${startDateStr} to ${endDateStr}`
    : dateRange.label || "All Dates";

  // Financial aggregates
  const totalAmount = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalCount = records.length;
  const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

  // Recipient breakdown
  const recipientMap = {};
  records.forEach((r) => {
    const name = r.recipient_name || "Unknown";
    if (!recipientMap[name]) {
      recipientMap[name] = { count: 0, amount: 0 };
    }
    recipientMap[name].count += 1;
    recipientMap[name].amount += Number(r.amount || 0);
  });
  const recipientList = Object.entries(recipientMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // --- 1. REPORT HEADER ---
  // Top brand bar
  doc.setFillColor(...colors.brandGreen);
  doc.rect(0, 0, pageWidth, 4, "F");

  // Company Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...colors.primary);
  doc.text("MOUNT KENYA WATER DISTRIBUTORS", marginX, currentY);

  // Document Title
  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...colors.brandGreenDark);
  doc.text(
    isSingleRecipient
      ? `PAYMENT STATEMENT — ${recipient.toUpperCase()}`
      : "PAYMENT TRANSACTION REPORT",
    marginX,
    currentY
  );

  // Metadata block
  currentY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.secondary);

  const genDateStr = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }) + " EAT";

  doc.text(`Reporting Period: `, marginX, currentY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.primary);
  doc.text(`${periodText} (${dateRange.label || "Custom"})`, marginX + 28, currentY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.secondary);
  doc.text(`Generated: ${genDateStr}`, pageWidth - marginX, currentY, { align: "right" });

  currentY += 5;
  if (isSingleRecipient) {
    doc.text(`Beneficiary / Boss: `, marginX, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.primary);
    doc.text(recipient, marginX + 30, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text(`Total Sent: ${formatKES(totalAmount)} across ${totalCount} payments`, pageWidth - marginX, currentY, { align: "right" });
  } else {
    doc.text(`Total Transactions: ${totalCount}   |   Currency: Kenyan Shillings (KES)`, marginX, currentY);
  }

  currentY += 7;

  // --- 2. EXECUTIVE HIGHLIGHT CARDS ---
  const cardWidth = (pageWidth - marginX * 2 - 8) / 3;
  const cardHeight = 16;

  // Card 1: Total Amount Paid
  doc.setFillColor(...colors.accentBg);
  doc.setDrawColor(...colors.brandGreen);
  doc.roundedRect(marginX, currentY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.brandGreenDark);
  doc.text(isSingleRecipient ? `TOTAL SENT TO ${recipient.toUpperCase()}` : "TOTAL AMOUNT PAID", marginX + 4, currentY + 5);
  doc.setFontSize(11);
  doc.setTextColor(...colors.brandGreenDark);
  doc.text(formatKES(totalAmount), marginX + 4, currentY + 12);

  // Card 2: Total Transactions
  const card2X = marginX + cardWidth + 4;
  doc.setFillColor(...colors.lightBg);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.secondary);
  doc.text("TOTAL TRANSACTIONS", card2X + 4, currentY + 5);
  doc.setFontSize(11);
  doc.setTextColor(...colors.primary);
  doc.text(`${totalCount} payments`, card2X + 4, currentY + 12);

  // Card 3: Unique Recipients or Average
  const card3X = card2X + cardWidth + 4;
  doc.setFillColor(...colors.lightBg);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.secondary);
  doc.text(isSingleRecipient ? "AVERAGE PER PAYMENT" : "RECIPIENTS COUNT", card3X + 4, currentY + 5);
  doc.setFontSize(11);
  doc.setTextColor(...colors.primary);
  doc.text(
    isSingleRecipient ? formatKES(avgAmount) : `${recipientList.length} individuals`,
    card3X + 4,
    currentY + 12
  );

  currentY += cardHeight + 8;

  // --- 3. PAYMENT TRANSACTION TABLE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...colors.primary);
  doc.text("Payment Transactions", marginX, currentY);
  currentY += 4;

  const tableRows = records.map((r, index) => {
    const formattedDate = formatDateKE(r.date);
    const timeStr = r.time || "—";
    const recipient = r.recipient_name || "—";
    const desc = r.description ? r.description : "Payment";
    const methodRef = r.reference_number
      ? `${r.payment_method || "Cash"} (${r.reference_number})`
      : r.payment_method || "Cash";
    const amountStr = formatKESNumberOnly(r.amount);

    return [
      String(index + 1),
      formattedDate,
      timeStr,
      recipient,
      desc,
      methodRef,
      amountStr,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["No.", "Date", "Time", "Recipient", "Description", "Method / Ref", "Amount (KES)"]],
    body: tableRows,
    theme: "striped",
    showHead: "everyPage",
    margin: { left: marginX, right: marginX, bottom: 20 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.8,
      lineColor: colors.border,
      lineWidth: 0.1,
      textColor: colors.textDark,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: colors.headerBg,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: colors.lightBg,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 19 },
      3: { cellWidth: 32, fontStyle: "bold" },
      4: { cellWidth: "auto" },
      5: { cellWidth: 34 },
      6: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: colors.brandGreenDark },
    },
    foot: [
      [
        { content: "Total", colSpan: 6, styles: { halign: "right", fontStyle: "bold", fontSize: 9 } },
        { content: formatKESNumberOnly(totalAmount), styles: { halign: "right", fontStyle: "bold", fontSize: 9, textColor: colors.brandGreenDark } },
      ],
    ],
    footStyles: {
      fillColor: colors.accentBg,
      textColor: colors.primary,
      lineWidth: 0.2,
      lineColor: colors.brandGreen,
    },
  });

  currentY = doc.lastAutoTable.finalY + 10;

  // --- 4. RECIPIENT BREAKDOWN SUMMARY ---
  if (recipientList.length > 0) {
    // If not enough vertical space, start a new page
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...colors.primary);
    doc.text("Financial Breakdown per Recipient", marginX, currentY);
    currentY += 4;

    const breakdownRows = recipientList.map((item, idx) => {
      const percentage = totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : "0";
      return [
        String(idx + 1),
        item.name,
        String(item.count),
        formatKES(item.amount),
        `${percentage}%`,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [["#", "Recipient Name", "Transactions", "Total Paid (KES)", "% of Total"]],
      body: breakdownRows,
      theme: "grid",
      margin: { left: marginX, right: marginX, bottom: 20 },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: colors.border,
        lineWidth: 0.1,
        textColor: colors.textDark,
      },
      headStyles: {
        fillColor: colors.brandGreenDark,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: "auto", fontStyle: "bold" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 38, halign: "right", fontStyle: "bold", textColor: colors.brandGreenDark },
        4: { cellWidth: 26, halign: "right" },
      },
    });

    currentY = doc.lastAutoTable.finalY + 10;
  }

  // --- 5. CLOSING STATEMENT ON LAST PAGE ---
  if (currentY > pageHeight - 30) {
    doc.addPage();
    currentY = 20;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.secondary);
  doc.text(
    "— End of Payment Report — Mount Kenya Water Distributors Management System —",
    pageWidth / 2,
    currentY,
    { align: "center" }
  );

  // --- 6. PAGE NUMBERS & GLOBAL FOOTERS ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle bottom dividing line
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.secondary);

    // Left footer
    doc.text("Mount Kenya Water Distributors", marginX, pageHeight - 7);

    // Center footer: generation timestamp
    doc.text(`Generated: ${genDateStr}`, pageWidth / 2, pageHeight - 7, { align: "center" });

    // Right footer: page number
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: "right" });
  }

  // --- 7. SAVE / DOWNLOAD PDF ---
  const safeStart = (dateRange.start || "all").replace(/[^a-zA-Z0-9]/g, "-");
  const safeEnd = (dateRange.end || "all").replace(/[^a-zA-Z0-9]/g, "-");
  const safeRecipientPart = isSingleRecipient
    ? `${recipient.replace(/[^a-zA-Z0-9]/g, "_")}_`
    : "";
  const filename = `Mount_Kenya_Payment_Report_${safeRecipientPart}${safeStart}_to_${safeEnd}.pdf`;

  doc.save(filename);
  return filename;
};

/**
 * Export payment records to CSV file
 */
export const exportPaymentRecordsCSV = (records = [], filename = "payment_records.csv") => {
  if (typeof window === "undefined" || !records?.length) return;
  const headers = ["No.", "Date", "Time", "Recipient", "Category", "Amount (KES)", "Payment Method", "Reference Number", "Description"];
  const rows = records.map((r, idx) => [
    idx + 1,
    r.date,
    r.time || "",
    `"${(r.recipient_name || "").replace(/"/g, '""')}"`,
    `"${(r.recipient_category || "Boss / Director").replace(/"/g, '""')}"`,
    r.amount,
    `"${(r.payment_method || "Cash").replace(/"/g, '""')}"`,
    `"${(r.reference_number || "").replace(/"/g, '""')}"`,
    `"${(r.description || "").replace(/"/g, '""')}"`,
  ]);
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

