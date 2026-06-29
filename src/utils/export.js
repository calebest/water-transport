import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { collectDeductionKeys, collectExpenseKeys, getSettlementStatus, getTripFinancials, splitCustomExpenses, summarize, sumDeductionKey, fmtN } from "./helpers";

export const exportCSV = (trips, filename) => {
  const { fixed, custom } = collectExpenseKeys(trips);
  const { fixed: deductionFixed, custom: deductionCustom } = collectDeductionKeys(trips);
  const allKeys = [...fixed, ...custom];
  const deductionKeys = [...deductionFixed, ...deductionCustom];
  const headers = ["Date", "Lorry", "Trip#", "Location", "Revenue", ...allKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), "Operating Expenses", "Operating Profit", ...deductionKeys.map(k => k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase())), "Total Deductions", "Net Payable", "Payment Status", "Settlement Status"];

  const rows = trips.map(t => {
    const financials = getTripFinancials(t);
    const fixedVals = fixed.map(k => t.expenses?.[k] || 0);
    const customVals = custom.map(label => {
      const match = (t.expenses?.custom || []).find(c => c.label === label);
      return match?.amount || 0;
    });
    const deductionVals = deductionKeys.map(k => sumDeductionKey([t], k, deductionCustom.includes(k)));
    return [t.date, t.lorry, t.tripNumber, t.location || "N/A", financials.revenue, ...fixedVals, ...customVals, financials.operatingExpenses, financials.operatingProfit, ...deductionVals, financials.totalDeductions, financials.netPayable, t.status, getSettlementStatus(t)];
  });

  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
};

export const exportPDF = (trips, title) => {
  const doc = new jsPDF();
  const sum = summarize(trips);
  const activeLorryPlates = [...new Set(trips.map(t => t.lorry))].sort();

  doc.setFontSize(20); doc.setTextColor(30, 130, 80);
  doc.text("Water Transport Manager", 14, 18);
  doc.setFontSize(13); doc.setTextColor(60, 60, 60);
  doc.text(title, 14, 26);
  doc.setFontSize(10); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

  doc.setFontSize(11); doc.setTextColor(30, 30, 30);
  doc.text(`Gross Revenue: KES ${fmtN(sum.revenue)}`, 14, 44);
  doc.text(`Operating Expenses: KES ${fmtN(sum.operatingExpenses)}`, 14, 51);
  doc.text(`Operating Profit: KES ${fmtN(sum.operatingProfit)}`, 14, 58);
  doc.text(`Total Deductions: KES ${fmtN(sum.deductions)}`, 14, 65);
  doc.text(`Net Profit: KES ${fmtN(sum.netProfit)}`, 14, 72);
  doc.text(`Trips: ${sum.count} | Paid: ${sum.paidCount} | Pending: ${sum.pendingCount}`, 14, 79);
  
  let yPos = 88;
  activeLorryPlates.forEach(plate => {
    const vehSum = summarize(trips.filter(t => t.lorry === plate));
    doc.text(`${plate} - Revenue: KES ${fmtN(vehSum.revenue)} | Net: KES ${fmtN(vehSum.netProfit)}`, 14, yPos);
    yPos += 7;
  });

  // Build dynamic columns for PDF table
  const { fixed, custom } = collectExpenseKeys(trips);
  const expCols = [...fixed, ...custom].map(k => k.charAt(0).toUpperCase() + k.slice(1));

  autoTable(doc, {
    startY: Math.max(90, yPos + 10),
    head: [["Date", "Lorry", "Trip#", "Location", "Revenue", ...expCols, "Op Exp", "Op Profit", "Deductions", "Net Payable", "Payment", "Settlement"]],
    body: trips.map(t => {
      const financials = getTripFinancials(t);
      const fixedVals = fixed.map(k => `KES ${fmtN(t.expenses?.[k] || 0)}`);
      const customVals = custom.map(label => {
        const match = (t.expenses?.custom || []).find(c => c.label === label);
        return `KES ${fmtN(match?.amount || 0)}`;
      });
      return [
        t.date, t.lorry, t.tripNumber,
        t.location || "N/A",
        `KES ${fmtN(financials.revenue)}`,
        ...fixedVals, ...customVals,
        `KES ${fmtN(financials.operatingExpenses)}`,
        `KES ${fmtN(financials.operatingProfit)}`,
        `KES ${fmtN(financials.totalDeductions)}`,
        `KES ${fmtN(financials.netPayable)}`,
        t.status,
        getSettlementStatus(t)
      ];
    }),
    headStyles: { fillColor: [30, 130, 80] },
    alternateRowStyles: { fillColor: [240, 255, 245] },
    styles: { fontSize: 8 }
  });

  doc.save(`${title.replace(/\s+/g, "-")}.pdf`);
};

