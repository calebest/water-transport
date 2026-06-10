# Water Transport Manager

A web app for tracking water delivery trips, expenses, and profit across your lorry fleet. Built for day-to-day operations in Kenya (KES currency), with real-time data sync, role-based access, trip approval workflows, exportable reports, and full offline/PWA support.

**Live stack:** React + Vite · Firebase Auth & Firestore · Tailwind CSS · Recharts · jsPDF · Vite PWA

---

## What it does

Water Transport Manager helps you run delivery operations from one place:

- **Set delivery routes** with standard prices per location
- **Manage Personnel & Vehicles** to keep track of your fleet and staff (Drivers, Conductors)
- **Log every trip** for each lorry, including revenue, expenses, and payment status
- **Trip Approvals** — Drivers can submit trips, but they remain "Pending" until an Admin approves them
- **See profit automatically** — expenses are totaled and subtracted from revenue on save
- **Monitor performance** on a live dashboard with daily, weekly, and monthly summaries
- **Generate reports** and export them as CSV or PDF for accounting and records
- **Offline Mode** — Installed as a Progressive Web App (PWA), the app works offline and caches data for seamless use on the road

All monetary values are shown in **KES**.

---

## How the system works

```text
Locations / Personnel / Vehicles  →  Trips  →  Approvals  →  Dashboard & Reports
         (setup)                  (records)   (admins)     (charts + exports)
```

### 1. Set routes, vehicles, and personnel

Admins can create:
- **Locations**: A delivery route with a standard revenue price (e.g., Mombasa → KES 15,000).
- **Vehicles**: The lorries in your fleet (e.g., KBZ, KBL) with status tracking.
- **Personnel**: Profiles for your Drivers and Conductors.

### 2. Link Auth Users to Personnel

When creating a User account for a Driver or Conductor, Admins can link their login to a Personnel profile. When a linked driver logs in to submit a trip, their name is auto-filled and locked in the "Driver" field, ensuring accountability.

### 3. Record each trip

Each trip captures:

| Field | Description |
|-------|-------------|
| Date | Day the trip happened |
| Lorry | Selected from the Vehicles list |
| Trip # | Internal trip reference (auto-pads to 3 digits, e.g., 001) |
| Location | Delivery route (from the locations list) |
| Revenue | Amount earned (KES) |
| Status | `Pending`, `Partial`, or `Paid` |

**Standard expenses** (fixed fields on every trip):
- Water, Diesel, Petrol, Police, Driver, Conductor

**Custom expenses** can be added per trip (e.g., repairs, tolls) with a label and amount.

### 4. Profit is calculated automatically

On every save, the app:
1. Sums all standard + custom expenses → `totalExpenses`
2. Subtracts from revenue → `profit`
3. Syncs the result to Firestore in real time

### 5. Review, Approve, and Export

- **Trip Approvals** — Trips submitted by Drivers appear with a red notification badge for Admins to review and approve.
- **Dashboard** — Live overview of revenue, expenses, profit, and trends (excludes unapproved pending trips).
- **Trips** — Searchable list with filters by lorry, date, and keyword.
- **Reports** — Daily, weekly, monthly, or custom date range summaries.
- **Export** — Download any report period as CSV or PDF.

---

## User roles

| Role | Access |
|------|--------|
| **Admin** | Full access: approve trips, manage users/personnel/vehicles, view all pages |
| **Driver** | Can submit new trips and propose edits to their own trips. Submissions require Admin approval. |
| **Conductor** | Same as Driver. Can submit new trips and propose edits. |
| **Viewer** | Read-only: view dashboard, trips, locations, and reports. Cannot create or delete records |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Backend | Firebase Authentication (email/password) |
| Database | Cloud Firestore (real-time listeners) |
| Offline | Vite PWA Plugin + Workbox |
| Charts | Recharts |
| PDF export | jsPDF + jspdf-autotable |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Firebase](https://console.firebase.google.com/) project

### 1. Clone and install

```bash
git clone https://github.com/calebest/water-transport.git
cd water-transport
npm install
```

### 2. Set up Firebase

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Email/Password** authentication (Authentication → Sign-in method)
3. Create a **Firestore** database
4. Copy your web app config from Project Settings → Your apps → Web

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your Firebase values in `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> **Important:** Never commit `.env` to git. It is listed in `.gitignore`. Only `.env.example` belongs in the repository.

### 4. Apply Firestore security rules

In Firebase Console → Firestore → Rules, paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function role() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isAdmin() { return role() == 'admin'; }
    function isAuthed() { return request.auth != null; }

    match /trips/{tripId} {
      allow read: if isAuthed();
      // Allow drivers and conductors to submit and edit trips
      allow create, update: if isAuthed() && (role() == 'admin' || role() == 'driver' || role() == 'conductor');
      allow delete: if isAuthed() && isAdmin();
    }

    match /locations/{locationId} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && isAdmin();
    }

    match /vehicles/{vehicleId} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && isAdmin();
    }

    match /personnel/{personnelId} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && isAdmin();
    }

    match /maintenance/{maintenanceId} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && isAdmin();
    }

    match /users/{userId} {
      allow read: if isAuthed();
      allow create: if isAuthed() && isAdmin();
      allow update: if isAuthed() && (request.auth.uid == userId || isAdmin());
      // Admin delete permission
      allow delete: if isAuthed() && isAdmin();
    }
  }
}
```

### 5. Create the first admin user

1. Run the app locally (see below)
2. Sign in won't work until a user exists — create the first account manually in Firebase Console → Authentication → Add user
3. In Firestore, create a document at `users/{uid}` with:

```json
{
  "name": "Your Name",
  "email": "you@example.com",
  "role": "admin"
}
```

Use the UID from the Authentication user you just created. After that, log in through the app and create additional users from the Users page.

### 6. Run the app

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

---

## License

MIT — see [LICENSE](LICENSE).
