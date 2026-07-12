# Water Transport Manager

A comprehensive web application for managing water delivery and trucking logistics operations. Built for day-to-day operations in Kenya (KES currency), featuring real-time data sync, a double-entry ledger system for brokers and personnel, role-based access control, dynamic dashboard charts, and full offline/PWA support.

**Live stack:** React 18 + Vite · Supabase (PostgreSQL & Auth) · Tailwind CSS · Recharts · jsPDF · Vite PWA

---

## 🚀 Key Features

- **Double-Entry Ledger System**: Track running balances for both Brokers (revenue vs payments) and Personnel (earnings vs deductions/withdrawals).
- **Manage Fleet & Staff**: Keep track of Vehicles (Lorries), Drivers, Conductors, and Brokers.
- **Trip Approval Workflow**: Drivers/Conductors can log trips, but they remain "Pending" until an Admin or Owner approves them.
- **Automated Profit Calculation**: Revenue minus standard and custom operating expenses yields Operating Profit. Subtract deductions to get Net Payable.
- **Broker Management**: Track which trips were sourced by which brokers, monitor outstanding broker balances, and record bulk broker remittances.
- **Interactive Financial Dashboard**: Beautiful gradient area charts, week/month summaries, and live pending-settlement tracking.
- **Loans & Maintenance**: Built-in modules to track personnel loans and vehicle maintenance history.
- **Offline Mode**: Installed as a Progressive Web App (PWA), the app caches data and works seamlessly on the road.

---

## 🏗️ How the System Works

```text
Locations / Vehicles / Brokers / Personnel  →  Trips  →  Ledger & Dashboard
```

### 1. Set Up the Fleet
Admins define the core entities:
- **Locations**: Delivery routes and standard prices.
- **Vehicles**: Lorries (e.g., KCA 123A) and their capacities.
- **Personnel & Brokers**: Profiles for Drivers, Conductors, and Brokers sourcing the trips.

### 2. Log Trips
A trip record captures:
- Date, Lorry, Location, and identifying Trip Number.
- **Revenue**: Total generated.
- **Operating Expenses**: Fixed fields (Water, Diesel, Police, Driver, Conductor, Repairs) + custom expenses.
- **Deductions**: Custom deductions (e.g., Loan Recovery, Advance Recovery).

### 3. The Ledger Tracks the Money
Instead of just summing trips, the app uses a strict ledger (`ledger_entries` table in Supabase):
- **Broker Ledger**: Credits when a trip is logged, Debits when a broker pays for fuel or remits money to the owner.
- **Personnel Ledger**: Credits when a driver/conductor works a trip, Debits when they take a loan or get paid.

### 4. Role-Based Access Control (RBAC)
- **Admin / Owner**: Full access. Can approve trips, delete users, view total fleet revenue, and settle ledger balances.
- **Broker**: Can see trips they brokered and their outstanding remittance balance.
- **Driver / Conductor**: Can only see trips they participated in, and their personal outstanding balance/earnings.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Backend & Auth** | Supabase (PostgreSQL, Real-time Subscriptions, Row Level Security) |
| **State Management**| Context API + Supabase Realtime listeners |
| **Charts** | Recharts (Custom AreaCharts & BarCharts) |
| **Exporting** | jsPDF + jspdf-autotable (PDF) / Blob (CSV) |
| **Offline/PWA** | Vite PWA Plugin + Workbox |

---

## 💻 Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Supabase Setup
This project uses Supabase. You need a Supabase project with the following tables:
- `profiles` (Links to `auth.users`)
- `trips`
- `vehicles`, `personnel`, `brokers`, `locations`
- `ledger_entries`
- `maintenance`, `loans`, `complaints`
- `app_settings`, `earnings_config`

*You can find the schema definitions in the `supabase/` folder. Run `supabase/schema.sql` in your Supabase SQL Editor to bootstrap the database.*

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run the app
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

---

## 🛡️ Security & Database Notes

- **Row Level Security (RLS)** is strictly enforced in Supabase. Drivers can only select themselves when logging trips, and users can only view data relevant to their role.
- **User Deletion**: Deleting a user from the Admin dashboard triggers a `SECURITY DEFINER` RPC function (`delete_user`) in Supabase to completely remove both their `profiles` record and their underlying `auth.users` authentication record.
- **Real-time**: The app relies heavily on `supabase.channel()` to instantly update dashboards, ledgers, and trip lists across all connected devices when an Admin approves a trip.

---

*Designed by [Cyber Vision Lab]*
