import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { tripService } from "./services/trips";
import { locationService } from "./services/locations";
import { Badge } from "./components/ui";

import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import TripsPage from "./pages/Trips";
import LocationsPage from "./pages/Locations";
import ReportsPage from "./pages/Reports";
import UsersPage from "./pages/Users";

import "./App.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "trips", label: "Trips", icon: "🚛" },
  { id: "locations", label: "Locations", icon: "📍" },
  { id: "reports", label: "Reports", icon: "📄" },
  { id: "users", label: "Users", icon: "👥", adminOnly: true },
];

function Layout({ trips, locations }) {
  const { profile, logout, isAdmin } = useAuth();
  const [page, setPage] = useState("dashboard");

  const navItems = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin);
  const pages = {
    dashboard: <DashboardPage trips={trips} />,
    trips: <TripsPage trips={trips} locations={locations} />,
    locations: <LocationsPage locations={locations} />,
    reports: <ReportsPage trips={trips} />,
    users: <UsersPage />
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-slate-100 shadow-sm fixed inset-y-0 left-0 z-20">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-xl shadow">🚛</div>
            <div>
              <p className="text-sm font-black text-slate-800 leading-tight">Water Transport</p>
              <p className="text-xs text-slate-400">Manager</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${page === n.id ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-slate-600 hover:bg-slate-50"
                }`}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
              {profile?.name?.charAt(0) || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{profile?.name}</p>
              <Badge color={isAdmin ? "green" : "slate"}>{profile?.role}</Badge>
            </div>
          </div>
          <button onClick={logout}
            className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition-colors">
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-100 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚛</span>
            <span className="font-black text-slate-800 text-sm">Water Transport</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={isAdmin ? "green" : "slate"}>{profile?.role}</Badge>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-rose-500 font-semibold">Sign Out</button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-5xl mx-auto">
            {pages[page] || pages.dashboard}
          </div>
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-lg z-20">
          <div className="flex">
            {navItems.map(n => (
              <button key={n.id} onClick={() => setPage(n.id)}
                className={`flex-1 flex flex-col items-center py-2.5 text-xs font-semibold transition-colors ${page === n.id ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
                  }`}>
                <span className="text-xl mb-0.5">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsubTrips = tripService.subscribe(setTrips);
    const unsubLocs = locationService.subscribe(setLocations);
    return () => {
      unsubTrips();
      unsubLocs();
    };
  }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🚛</div>
        <p className="text-slate-500 font-semibold">Loading…</p>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;
  return <Layout trips={trips} locations={locations} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
