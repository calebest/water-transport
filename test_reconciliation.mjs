import { calculateReconciliation, generateReconciliationPDF } from "./src/utils/reconciliationPdfGenerator.js";
import { financialDeductionsService } from "./src/services/financialDeductions.js";

async function runReconciliationTests() {
  console.log("=== RUNNING FINANCIAL RECONCILIATION UNIT TESTS ===");

  // Mock Trips
  const mockTrips = [
    {
      id: "trip-1",
      date: "2026-06-10",
      lorry: "KDD 123A",
      revenue: 20000,
      operatingExpenses: 8000,
      totalDeductions: 0,
      operatingProfit: 12000,
      netPayable: 12000,
      approvalStatus: "approved",
    },
    {
      id: "trip-2",
      date: "2026-06-15",
      lorry: "KDD 123A",
      revenue: 15000,
      operatingExpenses: 5000,
      totalDeductions: 0,
      operatingProfit: 10000,
      netPayable: 10000,
      approvalStatus: "approved",
    },
  ];

  // Mock Deductions
  const mockDeductions = [
    {
      id: "ded-1",
      date: "2026-06-12",
      category: "Vehicle Repairs & Maintenance",
      description: "Alternator repair (captured in trip fuel & repairs)",
      amount: 3000,
      included_in_trips: true, // Already in trips!
      allocated_boss: "All Bosses",
    },
    {
      id: "ded-2",
      date: "2026-06-14",
      category: "Bank / M-Pesa Fees",
      description: "Monthly business account maintenance fee",
      amount: 1500,
      included_in_trips: false, // Additional!
      allocated_boss: "All Bosses",
    },
    {
      id: "ded-3",
      date: "2026-06-18",
      category: "Transaction Charges",
      description: "Corporate bank transfer fee",
      amount: 500,
      included_in_trips: false, // Additional!
      allocated_boss: "All Bosses",
    },
  ];

  // Mock Payments to Boss
  const mockPayments = [
    {
      id: "pmt-1",
      date: "2026-06-15",
      time: "10:30 AM",
      recipient_name: "John",
      amount: 8000,
      payment_method: "Cash",
      reference_number: "REF-001",
    },
    {
      id: "pmt-2",
      date: "2026-06-20",
      time: "02:15 PM",
      recipient_name: "John",
      amount: 7000,
      payment_method: "M-Pesa",
      reference_number: "MPESA-002",
    },
  ];

  console.log("\n--- Test 1: Math Verification & No Double Deduction ---");
  const recon = calculateReconciliation({
    trips: mockTrips,
    deductions: mockDeductions,
    payments: mockPayments,
    dateRange: { start: "2026-06-01", end: "2026-06-30", label: "June 2026" },
    bossFilter: "all",
    allocationPercent: 100,
  });

  console.log("Total Profit Generated:", recon.totalProfitGenerated);
  console.log("Sum All Deductions:", recon.totalDeductionsAll);
  console.log("Deductions Already In Trips (Informational):", recon.sumDeductionsAlreadyInTrips);
  console.log("Additional Deductions (Subtracted):", recon.sumAdditionalDeductions);
  console.log("Net Amount Payable:", recon.netAmountPayable);
  console.log("Actual Cash Sent:", recon.actualAmountSent);
  console.log("Outstanding Balance:", recon.outstandingBalance);
  console.log("Status Label:", recon.statusLabel);

  // Assertions:
  // Total Profit = 12,000 + 10,000 = 22,000
  if (recon.totalProfitGenerated !== 22000) {
    throw new Error(`Expected profit 22000, got ${recon.totalProfitGenerated}`);
  }

  // Deductions already in trips = 3,000
  if (recon.sumDeductionsAlreadyInTrips !== 3000) {
    throw new Error(`Expected in-trips deductions 3000, got ${recon.sumDeductionsAlreadyInTrips}`);
  }

  // Additional deductions = 1,500 + 500 = 2,000
  if (recon.sumAdditionalDeductions !== 2000) {
    throw new Error(`Expected additional deductions 2000, got ${recon.sumAdditionalDeductions}`);
  }

  // Net payable = 22,000 - 2,000 = 20,000
  if (recon.netAmountPayable !== 20000) {
    throw new Error(`Expected net payable 20000, got ${recon.netAmountPayable}`);
  }

  // Actual sent = 8,000 + 7,000 = 15,000
  if (recon.actualAmountSent !== 15000) {
    throw new Error(`Expected actual sent 15000, got ${recon.actualAmountSent}`);
  }

  // Outstanding = 20,000 - 15,000 = 5,000
  if (recon.outstandingBalance !== 5000) {
    throw new Error(`Expected balance 5000, got ${recon.outstandingBalance}`);
  }

  if (recon.statusKey !== "due") {
    throw new Error(`Expected status 'due', got ${recon.statusKey}`);
  }
  console.log("✓ Math and double-deduction protection verified successfully!");

  console.log("\n--- Test 2: Service CRUD & Cache Fallback ---");
  const initialDeds = await financialDeductionsService.fetchAll();
  console.log(`Initial deductions fetched: ${initialDeds.length}`);

  const createdDed = await financialDeductionsService.create({
    description: "Emergency fleet battery replacement",
    amount: 8500,
    date: "2026-06-25",
    category: "Vehicle Repairs & Maintenance",
    reference_number: "BAT-9901",
    included_in_trips: false,
  });
  console.log("Created deduction:", createdDed);
  if (createdDed.amount !== 8500 || createdDed.description !== "Emergency fleet battery replacement") {
    throw new Error("Created deduction mismatch");
  }

  const updatedDed = await financialDeductionsService.update(createdDed.id, {
    description: "Emergency fleet battery replacement (Heavy Duty)",
    amount: 9000,
    date: "2026-06-25",
    category: "Vehicle Repairs & Maintenance",
    reference_number: "BAT-9901-REV",
    included_in_trips: false,
  });
  console.log("Updated deduction:", updatedDed);
  if (updatedDed.amount !== 9000) {
    throw new Error("Updated deduction mismatch");
  }

  await financialDeductionsService.delete(createdDed.id);
  const remainingDeds = await financialDeductionsService.fetchAll();
  if (remainingDeds.some((d) => d.id === createdDed.id)) {
    throw new Error("Deduction deletion failed");
  }
  console.log("✓ Deduction Service CRUD verified successfully!");

  console.log("\n--- Test 3: PDF Generation ---");
  const filename = generateReconciliationPDF(recon);
  console.log("Generated PDF report filename:", filename);
  if (!filename.includes("Mount_Kenya_Financial_Reconciliation")) {
    throw new Error(`Unexpected filename: ${filename}`);
  }
  console.log("✓ Reconciliation PDF Generation verified successfully!");

  console.log("\n=======================================================");
  console.log("🎉 ALL FINANCIAL RECONCILIATION TESTS PASSED!");
  console.log("=======================================================");
}

runReconciliationTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