export const exportVoucher = (trip) => {
  const doc = new jsPDF({ format: 'a5' }); // A5 size for receipts
  const financials = getTripFinancials(trip);
  const settlementStatus = getSettlementStatus(trip);
  
  doc.setFontSize(18); doc.setTextColor(30, 130, 80);
  doc.text("WATER TRANSPORT MANAGER", 10, 15);
  
  doc.setFontSize(14); doc.setTextColor(60, 60, 60);
  doc.text("TRIP VOUCHER", 10, 25);
  
  doc.setFontSize(10); doc.setTextColor(100, 100, 100);
  doc.text(`Receipt #: ${trip.id.substring(0, 8).toUpperCase()}`, 10, 32);
  doc.text(`Printed: ${new Date().toLocaleString()}`, 10, 37);

  doc.setLineWidth(0.5); doc.setDrawColor(200, 200, 200);
  doc.line(10, 42, 138, 42);

  // Trip Details
  doc.setFontSize(11); doc.setTextColor(30, 30, 30);
  doc.text("TRIP DETAILS", 10, 50);
  doc.setFontSize(10);
  doc.text(`Date: ${trip.date}`, 10, 58);
  doc.text(`Lorry: ${trip.lorry}`, 10, 64);
  doc.text(`Trip #: ${trip.tripNumber}`, 10, 70);
  doc.text(`Location: ${trip.location || 'N/A'}`, 10, 76);

  // Financials
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("FINANCIAL SUMMARY", 80, 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Revenue:`, 80, 58); doc.text(`KES ${fmtN(financials.revenue)}`, 138, 58, { align: "right" });
  
  const amountPaid = trip.amountPaid !== undefined ? trip.amountPaid : trip.revenue;
  doc.text(`Amount Paid:`, 80, 64); doc.text(`KES ${fmtN(amountPaid)}`, 138, 64, { align: "right" });
  
  const balance = trip.revenue - amountPaid;
  if (balance > 0) {
    doc.setTextColor(200, 50, 50);
    doc.text(`Balance Due:`, 80, 70); doc.text(`KES ${fmtN(balance)}`, 138, 70, { align: "right" });
    doc.setTextColor(30, 30, 30);
  }
  
  doc.text(`Payment:`, 80, 76); doc.text(`${trip.status}`, 138, 76, { align: "right" });
  doc.text(`Settlement:`, 80, 82); doc.text(`${settlementStatus}`, 138, 82, { align: "right" });

  doc.line(10, 88, 138, 88);

  // Expenses Breakdown
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("OPERATING EXPENSES", 10, 97);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  
  let y = 105;
  const fixedKeys = ['diesel', 'water', 'driver', 'conductor', 'police', 'repairs', 'fuel', 'petrol'];
  fixedKeys.forEach(k => {
    if (trip.expenses?.[k]) {
      doc.text(`${k.charAt(0).toUpperCase() + k.slice(1)}:`, 10, y);
      doc.text(`KES ${fmtN(trip.expenses[k])}`, 70, y, { align: "right" });
      y += 6;
    }
  });

  splitCustomExpenses(trip.expenses?.custom || []).operating.forEach(c => {
    if (c.amount) {
      doc.text(`${c.label || 'Custom'}:`, 10, y);
      doc.text(`KES ${fmtN(c.amount)}`, 70, y, { align: "right" });
      y += 6;
    }
  });

  doc.setLineWidth(0.2); doc.line(10, y, 70, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Operating Expenses:`, 10, y);
  doc.text(`KES ${fmtN(financials.operatingExpenses)}`, 70, y, { align: "right" });
  
  y += 6;
  doc.setTextColor(30, 130, 80);
  doc.text(`Operating Profit:`, 10, y);
  doc.text(`KES ${fmtN(financials.operatingProfit)}`, 70, y, { align: "right" });
  doc.setTextColor(30, 30, 30);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(`Deductions:`, 10, y);
  doc.text(`KES ${fmtN(financials.totalDeductions)}`, 70, y, { align: "right" });

  y += 6;
  doc.setTextColor(30, 130, 80);
  doc.text(`Net Payable:`, 10, y);
  doc.text(`KES ${fmtN(financials.netPayable)}`, 70, y, { align: "right" });
  
  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(`(Revenue - operating expenses - deductions)`, 10, y);

  // Footer
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(150, 150, 150);
  doc.text("Thank you for your business.", 74, 190, { align: "center" });

  doc.save(`Voucher-${trip.lorry}-${trip.tripNumber}-${trip.date}.pdf`);
};

