# Water Transport Manager

A web app for tracking water delivery trips, expenses, and profit across your lorry fleet. Built for day-to-day operations in Kenya (KES currency), with real-time data sync, role-based access, and exportable reports.

**Live stack:** React + Vite · Firebase Auth & Firestore · Tailwind CSS · Recharts · jsPDF

---

## What it does

Water Transport Manager helps you run delivery operations from one place:

- **Set delivery routes** with standard prices per location
- **Log every trip** for each lorry, including revenue, expenses, and payment status
- **See profit automatically** — expenses are totaled and subtracted from revenue on save
- **Monitor performance** on a live dashboard with daily, weekly, and monthly summaries
- **Generate reports** and export them as CSV or PDF for accounting and records

The app tracks two lorries by default: **KBZ** and **KBL**. All monetary values are shown in **KES**.

---

## How the system works

```
Locations  →  Trips  →  Auto-calculations  →  Dashboard & Reports
(routes)      (records)   (profit/expenses)     (charts + exports)
```

### 1. Set routes and prices

Admins create **locations** — each location is a delivery route with a standard revenue price (e.g. Mombasa → KES 15,000).

When recording a trip, selecting a location auto-fills the expected revenue. New locations can also be added inline while creating a trip.

### 2. Record each trip

Each trip captures:

| Field | Description |
|-------|-------------|
| Date | Day the trip happened |
| Lorry | KBZ or KBL |
| Trip # | Your internal trip reference |
| Location | Delivery route (from the locations list) |
| Revenue | Amount earned (KES) |
| Status | `Pending` or `Paid` |

**Standard expenses** (fixed fields on every trip):

- Water, Diesel, Petrol, Police, Driver, Conductor

**Custom expenses** can be added per trip (e.g. repairs, tolls) with a label and amount.

### 3. Profit is calculated automatically

On every save, the app:

1. Sums all standard + custom expenses → `totalExpenses`
2. Subtracts from revenue → `profit`
3. Syncs the result to Firestore in real time

All connected users see updated figures immediately — no manual refresh needed.

### 4. Review and export

- **Dashboard** — today's totals, 14-day profit trend, KBZ vs KBL comparison, week/month summaries
- **Trips** — searchable list with filters by lorry, date, and keyword
- **Reports** — daily, weekly, monthly, or custom date range with expense breakdown and lorry split
- **Export** — download any report period as CSV or PDF

---

## User roles

| Role | Access |
|------|--------|
| **Admin** | Full access: add/edit/delete trips and locations, manage users, view all pages |
| **Viewer** | Read-only: view dashboard, trips, locations, and reports. Cannot create or delete records |

Admins manage users from the **Users** page (admin-only). New users are created with email/password via Firebase Authentication and assigned a role stored in Firestore.

---

## Pages

| Page | Purpose |
|------|---------|
| **Dashboard** | Live overview — revenue, expenses, profit, trip count, charts |
| **Trips** | Full trip log with search and filters |
| **Locations** | Manage delivery routes and standard prices |
| **Reports** | Period summaries with expense breakdown and exports |
| **Users** | Create and view team members (admin only) |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Backend | Firebase Authentication (email/password) |
| Database | Cloud Firestore (real-time listeners) |
| Charts | Recharts |
| PDF export | jsPDF + jspdf-autotable |

---

## Project structure

```
water-transport/
├── src/
│   ├── App.jsx          # Main app — all pages, services, and UI
│   ├── firebase.js      # Firebase initialization (reads from .env)
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── public/              # Static assets (favicon, icons)
├── .env.example         # Template for Firebase config (safe to commit)
├── .env                 # Your real Firebase keys (never commit this)
├── WaterTransportManager.jsx  # Standalone reference copy of the app
└── package.json
```

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

> **Important:** Never commit `.env` to git. It is listed in `.gitignore`. Only `.env.example` (with placeholders) belongs in the repository.

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
      allow create, update, delete: if isAuthed() && isAdmin();
    }
    match /locations/{locationId} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && isAdmin();
    }
    match /users/{userId} {
      allow read: if isAuthed();
      allow create: if isAuthed() && isAdmin();
      allow update: if isAuthed() && (request.auth.uid == userId || isAdmin());
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

## Firestore collections

| Collection | Documents | Key fields |
|------------|-----------|------------|
| `trips` | One per delivery run | `date`, `lorry`, `tripNumber`, `location`, `revenue`, `expenses`, `totalExpenses`, `profit`, `status` |
| `locations` | One per route | `name`, `revenue` |
| `users` | One per team member | `name`, `email`, `role` (`admin` or `viewer`) |

---

## Security notes

- Firebase config lives in `.env`, not in source code
- Restrict your Firebase API key in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to your app's domains
- Firestore rules enforce role-based write access — viewers cannot modify trips or locations
- Rotate API keys if they were ever committed to a public repository

---

## License

MIT — see [LICENSE](LICENSE).
