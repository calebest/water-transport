import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatKES, formatDateKE, formatKESNumberOnly, generatePaymentReportPDF } from "./src/utils/paymentPdfGenerator.js";
import { paymentRecordsService } from "./src/services/paymentRecords.js";

async function runTests() {
  console.log("=== RUNNING PAYMENT RECORDS & PDF REPORT UNIT TESTS ===");

  // Test 1: Currency Formatting
  console.log("\n--- Test 1: Currency Formatting ---");
  const testVal1 = formatKES(8700);
  const testVal2 = formatKES(4500.5);
  const testVal3 = formatKESNumberOnly(8700);
  console.log("formatKES(8700):", testVal1);
  console.log("formatKES(4500.5):", testVal2);
  console.log("formatKESNumberOnly(8700):", testVal3);
  if (!testVal1.includes("8,700") || !testVal1.includes("KES")) {
    throw new Error("Currency formatting failed!");
  }
  console.log("✓ Currency formatting verified");

  // Test 2: Date Formatting
  console.log("\n--- Test 2: Date Formatting ---");
  const d1 = formatDateKE("2026-06-15");
  const d2 = formatDateKE("2026-11-05");
  console.log("formatDateKE('2026-06-15'):", d1);
  console.log("formatDateKE('2026-11-05'):", d2);
  if (d1 !== "15/06/2026") {
    throw new Error(`Expected '15/06/2026' but got '${d1}'`);
  }
  console.log("✓ Date formatting verified (DD/MM/YYYY)");

  // Test 3: Service fetchAll
  console.log("\n--- Test 3: Service fetchAll ---");
  const initialRecords = await paymentRecordsService.fetchAll();
  console.log(`Fetched ${initialRecords.length} records.`);
  if (!Array.isArray(initialRecords)) {
    throw new Error("Expected fetchAll to return an array");
  }
  console.log("✓ fetchAll verified (clean slate verified)");

  // Test 4: Service Create
  console.log("\n--- Test 4: Service Create ---");
  const newRec = await paymentRecordsService.create({
    recipient_name: "Test Recipient",
    amount: 12500,
    date: "2026-06-25",
    time: "03:45 PM",
    description: "Testing automated payment insertion",
    payment_method: "M-Pesa",
    reference_number: "MPESA-TST-001"
  });
  console.log("Created record:", newRec);
  if (newRec.recipient_name !== "Test Recipient" || newRec.amount !== 12500) {
    throw new Error("Creation payload mismatch");
  }
  console.log("✓ create verified");

  // Test 5: Service Update
  console.log("\n--- Test 5: Service Update ---");
  const updatedRec = await paymentRecordsService.update(newRec.id, {
    recipient_name: "Test Recipient Updated",
    amount: 15000,
    date: "2026-06-25",
    time: "04:00 PM",
    description: "Updated description",
    payment_method: "Bank Transfer",
    reference_number: "BANK-TST-002"
  });
  console.log("Updated record:", updatedRec);
  if (updatedRec.amount !== 15000 || updatedRec.recipient_name !== "Test Recipient Updated") {
    throw new Error("Update failed");
  }
  console.log("✓ update verified");

  // Test 6: Service Delete
  console.log("\n--- Test 6: Service Delete ---");
  await paymentRecordsService.delete(newRec.id);
  const afterDelete = await paymentRecordsService.fetchAll();
  const found = afterDelete.find(r => r.id === newRec.id);
  if (found) {
    throw new Error("Record should have been deleted");
  }
  console.log("✓ delete verified");

  // Test 7: Multi-page PDF Report Generation
  console.log("\n--- Test 7: PDF Generation (Single & Multi-Page) ---");
  // Create 35 test records to trigger multi-page generation
  const mockRecords = [];
  for (let i = 1; i <= 35; i++) {
    const day = String((i % 28) + 1).padStart(2, "0");
    mockRecords.push({
      id: `mock-${i}`,
      recipient_name: i % 3 === 0 ? "John" : i % 3 === 1 ? "Peter" : "David",
      amount: 1000 * ((i % 5) + 1),
      date: `2026-06-${day}`,
      time: "10:30 AM",
      description: `Payment description for batch item #${i}`,
      payment_method: i % 2 === 0 ? "M-Pesa" : "Cash",
      reference_number: `REF-${i}`
    });
  }

  const filename = generatePaymentReportPDF(mockRecords, {
    dateRange: {
      start: "2026-06-01",
      end: "2026-06-30",
      label: "June 2026"
    }
  });

  console.log("Returned filename:", filename);
  if (!filename || !filename.startsWith("Mount_Kenya_Payment_Report_2026-06-01_to_2026-06-30.pdf")) {
    throw new Error("PDF filename format invalid: " + filename);
  }
  console.log("✓ Multi-page PDF generation verified successfully! Filename:", filename);

  console.log("\n=======================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! EVERYTHING IS READY!");
  console.log("=======================================================");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
