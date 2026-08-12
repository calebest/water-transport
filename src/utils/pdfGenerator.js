import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (num) => {
  const n = Number(num);
  return isNaN(n) ? "KES 0" : `KES ${n.toLocaleString("en-KE")}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

export const generateBrokerStatement = (broker, vehicle, dateRange, reportData, options) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  const {
    openingBalance, totalRevenue, totalExpenses, totalRemitted, closingBalance,
    groupedLedger, dateGroups
  } = reportData;

  const netAmount = totalRevenue - totalExpenses;
  const isBalanced = openingBalance + netAmount - totalRemitted === closingBalance;
  
  // Calculate stats
  let totalTrips = 0;
  let totalTransactions = 0;
  dateGroups.forEach(g => {
    totalTrips += Object.keys(g.trips).filter(k => k !== "__standalone__").length;
    Object.values(g.trips).forEach(t => {
      totalTransactions += t.revenue_entries.length + t.expense_entries.length;
    });
    totalTransactions += g.payments.length;
  });

  // --- Theme Colors ---
  const colors = {
    primary: [15, 23, 42],      // slate-900
    secondary: [100, 116, 139], // slate-500
    revenue: [5, 150, 105],     // emerald-600
    expense: [225, 29, 72],     // rose-600
    expenseSoft: [245, 158, 11], // amber-500
    lightBg: [248, 250, 252],   // slate-50
    border: [226, 232, 240]     // slate-200
  };

  // --- Header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...colors.primary);
  doc.text("MOUNT KENYA WATER DISTRIBUTORS", 14, currentY);
  
  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colors.primary);
  doc.text("BROKER TRANSACTION STATEMENT", 14, currentY);
  
  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.secondary);
  const headerStr1 = `Broker: ${broker?.name || "N/A"}    Vehicle: ${vehicle === "all" ? "All Vehicles" : vehicle}    Currency: KES`;
  const headerStr2 = `Report period: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}    Generated: ${new Date().toLocaleString("en-GB", { dateStyle: 'short', timeStyle: 'short' }) + " EAT"}`;
  doc.text(headerStr1, 14, currentY);
  currentY += 4;
  doc.text(headerStr2, 14, currentY);

  currentY += 6;

  // --- Financial Summary Grid ---
  if (currentY > 250) { doc.addPage(); currentY = 15; }

  const summaryData = [
    ["Opening Balance", "Total Revenue", "Total Expenses", "Net Amount"],
    [fmt(openingBalance), fmt(totalRevenue), fmt(totalExpenses), fmt(netAmount)],
    ["Total Remitted", "Outstanding", "Total Trips", "Transactions"],
    [fmt(totalRemitted), fmt(closingBalance), totalTrips.toString(), totalTransactions.toString()]
  ];

  autoTable(doc, {
    startY: currentY,
    body: summaryData,
    theme: 'grid',
    styles: { cellPadding: 3, lineColor: colors.border, lineWidth: 0.1 },
    didParseCell: function(data) {
      if (data.row.index === 0 || data.row.index === 2) {
        data.cell.styles.fillColor = colors.lightBg;
        data.cell.styles.textColor = colors.primary;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8;
      } else {
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.fontSize = 10;
        data.cell.styles.fontStyle = 'bold';
        
        // Color the values based on column/row
        const text = data.cell.text[0];
        if (data.row.index === 1) {
          // Row 1 values: all green except expenses? Actually in screenshot all row 1 values are green.
          data.cell.styles.textColor = colors.revenue;
        } else if (data.row.index === 3) {
          // Total remitted, outstanding, trips, transactions
          if (data.column.index === 0) data.cell.styles.textColor = colors.revenue; // Remitted
          else if (data.column.index === 1) data.cell.styles.textColor = colors.expense; // Outstanding
          else data.cell.styles.textColor = colors.primary; // numbers
        }
      }
    }
  });

  currentY = doc.lastAutoTable.finalY + 10;

  // --- Transaction History by Date ---
  if (options.includeTripDetails && dateGroups.length > 0) {
    currentY += 5;

    dateGroups.forEach(dg => {
      // Date Subheader
      if (currentY > 260) { doc.addPage(); currentY = 15; }
      
      const dayNet = dg.totalRevenue - dg.totalExpenses;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colors.primary);
      doc.text(formatDate(dg.date), 14, currentY);
      
      // Net Amount (Green)
      doc.setTextColor(...(dayNet >= 0 ? colors.revenue : colors.expense));
      doc.text(fmt(dayNet), 38, currentY);
      
      currentY += 4.5;
      
      // Opening... Rev... Exp line
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      
      doc.setTextColor(...colors.secondary);
      doc.text(`Opening ${fmt(dg.openingBalance)}`, 14, currentY);
      
      const revText = `+${fmt(dg.totalRevenue)}`;
      doc.setTextColor(...colors.revenue);
      doc.text(revText, 45, currentY);
      
      const expText = `-${fmt(dg.totalExpenses)} exp`;
      doc.setTextColor(...colors.expenseSoft);
      doc.text(expText, 68, currentY);
      
      currentY += 7;

      // Trips in this date
      dg.trips.forEach(trip => {
        if (trip.trip_id === "__standalone__" && trip.revenue_entries.length === 0 && trip.expense_entries.length === 0) return;
        
        if (currentY > 270) { doc.addPage(); currentY = 15; }

        const isStandalone = trip.trip_id === "__standalone__";
        const title = isStandalone ? "Direct Transactions (No Trip)" : `Trip ${trip.trip_number || ""} — ${trip.location || ""}`;
        const tripNet = trip.totalRevenue - trip.totalExpenses;

        // Draw left green line
        doc.setDrawColor(...colors.revenue);
        doc.setLineWidth(0.8);
        doc.line(14, currentY - 3, 14, currentY + 3);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...colors.primary);
        doc.text(title, 16, currentY);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...colors.primary);
        doc.text(fmt(tripNet), pageWidth - 14, currentY, { align: 'right' });
        
        currentY += 3;

        if (options.includeIndividualExpenses) {
          const tripTableData = [];
          
          trip.revenue_entries.forEach(r => {
            tripTableData.push(["Revenue", r.notes || "Trip Revenue", `+${fmt(r.amount)}`]);
          });
          trip.expense_entries.forEach(e => {
            tripTableData.push(["Expense", e.notes || "Expense", `-${fmt(e.amount)}`]);
          });

          if (tripTableData.length > 0) {
            autoTable(doc, {
              startY: currentY,
              head: [["Type", "Description", "Amount"]],
              body: tripTableData,
              theme: 'grid',
              styles: { fontSize: 8, cellPadding: {top: 2, bottom: 2, left: 3, right: 3}, lineColor: colors.border, lineWidth: { top: 0.1, bottom: 0.1, left: 0, right: 0 } },
              headStyles: { fillColor: colors.lightBg, textColor: colors.primary, fontStyle: 'bold' },
              columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35, halign: 'right' } },
              didParseCell: function(data) {
                if (data.section === 'body') {
                   const type = data.row.raw[0];
                   if (data.column.index === 0) {
                     data.cell.styles.textColor = type === "Revenue" ? colors.revenue : colors.expense;
                   } else {
                     data.cell.styles.textColor = colors.primary; // Make description and amount black
                   }
                }
              }
            });
            currentY = doc.lastAutoTable.finalY + 6;
          }
        } else {
          currentY += 4;
        }
      });
      
      currentY += 4;
    });
  }

  // --- Remittance / Settlement History ---
  if (options.includeRemittances) {
    const allRemittances = [];
    dateGroups.forEach(dg => {
      dg.payments.forEach(p => {
        allRemittances.push({ date: p.date, notes: p.notes, type: p.type, amount: p.amount });
      });
    });

    if (allRemittances.length > 0) {
      if (currentY > 230) { doc.addPage(); currentY = 15; }
      else { currentY += 5; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colors.primary);
      doc.text("Broker Settlement / Remittance History", 14, currentY);
      currentY += 5;

      const remTableData = allRemittances.map(r => [
        formatDate(r.date),
        r.type === "write_off" ? "Adjustment/Write-off" : "Remittance",
        r.notes || "Payment",
        fmt(r.amount)
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Date", "Reference", "Details", "Amount Remitted"]],
        body: remTableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: {top: 3, bottom: 3, left: 3, right: 3}, lineColor: colors.border, lineWidth: { top: 0, bottom: 0.1, left: 0, right: 0 } },
        headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 40 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 35, halign: 'right' } }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }
  }

  // --- Final Reconciliation ---
  if (options.includeReconciliation) {
    if (currentY > 230) { doc.addPage(); currentY = 15; }
    else { currentY += 5; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colors.primary);
    doc.text("Final Reconciliation", 14, currentY);
    currentY += 5;

    const recData = [
      ["Opening Balance", fmt(openingBalance)],
      ["Total Revenue", fmt(totalRevenue)],
      ["Less: Expenses", `-${fmt(totalExpenses)}`],
      ["Net Broker Balance", fmt(openingBalance + totalRevenue - totalExpenses)],
      ["Less: Remittances & Adjustments", `-${fmt(totalRemitted)}`],
      ["Closing / Outstanding Balance", fmt(closingBalance)]
    ];

    autoTable(doc, {
      startY: currentY,
      body: recData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4, lineColor: colors.border, lineWidth: 0.1 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: colors.lightBg }, 1: { halign: 'right' } },
      didParseCell: function(data) {
        if (data.row.index === 3 || data.row.index === 5) {
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index === 1) data.cell.styles.textColor = colors.primary;
        }
      }
    });
    
    currentY = doc.lastAutoTable.finalY + 8;

    // Reconciliation Status
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    if (isBalanced) {
      doc.setTextColor(...colors.revenue);
      doc.text("Reconciliation Status: ✓ BALANCED", 14, currentY);
    } else {
      doc.setTextColor(...colors.expense);
      doc.text("Reconciliation Status: ⚠ REVIEW REQUIRED", 14, currentY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const expected = openingBalance + netAmount - totalRemitted;
      doc.text(`Expected: ${fmt(expected)} | Recorded: ${fmt(closingBalance)} | Diff: ${fmt(closingBalance - expected)}`, 14, currentY + 5);
    }
  }

  // --- Pagination / Footer (Applied to all pages) ---
  const pageCount = doc.internal.getNumberOfPages();
  const generatedStr = `Generated on: ${new Date().toLocaleString("en-GB", { dateStyle: 'short', timeStyle: 'short' })}`;
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    
    doc.text("Broker Transaction Statement", 14, doc.internal.pageSize.getHeight() - 10);
    doc.text(generatedStr, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
  }

  // --- Output ---
  const safeBrokerName = (broker?.name || "Broker").replace(/[^a-z0-9]/gi, '_');
  const safeVehicle = vehicle === "all" ? "All_Vehicles" : vehicle.replace(/[^a-z0-9]/gi, '_');
  const fileName = `Broker_Statement_${safeBrokerName}_${safeVehicle}_${dateRange.start}_to_${dateRange.end}.pdf`;

  doc.save(fileName);
};
