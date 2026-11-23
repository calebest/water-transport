import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportMileageCSV = (records = [], filterInfo = {}) => {
  const headers = ["Date", "Vehicle", "Kilometers Covered (KM)", "Notes", "Logged At"];
  const rows = records.map((r) => [
    r.mileage_date || "",
    r.vehicle_plate || "",
    r.kilometers_covered ?? 0,
    `"${(r.notes || "").replace(/"/g, '""')}"`,
    r.created_at ? new Date(r.created_at).toLocaleString("en-KE") : "",
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  const vehicleStr = filterInfo.vehicle && filterInfo.vehicle !== "all" ? `_${filterInfo.vehicle}` : "";
  link.setAttribute("href", url);
  link.setAttribute("download", `daily_mileage_report${vehicleStr}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportMileagePDF = (records = [], { title = "Daily Mileage Report", dateRangeLabel = "", vehicleFilter = "All Vehicles", summary = {} } = {}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const primaryColor = [14, 116, 144]; // cyan/sky-700
  const darkColor = [30, 41, 59]; // slate-800
  const mutedColor = [100, 116, 139]; // slate-500
  const lightBg = [248, 250, 252]; // slate-50

  // 1. Header Banner
  doc.setFillColor(...lightBg);
  doc.roundedRect(40, 36, 515, 68, 6, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...primaryColor);
  doc.text("MOUNT KENYA WATER DISTRIBUTORS", 55, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...darkColor);
  doc.text(title.toUpperCase(), 55, 78);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(
    `Period: ${dateRangeLabel || "All Time"}  |  Vehicle: ${vehicleFilter}  |  Generated: ${new Date().toLocaleDateString("en-KE")}`,
    55,
    92
  );

  // 2. Summary KPI Cards
  const totalKm = summary.totalKm ?? records.reduce((s, r) => s + Number(r.kilometers_covered || 0), 0);
  const avgKm = summary.dailyAvg ?? (records.length > 0 ? Math.round(totalKm / records.length) : 0);
  const daysLogged = summary.daysCount ?? records.length;

  const cardY = 118;
  const cardWidth = 165;
  const cardHeight = 44;

  const cards = [
    { label: "TOTAL DISTANCE", value: `${Number(totalKm).toLocaleString("en-KE")} KM` },
    { label: "DAILY AVERAGE", value: `${Number(avgKm).toLocaleString("en-KE")} KM / Day` },
    { label: "LOGGED RECORDS", value: `${daysLogged} Entries` },
  ];

  cards.forEach((c, idx) => {
    const x = 40 + idx * (cardWidth + 10);
    doc.setFillColor(...lightBg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedColor);
    doc.text(c.label, x + 10, cardY + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text(c.value, x + 10, cardY + 34);
  });

  // 3. Mileage Records Table
  const tableRows = records.map((r, i) => [
    i + 1,
    r.mileage_date || "",
    r.vehicle_plate || "—",
    `${Number(r.kilometers_covered || 0).toLocaleString("en-KE")} KM`,
    r.notes || "Normal operations",
  ]);

  autoTable(doc, {
    startY: cardY + cardHeight + 20,
    head: [["#", "Date", "Vehicle", "Kilometers Covered", "Operational Notes"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
    },
    styles: {
      fontSize: 8,
      cellPadding: 6,
      textColor: darkColor,
    },
    columnStyles: {
      0: { cellWidth: 25, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 65, fontStyle: "bold" },
      3: { cellWidth: 100, halign: "right", fontStyle: "bold" },
      4: { cellWidth: "auto" },
    },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageNumber = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(...mutedColor);
      doc.text(
        `Page ${pageNumber}  •  Mount Kenya Water Distributors Fleet Management`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 24,
        { align: "center" }
      );
    },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`daily_mileage_${dateStr}.pdf`);
};
