# Water Transport Logistics System - AI Onboarding & Architecture

**Hello fellow AI!** 👋 
If the user provided you with this document, you are taking over or helping build a **Water Transport & Trucking Logistics SaaS**. 

Please read this document carefully before modifying the codebase. It explains the core architecture, database schema, financial logic, and role-based access controls to ensure you don't accidentally break the ledger or authentication flows.

---

## 1. Tech Stack
- **Frontend Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS (Vanilla, heavily reliant on utility classes, glassmorphism, and modern UI paradigms)
- **Backend & Database**: Supabase (PostgreSQL, Auth, Realtime)
- **Charts**: Recharts (Customized with AreaCharts, gradients, custom tooltips)
- **Hosting**: Vercel

---

## 2. Core Business Logic & Financials

The application calculates financials dynamically. Do **NOT** try to change the mathematical models without explicit user consent.

**The Math (`src/utils/helpers.js` -> `getTripFinancials`)**:
1. `Revenue`: The total amount the trip generated.
2. `Operating Expenses`: Fixed keys (`water`, `diesel`, `police`, `driver`, `conductor`, `repairs`) + Custom operating expenses.
3. **`Operating Profit`**: `Revenue - Operating Expenses`
4. `Deductions`: Deductions levied on personnel (e.g., `loanRecovery`, `advanceRecovery`).
5. **`Net Payable` (Net Profit)**: `Operating Profit - Total Deductions`

*Note: The system has a legacy array `expenses.custom` which contains both operating expenses and deductions. They are separated by `isDeductionLabel` in `helpers.js`.*

---

## 3. The Ledger System

Instead of just tracking total balances, the app uses a ledger system (`ledger_entries` table) to maintain a running balance for both **Brokers** and **Personnel** (Drivers/Conductors). 

This is handled by `src/services/finance.js`. 

### Broker Ledger:
- `revenue`: Positive balance (broker owes owner money for trips they found)
- `expense_paid`: Negative balance (broker paid for fuel/water out of pocket)
- `remittance`: Negative balance (broker remitted money to the owner)
- **Current Balance** = `revenue - (expense_paid + remittance)`

### Personnel Ledger:
- `earning`: Positive balance (driver/conductor did a trip)
- `deduction`: Negative balance (loan or advance deduction)
- `withdrawal`: Negative balance (driver was paid their earnings)
- **Current Balance** = `earning - (deduction + withdrawal)`

> ⚠️ **CRITICAL**: When a trip is created or edited, `financeService.handleTripLedgerEntries(trip)` syncs the trip financials to the ledger table automatically. Do not duplicate this logic.

---

## 4. Database Schema (Supabase)

All tables use Row Level Security (RLS). 

- `profiles`: Mirrors `auth.users`. Contains `role` (admin, owner, broker, driver, conductor, viewer) and `personnel_id` (foreign key linking a user to a driver/conductor profile).
- `trips`: The core entity. Contains `date`, `lorry` (plate number), `location`, `revenue`, `expenses` (JSONB), `deductions` (JSONB), `approvalStatus` (pending, approved, rejected, pending_edit), and `status` (Unpaid, Paid).
- `vehicles`: Lorry inventory (`plate`, `capacity`).
- `personnel`: Drivers and conductors (`name`, `role`).
- `brokers`: Brokers (`name`, `phone`).
- `locations`: Saved trip destinations/routes.
- `ledger_entries`: Polymorphic ledger tracking (`entity_type`: 'broker' or 'personnel', `entity_id`, `type`, `amount`, `trip_id`).
- `app_settings`: Global configuration (`directApproval`, etc.).
- `earnings_config`: Configures how personnel are paid (`ratePerTrip`, `dailyCommissionAmount`).

---

## 5. Role-Based Access Control (RBAC)

The app is highly contextual based on the user's role:
- **Admin & Owner**: Full access. Can approve trips, delete users, view all financial charts, and mark trips as paid.
- **Broker**: Can add trips but *cannot* approve them (unless `directApproval` is on).
- **Driver & Conductor**: Cannot see global revenue. They only see a stripped-down dashboard showing their own ledger balance (`My Outstanding Balance`) and the trips they participated in.

*The `AuthContext` (`src/contexts/AuthContext.jsx`) provides `profile`, `isAdmin`, `isOwner`, `isBroker`, etc.*

---

## 6. Known Gotchas & Recent Fixes
1. **Admin User Deletion**: Supabase anon keys cannot delete users. Deleting a user calls a Supabase RPC function `delete_user` (in `supabase/admin_functions.sql`) which operates as `SECURITY DEFINER`. In the JS layer, it explicitly deletes the profile row as a fallback.
2. **Chart Components**: The Dashboard uses Recharts `AreaChart` with SVG `<defs>` for gradients. If you add new charts, maintain this premium aesthetic.
3. **Trip Modals**: When editing a trip, the payload is converted back to form state. Watch out for the JSONB conversion of `expenses.custom`.
4. **Supabase Realtime**: The app relies on Supabase `.channel().on('postgres_changes')` subscriptions to instantly update the UI when database changes occur. Do not replace this with manual polling.

---

## 7. How to Continue
When the user asks for a feature:
1. **Identify the layer**: Is it UI? `src/pages/`. Is it DB logic? `src/services/`. Is it auth? `src/contexts/`.
2. **Maintain the styling**: Use existing Tailwind classes, `StatCard`, `Badge`, and `Modal` components found in `src/components/ui.jsx`. 
3. **Respect the Ledger**: If dealing with money, ensure `ledger_entries` are updated correctly.

*Happy Coding!* 🚀
