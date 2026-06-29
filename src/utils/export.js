import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { collectDeductionKeys, collectExpenseKeys, getTripFinancials, splitCustomExpenses, summarize, sumDeductionKey, fmtN } from "./helpers";

const labelForKey = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

const sortedTrips = (trips) => [...trips].sort((a, b) => {
  const dateCompare = (b.date || "").localeCompare(a.date || "");
  if (dateCompare !== 0) return dateCompare;
  const aTrip = Number(a.tripNumber);
  const bTrip = Number(b.tripNumber);
  if (!Number.isNaN(aTrip) && !Number.isNaN(bTrip)) return aTrip - bTrip;
  return String(a.tripNumber || "").localeCompare(String(b.tripNumber || ""));
});

const getDeductionLines = (trip) => {
  const { fixed, custom } = collectDeductionKeys([trip]);
  const fixedLines = fixed
    .map(key => ({ label: labelForKey(key), amount: sumDeductionKey([trip], key, false) }))
    .filter(item => item.amount > 0);
  const customLines = custom
    .map(key => ({ label: key, amount: sumDeductionKey([trip], key, true) }))
    .filter(item => item.amount > 0);
  return [...fixedLines, ...customLines];
};

const getExpenseLines = (trip) => {
  const { fixed, custom } = collectExpenseKeys([trip]);
  const operating = [
    ...fixed.map(key => {
      const value = key === "petrol" ? (trip.expenses?.petrol ?? trip.expenses?.fuel) : trip.expenses?.[key];
      return { label: labelForKey(key), amount: Number(value || 0) };
    }),
    ...custom.map(label => {
      const match = splitCustomExpenses(trip.expenses?.custom || []).operating.find(c => c.label === label);
      return { label, amount: Number(match?.amount || 0) };
    }),
  ];
  return [...operating, ...getDeductionLines(trip)];
};

const reportTotals = (trips) => {
  const sum = summarize(trips);
  return {
    ...sum,
    totalExpenses: sum.operatingExpenses + sum.deductions,
    totalProfit: sum.netProfit,
  };
};

export const exportCSV = (trips, filename) => {
  const { fixed, custom } = collectExpenseKeys(trips);
  const { fixed: deductionFixed, custom: deductionCustom } = collectDeductionKeys(trips);
  const allKeys = [...fixed, ...custom];
  const deductionKeys = [...deductionFixed, ...deductionCustom];
  const headers = ["Date", "Lorry", "Trip#", "Location", "Revenue", ...allKeys.map(labelForKey), "Operating Expenses", "Operating Profit", ...deductionKeys.map(labelForKey), "Total Deductions", "Total Expenses", "Profit", "Payment Status"];

  const rows = trips.map(t => {
    const financials = getTripFinancials(t);
    const fixedVals = fixed.map(k => k === "petrol" ? (t.expenses?.petrol ?? t.expenses?.fuel ?? 0) : (t.expenses?.[k] || 0));
    const customVals = custom.map(label => {
      const match = (t.expenses?.custom || []).find(c => c.label === label);
      return match?.amount || 0;
    });
    const deductionVals = deductionKeys.map(k => sumDeductionKey([t], k, deductionCustom.includes(k)));
    return [t.date, t.lorry, t.tripNumber, t.location || "N/A", financials.revenue, ...fixedVals, ...customVals, financials.operatingExpenses, financials.operatingProfit, ...deductionVals, financials.totalDeductions, financials.operatingExpenses + financials.totalDeductions, financials.netPayable, t.status];
  });

  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
};

export const exportPDF = (trips, title) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const sum = reportTotals(trips);
  const activeLorryPlates = [...new Set(trips.map(t => t.lorry))].sort();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFontSize(18); doc.setTextColor(255, 255, 255);
  doc.text("Water Transport Report", 14, 13);
  doc.setFontSize(10);
  doc.text(title, 14, 21);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 21, { align: "right" });

  autoTable(doc, {
    startY: 36,
    head: [["Revenue", "Expenses", "Profit", "Trips", "Paid", "Pending"]],
    body: [[
      `KES ${fmtN(sum.revenue)}`,
      `KES ${fmtN(sum.totalExpenses)}`,
      `KES ${fmtN(sum.totalProfit)}`,
      sum.count,
      sum.paidCount,
      sum.pendingCount,
    ]],
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    bodyStyles: { fontStyle: "bold", textColor: [30, 41, 59] },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Vehicle", "Revenue", "Expenses", "Profit", "Trips"]],
    body: activeLorryPlates.map(plate => {
      const vehSum = reportTotals(trips.filter(t => t.lorry === plate));
      return [plate, `KES ${fmtN(vehSum.revenue)}`, `KES ${fmtN(vehSum.totalExpenses)}`, `KES ${fmtN(vehSum.totalProfit)}`, vehSum.count];
    }),
    theme: "striped",
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2.5 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["#", "Date", "Vehicle", "Trip", "Route", "Revenue", "Expense Breakdown", "Total Expenses", "Profit", "Status"]],
    body: sortedTrips(trips).map((t, index) => {
      const financials = getTripFinancials(t);
      const totalExpenses = financials.operatingExpenses + financials.totalDeductions;
      const expenseText = getExpenseLines(t).map(item => `${item.label}: ${fmtN(item.amount)}`).join("\n");
      return [
        index + 1,
        t.date, t.lorry, t.tripNumber,
        t.location || "N/A",
        `KES ${fmtN(financials.revenue)}`,
        expenseText,
        `KES ${fmtN(totalExpenses)}`,
        `KES ${fmtN(financials.netPayable)}`,
        t.status || "Pending",
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 24 },
      2: { cellWidth: 18 },
      3: { cellWidth: 15 },
      4: { cellWidth: 36 },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 70 },
      7: { cellWidth: 28, halign: "right" },
      8: { cellWidth: 24, halign: "right" },
      9: { cellWidth: 20 },
    },
    styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak", valign: "top" },
  });

  doc.save(`${title.replace(/\s+/g, "-")}.pdf`);
};

