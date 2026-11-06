import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Download a DOM element as a high-resolution PNG image (300 DPI equivalent)
 */
export const downloadElementAsImage = async (element, filename = "download.png", scale = 3) => {
  if (!element) {
    throw new Error("Target element not found for image export");
  }

  try {
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error("Error capturing element to image:", err);
    throw err;
  }
};

/**
 * Export Business Card as a print-ready PDF
 * Supports:
 * - "single": 85mm x 55mm standard landscape card (Page 1 = Front, Page 2 = Back)
 * - "sheet": Full A4 print sheet with 8 cards laid out with cutting crop marks
 */
export const downloadBusinessCardPDF = async ({
  frontElement,
  backElement,
  filename = "Mount_Kenya_Business_Cards.pdf",
  mode = "single", // "single" | "sheet"
}) => {
  if (!frontElement) {
    throw new Error("Front of card element is required");
  }

  // Capture front canvas
  const frontCanvas = await html2canvas(frontElement, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
  });
  const frontDataUrl = frontCanvas.toDataURL("image/png");

  // Capture back canvas if present
  let backDataUrl = null;
  if (backElement) {
    const backCanvas = await html2canvas(backElement, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });
    backDataUrl = backCanvas.toDataURL("image/png");
  }

  if (mode === "single") {
    // Standard 85mm x 55mm format
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [85, 55],
    });

    // Page 1: Front
    doc.addImage(frontDataUrl, "PNG", 0, 0, 85, 55);

    // Page 2: Back
    if (backDataUrl) {
      doc.addPage([85, 55], "landscape");
      doc.addImage(backDataUrl, "PNG", 0, 0, 85, 55);
    }

    doc.save(filename);
    return filename;
  }

  // Mode: "sheet" (A4 sheet with 8 cards: 2 columns x 4 rows)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const cardW = 85;
  const cardH = 55;
  const startX = 15;
  const startY = 20;
  const gapX = 10;
  const gapY = 8;

  // Add front cards (Page 1)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("MOUNT KENYA WATER DISTRIBUTORS — BUSINESS CARDS (A4 PRINT SHEET)", 15, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Page 1: Front Sides — Cut along card borders or guidelines", 15, 16);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      // Draw faint crop/cut guides
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.15);
      doc.rect(x - 0.5, y - 0.5, cardW + 1, cardH + 1);

      doc.addImage(frontDataUrl, "PNG", x, y, cardW, cardH);
    }
  }

  // If back is provided, add back cards on Page 2
  if (backDataUrl) {
    doc.addPage("a4", "portrait");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("MOUNT KENYA WATER DISTRIBUTORS — BUSINESS CARDS (A4 PRINT SHEET)", 15, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Page 2: Back Sides — Reverse side for duplex printing", 15, 16);

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.15);
        doc.rect(x - 0.5, y - 0.5, cardW + 1, cardH + 1);

        doc.addImage(backDataUrl, "PNG", x, y, cardW, cardH);
      }
    }
  }

  doc.save(filename);
  return filename;
};

/**
 * Export Marketing Poster as print-ready PDF for various paper sizes:
 * Supports:
 * - "a5": Standard Handout / Promotional Flyer (148mm x 210mm) - RECOMMENDED
 * - "a6": Postcard / Pocket Flyer (105mm x 148mm)
 * - "a2": Large Wall / Depot Display Poster (420mm x 594mm)
 * - "a4": Standard Document Sheet (210mm x 297mm)
 */
export const downloadPosterPDF = async ({
  posterElement,
  filename,
  paperSize = "a5", // "a5" | "a6" | "a2" | "a4"
}) => {
  if (!posterElement) {
    throw new Error("Target poster element is required");
  }

  const validSizes = ["a5", "a6", "a2", "a4"];
  const sizeKey = validSizes.includes(paperSize?.toLowerCase()) ? paperSize.toLowerCase() : "a5";

  const defaultFilename = `Mount_Kenya_Water_Poster_${sizeKey.toUpperCase()}.pdf`;
  const finalFilename = filename || defaultFilename;

  const canvas = await html2canvas(posterElement, {
    scale: sizeKey === "a2" ? 2 : 3, // Scale 2 for A2 to stay within memory limits while remaining ultra-sharp, scale 3 for A5/A6/A4
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    windowWidth: posterElement.scrollWidth,
    windowHeight: posterElement.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/png");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: sizeKey,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Full-bleed placement across the exact page dimensions
  doc.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
  doc.save(finalFilename);
  return finalFilename;
};

