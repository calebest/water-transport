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