export const generateReportText = (trips, filterVehicle, dateTitle) => {
  const sum = summarize(trips);
  const activeLorryPlates = [...new Set(trips.map(t => t.lorry))].sort();
  
  const getNumberEmoji = (num) => {
    if (num === 10) return "🔟";
    return num.toString().split('').map(d => ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"][parseInt(d, 10)]).join('');
  };

  const lines = [];
  lines.push(`📊 WATER TRANSPORT REPORT ${filterVehicle !== "All Vehicles" ? `(${filterVehicle})` : ""}`.trim());
  lines.push("");
  lines.push("📅 Reporting Period:");
  lines.push(dateTitle);
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("📈 SUMMARY");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push(`• Gross Revenue: KES ${fmtN(sum.revenue)}`);
  lines.push(`• Operating Expenses: KES ${fmtN(sum.operatingExpenses)}`);
  lines.push(`• Operating Profit: KES ${fmtN(sum.operatingProfit)}`);
  lines.push(`• Total Deductions: KES ${fmtN(sum.deductions)}`);
  lines.push(`• Net Profit: KES ${fmtN(sum.netProfit)}`);
  lines.push(`• Total Trips: ${sum.count}`);
  lines.push(`• Paid Trips: ${sum.paidCount}`);
  lines.push(`• Pending Trips: ${sum.pendingCount}`);
  lines.push("");
  
  if (activeLorryPlates.length > 0) {
    lines.push("Vehicle Performance:");
    activeLorryPlates.forEach(plate => {
      const vehSum = summarize(trips.filter(t => t.lorry === plate));
      lines.push(`• ${plate}: Revenue KES ${fmtN(vehSum.revenue)} | Net KES ${fmtN(vehSum.netProfit)}`);
    });
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("🚚 TRIP DETAILS");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  const { fixed } = collectExpenseKeys(trips);

  trips.forEach((t, i) => {
    const financials = getTripFinancials(t);
    lines.push(`${getNumberEmoji(i + 1)} ${t.date}`);
    lines.push(`Vehicle: ${t.lorry}`);
    lines.push(`Route: ${t.location || "N/A"}`);
    lines.push("");
    lines.push(`Revenue: KES ${fmtN(financials.revenue)}`);
    lines.push("");
    lines.push("Operating Expenses:");
    lines.push("");
    
    fixed.forEach(k => {
      if (t.expenses?.[k] !== undefined) {
        lines.push(`- ${k.charAt(0).toUpperCase() + k.slice(1)}: KES ${fmtN(t.expenses[k])}`);
      }
    });
    
    splitCustomExpenses(t.expenses?.custom || []).operating.forEach(c => {
      if (c.amount) {
        lines.push(`- ${c.label || 'Custom'}: KES ${fmtN(c.amount)}`);
      }
    });

    lines.push("");
    lines.push(`Operating Expenses: KES ${fmtN(financials.operatingExpenses)}`);
    lines.push(`Operating Profit: KES ${fmtN(financials.operatingProfit)}`);
    lines.push(`Deductions: KES ${fmtN(financials.totalDeductions)}`);
    lines.push(`Net Payable: KES ${fmtN(financials.netPayable)}`);
    lines.push(`Payment Status: ${t.status}`);
    lines.push(`Settlement Status: ${getSettlementStatus(t)}`);
    lines.push("");
    
    if (i < trips.length - 1) {
      lines.push("───────────────────");
      lines.push("");
    }
  });

  lines.push("━━━━━━━━━━━━━━━━━━━");
  const genDate = new Date();
  const dateStr = genDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  lines.push(`Report Generated: ${dateStr}`);

  return lines.join("\n");
};

export const handleShareText = async (trips, filterVehicle, dateTitle) => {
  const text = generateReportText(trips, filterVehicle, dateTitle);
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Water Transport Report',
        text: text
      });
    } catch (err) {
      console.log('Error sharing', err);
      // fallback to clipboard
      await navigator.clipboard.writeText(text);
      alert('Report copied to clipboard!');
    }
  } else {
    await navigator.clipboard.writeText(text);
    alert('Report copied to clipboard!');
  }
};
