import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { tripService } from "./services/trips";
import { locationService } from "./services/locations";
import { vehicleService } from "./services/vehicles";
import { personnelService } from "./services/personnel";
import { maintenanceService } from "./services/maintenance";
import { Badge } from "./components/ui";

import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import TripsPage from "./pages/Trips";
import LocationsPage from "./pages/Locations";
import ReportsPage from "./pages/Reports";
import UsersPage from "./pages/Users";
import VehiclesPage from "./pages/Vehicles";
import PersonnelPage from "./pages/Personnel";
import MaintenancePage from "./pages/Maintenance";

import "./App.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "trips", label: "Trips", icon: "🚛" },
  { id: "locations", label: "Locations", icon: "📍" },
  { id: "vehicles", label: "Vehicles", icon: "🚚", adminOnly: true },
  { id: "personnel", label: "Personnel", icon: "👤", adminOnly: true },
  { id: "maintenance", label: "Maintenance", icon: "🔧", adminOnly: true },
  { id: "reports", label: "Reports", icon: "📄" },
  { id: "users", label: "Users", icon: "👥", adminOnly: true },
];

function Layout({ trips, locations, vehicles, personnel, maintenance }) {
  const { profile, logout, isAdmin } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin);
  const pages = {
    dashboard: <DashboardPage trips={trips} vehicles={vehicles} />,
    trips: <TripsPage trips={trips} locations={locations} vehicles={vehicles} personnel={personnel} />,
    locations: <LocationsPage locations={locations} />,
    vehicles: <VehiclesPage vehicles={vehicles} trips={trips} />,
    personnel: <PersonnelPage personnel={personnel} trips={trips} />,
    maintenance: <MaintenancePage maintenance={maintenance} vehicles={vehicles} />,
    reports: <ReportsPage trips={trips} vehicles={vehicles} />,
    users: <UsersPage />
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar / Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-100 shadow-2xl lg:shadow-sm transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
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
            <button key={n.id} onClick={() => { setPage(n.id); setMobileMenuOpen(false); }}
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

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between bg-white border-b border-slate-100 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="p-1 -ml-1 text-slate-500 hover:text-slate-800 focus:outline-none">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">🚛</span>
              <span className="font-black text-slate-800 text-sm">Water Transport</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={isAdmin ? "green" : "slate"}>{profile?.role}</Badge>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-8">
          <div className="max-w-5xl mx-auto">
            {pages[page] || pages.dashboard}
          </div>
        </main>
      </div>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState([]);
  const [locations, setLocations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [maintenance, setMaintenance] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsubTrips = tripService.subscribe(setTrips);
    const unsubLocs = locationService.subscribe(setLocations);
    const unsubVehs = vehicleService.subscribe(setVehicles);
    const unsubPersonnel = personnelService.subscribe(setPersonnel);
    const unsubMaintenance = maintenanceService.subscribe(setMaintenance);
    
    return () => {
      unsubTrips();
      unsubLocs();
      unsubVehs();
      unsubPersonnel();
      unsubMaintenance();
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
  return <Layout trips={trips} locations={locations} vehicles={vehicles} personnel={personnel} maintenance={maintenance} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
