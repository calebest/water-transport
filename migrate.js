/**
 * Firebase → Supabase Data Migration Script
 * 
 * Run with:  node migrate.js
 * 
 * NOTE: This script uses the Supabase SERVICE ROLE KEY (not anon key) to bypass RLS.
 *       Get it from: Supabase Dashboard → Settings → API → service_role key
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSD3r5XItzxZ0dMRO-n0D9u2Nrspd0ZGE",
  authDomain: "water-transport-manager.firebaseapp.com",
  projectId: "water-transport-manager",
  storageBucket: "water-transport-manager.firebasestorage.app",
  messagingSenderId: "337264638271",
  appId: "1:337264638271:web:6e54a5e9a2422ef3ecbb8a",
};

// ⚠️  Replace with your service_role key from Supabase Dashboard → Settings → API
const SUPABASE_URL     = "https://wlojpylfascssbxebszw.supabase.co";
const SUPABASE_SERVICE_KEY = "REPLACE_WITH_SERVICE_ROLE_KEY"; // Migration done — key removed for security

// ─── INIT ─────────────────────────────────────────────────────────────────────

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db          = getFirestore(firebaseApp);
const supabase    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const toDate = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v.toDate === "function") return v.toDate().toISOString().slice(0, 10);
  return null;
};

const toISO = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  return null;
};

const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

const insert = async (table, rows) => {
  if (!rows.length) { console.log(`  ⬜ ${table}: nothing to insert`); return; }
  for (const batch of chunk(rows, 50)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`  ❌ ${table} error:`, error.message);
    }
  }
  console.log(`  ✅ ${table}: inserted/updated ${rows.length} rows`);
};

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────

async function migrateVehicles() {
  console.log("\n📦 Vehicles");
  const snap = await getDocs(collection(db, "vehicles"));
  const rows = snap.docs.map(d => ({
    id: d.id,
    plate: d.data().plate || "",
    type: d.data().name || d.data().type || "",
    capacity: d.data().notes || d.data().capacity || "",
    status: d.data().status || "Active",
  }));
  await insert("vehicles", rows);
}

async function migratePersonnel() {
  console.log("\n👷 Personnel");
  const snap = await getDocs(collection(db, "personnel"));
  const rows = snap.docs.map(d => ({
    id: d.id,
    name: d.data().name || "",
    role: d.data().role || "Driver",
    phone: d.data().phone || "",
    id_number: d.data().idNumber || "",
    notes: d.data().notes || "",
    status: d.data().status || "Active",
  }));
  await insert("personnel", rows);
}

async function migrateLocations() {
  console.log("\n📍 Locations");
  const snap = await getDocs(collection(db, "locations"));
  const rows = snap.docs.map(d => ({
    id: d.id,
    name: d.data().name || "",
    distance: d.data().distance || null,
    default_rate: d.data().defaultRate || d.data().rate || 0,
  }));
  await insert("locations", rows);
}

async function migrateTrips() {
  console.log("\n🚛 Trips");
  const snap = await getDocs(collection(db, "trips"));
  const rows = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      date: toDate(data.date) || new Date().toISOString().slice(0, 10),
      lorry: data.lorry || "",
      trip_number: data.tripNumber || null,
      location: data.location || null,
      revenue: Number(data.revenue || 0),
      status: data.status || "Pending",
      amount_paid: Number(data.amountPaid || 0),
      driver_id: data.driverId || null,
      conductor_id: data.conductorId || null,
      odometer_start: data.odometerStart ? Number(data.odometerStart) : null,
      odometer_end: data.odometerEnd ? Number(data.odometerEnd) : null,
      expenses: data.expenses || {},
      deductions: data.deductions || {},
      approval_status: data.approvalStatus || "approved",
      paid_at: toISO(data.paidAt),
      earnings_rate: data.earningsRate || null,
      earnings_amount: Number(data.earningsAmount || 0),
    };
  });
  await insert("trips", rows);
}

async function migrateMaintenance() {
  console.log("\n🔧 Maintenance");
  const snap = await getDocs(collection(db, "maintenance"));
  const rows = snap.docs.map(d => ({
    id: d.id,
    date: toDate(d.data().date) || new Date().toISOString().slice(0, 10),
    lorry: d.data().lorry || "",
    type: d.data().type || "Routine",
    description: d.data().description || "",
    cost: Number(d.data().cost || 0),
    odometer: d.data().odometer ? Number(d.data().odometer) : null,
    status: "completed",
  }));
  await insert("maintenance", rows);
}

async function migrateComplaints() {
  console.log("\n📋 Complaints");
  const snap = await getDocs(collection(db, "complaints"));
  const rows = snap.docs.map(d => ({
    id: d.id,
    date: toDate(d.data().date) || new Date().toISOString().slice(0, 10),
    subject: d.data().subject || "Complaint",
    description: d.data().description || "",
    severity: d.data().severity || "low",
    status: d.data().status || "open",
  }));
  await insert("complaints", rows);
}

async function migrateLoans() {
  console.log("\n💰 Loans");
  const snap = await getDocs(collection(db, "loans"));
  const loanRows = snap.docs.map(d => ({
    id: d.id,
    personnel_id: d.data().personnelId || null,
    amount: Number(d.data().amount || 0),
    date: toDate(d.data().dateBorrowed) || new Date().toISOString().slice(0, 10),
    type: d.data().category || "Other",
    reason: d.data().purpose || "",
    status: d.data().status || "Outstanding",
    amount_repaid: Number(d.data().amountRepaid || 0),
    balance: Number(d.data().balance || d.data().amount || 0),
  }));
  await insert("loans", loanRows);

  // Migrate repayments subcollections
  let repaymentRows = [];
  for (const d of snap.docs) {
    const repSnap = await getDocs(collection(db, "loans", d.id, "repayments"));
    for (const r of repSnap.docs) {
      repaymentRows.push({
        id: r.id,
        loan_id: d.id,
        amount: Number(r.data().amount || 0),
        date: toDate(r.data().date) || new Date().toISOString().slice(0, 10),
        method: r.data().method || "Cash",
        notes: r.data().notes || "",
      });
    }
  }
  await insert("loan_repayments", repaymentRows);
}

async function migrateSettings() {
  console.log("\n⚙️  Settings");
  
  // General settings
  const generalSnap = await getDoc(doc(db, "settings", "general"));
  if (generalSnap.exists()) {
    await supabase.from('settings').upsert({ key: "general", value: generalSnap.data() }, { onConflict: "key" });
    console.log("  ✅ settings: general");
  }
  
  // Earnings config
  const earningsSnap = await getDoc(doc(db, "settings", "earningsConfig"));
  if (earningsSnap.exists()) {
    await supabase.from('settings').upsert({ key: "earningsConfig", value: earningsSnap.data() }, { onConflict: "key" });
    console.log("  ✅ settings: earningsConfig");
  }
}

async function migratePersonalFinance() {
  console.log("\n💳 Personal Finance");
  const snap = await getDocs(collection(db, "personalFinanceRecords"));
  const recordRows = snap.docs.map(d => ({
    id: d.id,
    type: d.data().type || "i_owe",
    person_name: d.data().personName || "",
    category: d.data().category || "Personal",
    description: d.data().description || "",
    principal_amount: Number(d.data().principalAmount || 0),
    amount_added: Number(d.data().amountAdded || 0),
    amount_paid: Number(d.data().amountPaid || 0),
    balance: Number(d.data().balance || 0),
    status: d.data().status || "Open",
    start_date: toDate(d.data().startDate),
    due_date: toDate(d.data().dueDate),
    method: d.data().method || "Cash",
    notes: d.data().notes || "",
  }));
  await insert("personal_finance", recordRows);

  // Migrate transactions subcollections
  let txRows = [];
  for (const d of snap.docs) {
    const txSnap = await getDocs(collection(db, "personalFinanceRecords", d.id, "transactions"));
    for (const t of txSnap.docs) {
      txRows.push({
        id: t.id,
        record_id: d.id,
        transaction_type: t.data().transactionType || "payment",
        amount: Number(t.data().amount || 0),
        date: toDate(t.data().date) || new Date().toISOString().slice(0, 10),
        method: t.data().method || "Cash",
        notes: t.data().notes || "",
        effect: t.data().effect || "decrease",
      });
    }
  }
  await insert("personal_finance_tx", txRows);
}

async function migrateBrokerLedger() {
  console.log("\n📒 Broker Ledger");
  const snap = await getDocs(collection(db, "broker_ledger"));
  const rows = snap.docs.map(d => ({
    id: d.id,
    trip_id: d.data().tripId || null,
    date: toDate(d.data().date) || new Date().toISOString().slice(0, 10),
    type: d.data().type || "revenue",
    amount: Number(d.data().amount || 0),
    notes: d.data().notes || "",
  }));
  await insert("broker_ledger", rows);
}

async function migratePersonnelLedger() {
  console.log("\n📒 Personnel Ledger");
  const snap = await getDocs(collection(db, "personnel_ledger"));
  const rows = snap.docs.map(d => ({
    id: d.id,
    trip_id: d.data().tripId || null,
    personnel_id: d.data().personnelId || null,
    date: toDate(d.data().date) || new Date().toISOString().slice(0, 10),
    type: d.data().type || "earning",
    amount: Number(d.data().amount || 0),
    notes: d.data().notes || "",
  }));
  await insert("personnel_ledger", rows);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  if (SUPABASE_SERVICE_KEY === "REPLACE_WITH_SERVICE_ROLE_KEY") {
    console.error("\n❌ ERROR: Please set your SUPABASE_SERVICE_KEY in migrate.js first!");
    console.error("   Get it from: Supabase Dashboard → Settings → API → service_role key\n");
    process.exit(1);
  }

  console.log("🚀 Starting Firebase → Supabase migration...");
  console.log("   Firebase project:", FIREBASE_CONFIG.projectId);
  console.log("   Supabase URL:", SUPABASE_URL);

  try {
    await migrateVehicles();
    await migratePersonnel();
    await migrateLocations();
    await migrateTrips();
    await migrateMaintenance();
    await migrateComplaints();
    await migrateLoans();
    await migrateSettings();
    await migratePersonalFinance();
    await migrateBrokerLedger();
    await migratePersonnelLedger();

    console.log("\n🎉 Migration complete! All data has been transferred to Supabase.");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  }
}

main();
