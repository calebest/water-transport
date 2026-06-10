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
  const kbzSum = summarize(trips.filter(t => t.lorry === "KBZ"));
  const kblSum = summarize(trips.filter(t => t.lorry === "KBL"));

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
  doc.text(`KBZ — Revenue: KES ${fmtN(kbzSum.revenue)} | Profit: KES ${fmtN(kbzSum.profit)}`, 14, 74);
  doc.text(`KBL — Revenue: KES ${fmtN(kblSum.revenue)} | Profit: KES ${fmtN(kblSum.profit)}`, 14, 81);

  // Build dynamic columns for PDF table
  const { fixed, custom } = collectExpenseKeys(trips);
  const expCols = [...fixed, ...custom].map(k => k.charAt(0).toUpperCase() + k.slice(1));

  autoTable(doc, {
    startY: 90,
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
  
  // Footer
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(150, 150, 150);
  doc.text("Thank you for your business.", 74, 190, { align: "center" });

  doc.save(`Voucher-${trip.lorry}-${trip.tripNumber}-${trip.date}.pdf`);
};
