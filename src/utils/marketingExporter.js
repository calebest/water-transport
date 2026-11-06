import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

/**
 * Capture a DOM element as a high-resolution PNG Data URL.
 * Uses html-to-image (SVG foreignObject) to natively support modern Tailwind v4
 * OKLCH colors, clip-paths, CSS variables, and modern gradients without parser errors.
 */
const captureElementToPng = async (element, pixelRatio = 3) => {
  if (!element) {
    throw new Error("Target element not found for image export");
  }

  // Ensure element has rendered layout
  const width = element.offsetWidth || element.clientWidth || 600;
  const height = element.offsetHeight || element.clientHeight || 400;

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: pixelRatio,
      quality: 0.98,
      cacheBust: true,
      canvasWidth: width * pixelRatio,
      canvasHeight: height * pixelRatio,
    });
    return dataUrl;
  } catch (err) {
    console.warn("Primary toPng capture failed, retrying with fallback options:", err);
    // Fallback attempt without cacheBust in case of local data URL issues
    return await toPng(element, {
      pixelRatio: Math.min(pixelRatio, 2),
      quality: 0.92,
    });
  }
};

/**
 * Download a DOM element as a high-resolution PNG image (300 DPI equivalent)
 */
export const downloadElementAsImage = async (element, filename = "download.png", scale = 3) => {
  try {
    const dataUrl = await captureElementToPng(element, scale);
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

  // Capture front canvas as high-res PNG
  const frontDataUrl = await captureElementToPng(frontElement, 3);

  // Capture back canvas if present
  let backDataUrl = null;
  if (backElement) {
    try {
      backDataUrl = await captureElementToPng(backElement, 3);
    } catch (e) {
      console.warn("Could not capture card back side, generating front-only PDF:", e);
    }
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

  // Scale 2 for A2 to stay within memory limits while remaining ultra-sharp, scale 3 for A5/A6/A4
  const scale = sizeKey === "a2" ? 2 : 3;
  const imgData = await captureElementToPng(posterElement, scale);

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

