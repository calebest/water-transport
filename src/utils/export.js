import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { summarize, collectExpenseKeys, fmtN } from "./helpers";

export const exportCSV = (trips, filename) => {
  const { fixed, custom } = collectExpenseKeys(trips);
  const allKeys = [...fixed, ...custom];
  const headers = ["Date", "Lorry", "Trip#", "Location", "Revenue", ...allKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), "Total Expenses", "Profit", "Status"];

  const rows = trips.map(t => {
    const fixedVals = fixed.map(k => t.expenses?.[k] || 0);
    const customVals = custom.map(label => {
      const match = (t.expenses?.custom || []).find(c => c.label === label);
      return match?.amount || 0;
    });
    return [t.date, t.lorry, t.tripNumber, t.location || "N/A", t.revenue, ...fixedVals, ...customVals, t.totalExpenses, t.profit, t.status];
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
  doc.text(`Total Revenue: KES ${fmtN(sum.revenue)}`, 14, 44);
  doc.text(`Total Expenses: KES ${fmtN(sum.expenses)}`, 14, 51);
  doc.text(`Total Profit: KES ${fmtN(sum.profit)}`, 14, 58);
  doc.text(`Total Trips: ${sum.count}`, 14, 65);
  
  let yPos = 74;
  activeLorryPlates.forEach(plate => {
    const vehSum = summarize(trips.filter(t => t.lorry === plate));
    doc.text(`${plate} — Revenue: KES ${fmtN(vehSum.revenue)} | Profit: KES ${fmtN(vehSum.profit)}`, 14, yPos);
    yPos += 7;
  });

  // Build dynamic columns for PDF table
  const { fixed, custom } = collectExpenseKeys(trips);
  const expCols = [...fixed, ...custom].map(k => k.charAt(0).toUpperCase() + k.slice(1));

  autoTable(doc, {
    startY: Math.max(90, yPos + 10),
    head: [["Date", "Lorry", "Trip#", "Location", "Revenue", ...expCols, "Total Exp", "Profit", "Status"]],
    body: trips.map(t => {
      const fixedVals = fixed.map(k => `KES ${fmtN(t.expenses?.[k] || 0)}`);
      const customVals = custom.map(label => {
        const match = (t.expenses?.custom || []).find(c => c.label === label);
        return `KES ${fmtN(match?.amount || 0)}`;
      });
      return [
        t.date, t.lorry, t.tripNumber,
        t.location || "N/A",
        `KES ${fmtN(t.revenue)}`,
        ...fixedVals, ...customVals,
        `KES ${fmtN(t.totalExpenses)}`,
        `KES ${fmtN(t.profit)}`,
        t.status
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
  doc.text(`Revenue:`, 80, 58); doc.text(`KES ${fmtN(trip.revenue)}`, 138, 58, { align: "right" });
  
  const amountPaid = trip.amountPaid !== undefined ? trip.amountPaid : trip.revenue;
  doc.text(`Amount Paid:`, 80, 64); doc.text(`KES ${fmtN(amountPaid)}`, 138, 64, { align: "right" });
  
  const balance = trip.revenue - amountPaid;
  if (balance > 0) {
    doc.setTextColor(200, 50, 50);
    doc.text(`Balance Due:`, 80, 70); doc.text(`KES ${fmtN(balance)}`, 138, 70, { align: "right" });
    doc.setTextColor(30, 30, 30);
  }
  
  doc.text(`Status:`, 80, 76); doc.text(`${trip.status}`, 138, 76, { align: "right" });

  doc.line(10, 84, 138, 84);

  // Expenses Breakdown
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("EXPENSES BREAKDOWN", 10, 93);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  
  let y = 101;
  const fixedKeys = ['water', 'diesel', 'petrol', 'police', 'driver', 'conductor'];
  fixedKeys.forEach(k => {
    if (trip.expenses?.[k]) {
      doc.text(`${k.charAt(0).toUpperCase() + k.slice(1)}:`, 10, y);
      doc.text(`KES ${fmtN(trip.expenses[k])}`, 70, y, { align: "right" });
      y += 6;
    }
  });

  (trip.expenses?.custom || []).forEach(c => {
    if (c.amount) {
      doc.text(`${c.label || 'Custom'}:`, 10, y);
      doc.text(`KES ${fmtN(c.amount)}`, 70, y, { align: "right" });
      y += 6;
    }
  });

  doc.setLineWidth(0.2); doc.line(10, y, 70, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Expenses:`, 10, y);
  doc.text(`KES ${fmtN(trip.totalExpenses)}`, 70, y, { align: "right" });
  
  y += 6;
  doc.setTextColor(30, 130, 80);
  doc.text(`Profit:`, 10, y);
  doc.text(`KES ${fmtN(trip.profit)}`, 70, y, { align: "right" });
  
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
  lines.push(`• Total Revenue: KES ${fmtN(sum.revenue)}`);
  lines.push(`• Total Expenses: KES ${fmtN(sum.expenses)}`);
  lines.push(`• Total Profit: KES ${fmtN(sum.profit)}`);
  lines.push(`• Total Trips Completed: ${sum.count}`);
  lines.push("");
  
  if (activeLorryPlates.length > 0) {
    lines.push("Vehicle Performance:");
    activeLorryPlates.forEach(plate => {
      const vehSum = summarize(trips.filter(t => t.lorry === plate));
      lines.push(`• ${plate}: Revenue KES ${fmtN(vehSum.revenue)} | Profit KES ${fmtN(vehSum.profit)}`);
    });
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("🚚 TRIP DETAILS");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  const { fixed, custom } = collectExpenseKeys(trips);

  trips.forEach((t, i) => {
    lines.push(`${getNumberEmoji(i + 1)} ${t.date}`);
    lines.push(`Vehicle: ${t.lorry}`);
    lines.push(`Route: ${t.location || "N/A"}`);
    lines.push("");
    lines.push(`Revenue: KES ${fmtN(t.revenue)}`);
    lines.push("");
    lines.push("Expenses:");
    lines.push("");
    
    fixed.forEach(k => {
      if (t.expenses?.[k] !== undefined) {
        lines.push(`- ${k.charAt(0).toUpperCase() + k.slice(1)}: KES ${fmtN(t.expenses[k])}`);
      }
    });
    
    (t.expenses?.custom || []).forEach(c => {
      if (c.amount) {
        lines.push(`- ${c.label || 'Custom'}: KES ${fmtN(c.amount)}`);
      }
    });

    lines.push("");
    lines.push(`Total Expenses: KES ${fmtN(t.totalExpenses)}`);
    lines.push(`Profit: KES ${fmtN(t.profit)}`);
    lines.push(`Status: ${t.status}`);
    lines.push("");
    
    if (i < trips.length - 1) {
      lines.push("───────────────────");
      lines.push("");
    }
  });

  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("💰 FINANCIAL OVERVIEW");
  lines.push("━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push(`Total Revenue: KES ${fmtN(sum.revenue)}`);
  lines.push(`Less Total Expenses: KES ${fmtN(sum.expenses)}`);
  lines.push("");
  lines.push(`Net Profit: KES ${fmtN(sum.profit)}`);
  lines.push("");
  const profitMargin = sum.revenue > 0 ? ((sum.profit / sum.revenue) * 100).toFixed(1) : 0;
  lines.push(`Profit Margin: ${profitMargin}%`);
  const avgProfit = sum.count > 0 ? Math.round(sum.profit / sum.count) : 0;
  lines.push(`Average Profit per Trip: KES ${fmtN(avgProfit)}`);
  lines.push("");
  
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