export const exportVoucher = (trip) => {
  const doc = new jsPDF({ format: 'a5' }); // A5 size for receipts
  const financials = getTripFinancials(trip);
  
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

  doc.line(10, 84, 138, 84);

  // Expenses Breakdown
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("EXPENSES BREAKDOWN", 10, 93);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  
  let y = 101;
  const fixedKeys = ['water', 'diesel', 'petrol', 'police', 'driver', 'conductor', 'repairs'];
  fixedKeys.forEach(k => {
    const amount = k === "petrol" ? (trip.expenses?.petrol ?? trip.expenses?.fuel) : trip.expenses?.[k];
    if (amount) {
      doc.text(`${k.charAt(0).toUpperCase() + k.slice(1)}:`, 10, y);
      doc.text(`KES ${fmtN(amount)}`, 70, y, { align: "right" });
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

  getDeductionLines(trip).forEach(item => {
    doc.text(`${item.label}:`, 10, y);
    doc.text(`KES ${fmtN(item.amount)}`, 70, y, { align: "right" });
    y += 6;
  });

  doc.setLineWidth(0.2); doc.line(10, y, 70, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  const totalExpenses = financials.operatingExpenses + financials.totalDeductions;
  doc.text(`Total Expenses:`, 10, y);
  doc.text(`KES ${fmtN(totalExpenses)}`, 70, y, { align: "right" });
  
  y += 6;
  doc.setTextColor(30, 130, 80);
  doc.text(`Profit:`, 10, y);
  doc.text(`KES ${fmtN(financials.netPayable)}`, 70, y, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(150, 150, 150);
  doc.text("Thank you for your business.", 74, 190, { align: "center" });

  doc.save(`Voucher-${trip.lorry}-${trip.tripNumber}-${trip.date}.pdf`);
};

export const generateReportText = (trips, filterVehicle, dateTitle) => {
  const orderedTrips = sortedTrips(trips);
  const sum = reportTotals(orderedTrips);
  const activeLorryPlates = [...new Set(orderedTrips.map(t => t.lorry))].sort();
  
  const getNumberEmoji = (num) => {
    if (num === 10) return "🔟";
    return num.toString().split('').map(d => ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"][parseInt(d, 10)]).join('');
  };

  const lines = [];
  lines.push(`📊 WATER TRANSPORT REPORT ${filterVehicle !== "All Vehicles" ? `(${filterVehicle})` : ""}`.trim());
  lines.push(`📅 Reporting Period: ${dateTitle}`);
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("📈 SUMMARY");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push(`• Total Revenue: KES ${fmtN(sum.revenue)}`);
  lines.push(`• Total Expenses: KES ${fmtN(sum.totalExpenses)}`);
  lines.push(`• Total Profit: KES ${fmtN(sum.totalProfit)}`);
  lines.push(`• Total Trips Completed: ${sum.count}`);
  lines.push("");
  
  if (activeLorryPlates.length > 0) {
    lines.push("Vehicle Performance:");
    activeLorryPlates.forEach(plate => {
      const vehSum = reportTotals(orderedTrips.filter(t => t.lorry === plate));
      lines.push(`• ${plate}: Revenue KES ${fmtN(vehSum.revenue)} | Profit KES ${fmtN(vehSum.totalProfit)}`);
    });
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("🚚 TRIP DETAILS");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  orderedTrips.forEach((t, i) => {
    const financials = getTripFinancials(t);
    const totalExpenses = financials.operatingExpenses + financials.totalDeductions;
    lines.push(`${getNumberEmoji(i + 1)} ${t.date} Vehicle: ${t.lorry} Route: ${t.location || "N/A"}`);
    lines.push(`Revenue: KES ${fmtN(financials.revenue)}`);
    lines.push("Expenses:");
    
    getExpenseLines(t).forEach(item => {
      lines.push(`${item.label}: KES ${fmtN(item.amount)}`);
    });

    lines.push(`Total Expenses: KES ${fmtN(totalExpenses)} Profit: KES ${fmtN(financials.netPayable)} Status: ${t.status || "Pending"}`);
    
    if (i < orderedTrips.length - 1) {
      lines.push("───────────────────");
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
