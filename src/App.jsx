import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { tripService } from "./services/trips";
import { locationService } from "./services/locations";
import { vehicleService } from "./services/vehicles";
import { personnelService } from "./services/personnel";
import { maintenanceService } from "./services/maintenance";
import { settingsService } from "./services/settings";
import { complaintService } from "./services/complaints";
import { loanService } from "./services/loans";
import { earningsService } from "./services/earnings";
import { brokerService } from "./services/brokers";
import { Badge, Modal } from "./components/ui";
import TripReviewModal from "./components/TripReviewModal";
import TripForm from "./components/TripForm";

import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import TripsPage from "./pages/Trips";
import LocationsPage from "./pages/Locations";
import ReportsPage from "./pages/Reports";
import LoansPage from "./pages/Loans";
import EarningsPage from "./pages/Earnings";
import BackupPage from "./pages/Backup";
import UsersPage from "./pages/Users";
import VehiclesPage from "./pages/Vehicles";
import PersonnelPage from "./pages/Personnel";
import BrokerAccountPage from "./pages/BrokerAccount";
import BrokerReconciliationPage from "./pages/BrokerReconciliation";
import PersonnelAccountPage from "./pages/PersonnelAccount";
import MaintenancePage from "./pages/Maintenance";
import SettingsPage from "./pages/Settings";
import BrokersPage from "./pages/Brokers";

import "./App.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊", group: "Dashboard" },
  { id: "trips", label: "Trips", icon: "🚛", group: "Operations" },
  { id: "locations", label: "Locations", icon: "📍", group: "Operations" },
  { id: "vehicles", label: "Vehicles", icon: "🚚", group: "Operations" },
  { id: "maintenance", label: "Maintenance", icon: "🔧", adminOnly: true, group: "Operations" },
  
  { id: "broker-account", label: "Broker Ledger", icon: "🏢", roleAccess: ["admin", "owner", "broker"], group: "Finance" },
  { id: "broker-reconcile", label: "Close Period", icon: "✔️", roleAccess: ["admin", "owner"], group: "Finance" },
  { id: "loans", label: "Loans", icon: "💸", group: "Finance" },
  { id: "earnings", label: "Earnings", icon: "💵", adminOnly: true, group: "Finance" },
  { id: "reports", label: "Reports", icon: "📄", group: "Finance" },

  { id: "personnel", label: "Personnel", icon: "👤", adminOnly: true, group: "Team & Contacts" },
  { id: "brokers", label: "Brokers", icon: "🤝", adminOnly: true, group: "Team & Contacts" },
  { id: "users", label: "Users", icon: "👥", adminOnly: true, group: "Team & Contacts" },
  { id: "personnel-account", label: "My Account", icon: "💳", roleAccess: ["admin", "owner", "driver", "conductor"], group: "Team & Contacts" },

  { id: "settings", label: "Settings", icon: "⚙️", adminOnly: true, group: "System" },
  { id: "backup", label: "Backup", icon: "💾", adminOnly: true, group: "System" },
];

const ROUTE_BY_PATH = NAV_ITEMS.reduce((routes, item) => {
  routes[`/${item.id}`] = item.id;
  return routes;
}, { "/": "dashboard", "/dashboard": "dashboard" });

const getPageFromPath = () => {
  const normalized = window.location.pathname.replace(/\/+$/, "") || "/";
  return ROUTE_BY_PATH[normalized.toLowerCase()] || "dashboard";
};

const getPathForPage = (page) => (page === "dashboard" ? "/" : `/${page}`);

function Layout({ trips, locations, vehicles, personnel, maintenance, settings, complaints, loans, earningsConfig, brokers = [], refreshTrips }) {
  const { user, profile, logout, isAdmin, isOwner, isPrivileged, personnelId } = useAuth();
  const [page, setPage] = useState(getPageFromPath);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reviewTrip, setReviewTrip] = useState(null);
  const [tripEditTrip, setTripEditTrip] = useState(null);

  const [globalVehicle, setGlobalVehicle] = useState(() => {
    return localStorage.getItem("wt_global_vehicle") || "all";
  });
  const handleSetGlobalVehicle = useCallback((v) => {
    setGlobalVehicle(v);
    localStorage.setItem("wt_global_vehicle", v);
  }, []);

  const navigateToPage = useCallback((nextPage, { replace = false } = {}) => {
    const path = getPathForPage(nextPage);
    setPage(nextPage);
    if (window.location.pathname !== path) {
      window.history[replace ? "replaceState" : "pushState"](null, "", path);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => setPage(getPageFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Count trips pending admin approval
  const pendingCount = isPrivileged
    ? trips.filter(t => t.approvalStatus === "pending" || t.approvalStatus === "pending_edit").length
    : 0;

  // Browser notification when new pending trips arrive
  const prevPendingRef = useRef(pendingCount);
  useEffect(() => {
    if (!isPrivileged) return;
    // Request permission once
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
    // Fire notification if count increased
    if (pendingCount > prevPendingRef.current && Notification.permission === "granted") {
      const pendingLabel = isAdmin ? "awaiting your approval" : "available to review";
      new Notification("Mount Kenya Water Distributors", {
        body: `${pendingCount} trip${pendingCount > 1 ? "s" : ""} ${pendingLabel}.`,
        icon: "/favicon.svg",
      });
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, isPrivileged]);

  const navItems = NAV_ITEMS.filter(n => {
    if (n.adminOnly) return isAdmin;
    if (n.roleAccess) return n.roleAccess.includes(profile?.role);
    return true;
  });
  const activePage = navItems.some(n => n.id === page) ? page : "dashboard";
  const activeNavItem = navItems.find(n => n.id === activePage) || navItems[0];
  const primaryMobileIds = new Set(["dashboard", "trips", "reports"]);
  const mobileNavItems = navItems.filter(n => primaryMobileIds.has(n.id));
  const hasHiddenActivePage = !primaryMobileIds.has(activePage);

  const toggleGroup = (group) => {
    // Legacy function, replaced by navigateToPage for tabs
  };

  const groupedNavItems = useMemo(() => {
    // We want to maintain a specific group order, e.g., Dashboard, Operations, Finance, Team, System
    const order = ["Dashboard", "Operations", "Finance", "Team & Contacts", "System"];
    const groups = navItems.reduce((acc, item) => {
      const g = item.group || "Other";
      if (!acc[g]) acc[g] = [];
      acc[g].push(item);
      return acc;
    }, {});
    
    // Sort keys based on `order`
    return Object.keys(groups)
      .sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      })
      .map(key => ({ group: key, items: groups[key] }));
  }, [navItems]);

  const openTripReview = useCallback((trip, editMode = false) => {
    if (editMode) {
      setTripEditTrip(trip);
      setReviewTrip(null);
      return;
    }
    setReviewTrip(trip);
  }, []);

  const handleMarkTripPaid = useCallback(async (trip) => {
    if (!trip) return;
    await tripService.markPaid(trip.id, Number(trip.revenue || 0), "Paid");
    if (refreshTrips) refreshTrips();
  }, [refreshTrips]);

  const handleSaveTripEdit = useCallback(async (form) => {
    if (!tripEditTrip) return;
    await tripService.update(tripEditTrip.id, form, {
      isAdmin,
      directApproval: settings?.directApproval,
      isPending: tripEditTrip?.approvalStatus === "pending",
      earningsRate: tripEditTrip?.earningsRate ?? tripEditTrip?.earningsAmount ?? earningsConfig?.ratePerTrip,
    });
    if (refreshTrips) refreshTrips();
  }, [earningsConfig?.ratePerTrip, isAdmin, settings?.directApproval, tripEditTrip, refreshTrips]);

  useEffect(() => {
    if (page !== activePage) {
      navigateToPage(activePage, { replace: true });
    }
  }, [activePage, navigateToPage, page]);

  const pages = {
    dashboard: (
        <DashboardPage
          trips={trips}
          vehicles={vehicles}
          settings={settings}
          earningsConfig={earningsConfig}
          onOpenTripReview={openTripReview}
          onMarkTripPaid={handleMarkTripPaid}
          onGoToTrips={() => navigateToPage("trips")}
          globalVehicle={globalVehicle}
          setGlobalVehicle={handleSetGlobalVehicle}
        />
      ),
    trips: <TripsPage trips={trips} locations={locations} vehicles={vehicles} personnel={personnel} settings={settings} earningsConfig={earningsConfig} brokers={brokers} onOpenTripReview={openTripReview} refreshTrips={refreshTrips} globalVehicle={globalVehicle} setGlobalVehicle={handleSetGlobalVehicle} />,
    locations: <LocationsPage locations={locations} />,
    vehicles: <VehiclesPage vehicles={vehicles} trips={trips} locations={locations} personnel={personnel} brokers={brokers} earningsConfig={earningsConfig} onOpenTripReview={openTripReview} />,
    personnel: <PersonnelPage personnel={personnel} trips={trips} />,
    "broker-account": <BrokerAccountPage isAdmin={isAdmin} brokers={brokers} vehicles={vehicles} trips={trips} globalVehicle={globalVehicle} setGlobalVehicle={handleSetGlobalVehicle} />,
    "broker-reconcile": <BrokerReconciliationPage brokers={brokers} />,
    "personnel-account": <PersonnelAccountPage isAdmin={isAdmin} personnelId={personnelId} personnelList={personnel} />,
    maintenance: <MaintenancePage maintenance={maintenance} vehicles={vehicles} />,
    reports: <ReportsPage trips={trips} vehicles={vehicles} complaints={complaints} globalVehicle={globalVehicle} setGlobalVehicle={handleSetGlobalVehicle} />,
    loans: <LoansPage loans={loans} onOpenTripReview={openTripReview} />,
    earnings: <EarningsPage trips={trips} vehicles={vehicles} earningsConfig={earningsConfig} onOpenTripReview={openTripReview} onMarkTripPaid={handleMarkTripPaid} />,
    backup: <BackupPage trips={trips} locations={locations} vehicles={vehicles} personnel={personnel} maintenance={maintenance} loans={loans} complaints={complaints} settings={settings} earningsConfig={earningsConfig} />,
    settings: <SettingsPage settings={settings} />,
    users: <UsersPage personnel={personnel} />,
    brokers: <BrokersPage brokers={brokers} />
  };

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-clip bg-slate-50 flex">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar / Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-white border-r border-slate-100 shadow-2xl lg:shadow-sm transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-xl shadow">🚛</div>
            <div>
              <p className="text-xs font-black text-slate-800 leading-tight">Mount Kenya Water Distributors</p>
              <p className="text-xs text-slate-400">Manager</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Active Vehicle</label>
            <div className="relative">
              <select
                value={globalVehicle}
                onChange={(e) => handleSetGlobalVehicle(e.target.value)}
                className="w-full appearance-none rounded-xl bg-slate-50 border border-slate-200 pl-3 pr-8 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              >
                <option value="all">All Vehicles</option>
                {vehicles?.map(v => <option key={v.id} value={v.plate}>{v.plate}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {groupedNavItems.map(({ group, items }) => {
            const isActiveGroup = activeNavItem?.group === group;
            
            // Define icons for the groups
            const groupIcons = {
              "Dashboard": "📊",
              "Operations": "🚛",
              "Finance": "💵",
              "Team & Contacts": "👥",
              "System": "⚙️"
            };
            const icon = groupIcons[group] || "📌";

            return (
              <button key={group} 
                onClick={() => { 
                   // Navigate to the first item in this group
                   navigateToPage(items[0].id);
                   setMobileMenuOpen(false); 
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActiveGroup
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}>
                <span className={isActiveGroup ? "text-emerald-100 text-lg" : "text-slate-400 text-lg"}>{icon}</span>
                <span className="flex-1 text-left tracking-wide">{group}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
              {profile?.name?.charAt(0) || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{profile?.name}</p>
              <p className="text-[10px] text-slate-400 truncate mb-1">{user?.email}</p>
              <Badge color={isAdmin ? "green" : isOwner ? "blue" : "slate"}>{profile?.role}</Badge>
            </div>
          </div>
          <button onClick={logout}
            className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition-colors">
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 lg:ml-64 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-20 flex flex-col min-w-0 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex min-w-0 items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="p-1 -ml-1 text-slate-500 hover:text-slate-800 focus:outline-none">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-xl">🚛</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black leading-tight text-slate-800">Mount Kenya Water Distributors</p>
                    <p className="truncate text-[11px] text-slate-500">{activeNavItem?.label || "Dashboard"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge color={isAdmin ? "green" : isOwner ? "blue" : "slate"}>{profile?.role}</Badge>
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-rose-500 text-white text-xs font-black">
                  {pendingCount}
                </span>
              )}
            </div>
          </div>
          <div className="px-4 pb-3 border-t border-slate-50 pt-2 flex items-center gap-3 bg-slate-50/50">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Vehicle</span>
            <div className="relative flex-1">
              <select
                value={globalVehicle}
                onChange={(e) => handleSetGlobalVehicle(e.target.value)}
                className="w-full appearance-none rounded-lg bg-white border border-slate-200 pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
              >
                <option value="all">All Vehicles</option>
                {vehicles?.map(v => <option key={v.id} value={v.plate}>{v.plate}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </header>

        {/* Horizontal Sub-Nav Tabs */}
        {activeNavItem && activeNavItem.group !== "Dashboard" && (
          <div className="bg-white border-b border-slate-200 w-full shadow-sm sticky top-[68px] lg:top-0 z-10">
            <div className="max-w-5xl mx-auto px-3 lg:px-8 flex gap-6 overflow-x-auto hide-scrollbar">
              {groupedNavItems.find(g => g.group === activeNavItem.group)?.items.map(n => {
                const isActive = activePage === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => navigateToPage(n.id)}
                    className={`whitespace-nowrap py-3 lg:py-4 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
                      isActive 
                        ? "border-emerald-500 text-emerald-700" 
                        : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="opacity-70">{n.icon}</span>
                    {n.label}
                    {n.id === "trips" && pendingCount > 0 && (
                      <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-[10px] font-black ${
                        isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                      }`}>
                        {pendingCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 w-full p-3 lg:p-8 pb-24 lg:pb-8">
          <div className="w-full min-w-0 max-w-5xl mx-auto">
            {pages[activePage] || pages.dashboard}
          </div>
        </main>

        <TripReviewModal
          open={!!reviewTrip}
          trip={reviewTrip}
          ratePerTrip={earningsConfig?.ratePerTrip || 200}
          onClose={() => setReviewTrip(null)}
          onMarkPaid={isAdmin ? handleMarkTripPaid : undefined}
          onEditTrip={isAdmin ? (trip) => openTripReview(trip, true) : undefined}
          brokers={brokers}
        />

        <Modal open={!!tripEditTrip} onClose={() => setTripEditTrip(null)} title="Edit Trip" wide>
          {tripEditTrip && (
            <TripForm
              initial={tripEditTrip}
              locations={locations}
              personnel={personnel}
              brokers={brokers}
              vehicles={vehicles}
              onSave={handleSaveTripEdit}
              onCancel={() => setTripEditTrip(null)}
            />
          )}
        </Modal>

        <nav className="mobile-bottom-nav lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {mobileNavItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigateToPage(item.id)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition-colors ${activePage === item.id ? "text-emerald-700" : "text-slate-500"}`}
                aria-current={activePage === item.id ? "page" : undefined}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors ${activePage === item.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {item.icon}
                </span>
                <span className="truncate leading-none">{item.label}</span>
              </button>
            ))}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition-colors ${hasHiddenActivePage ? "text-emerald-700" : "text-slate-500"}`}
              aria-label="Open more navigation"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors ${hasHiddenActivePage ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                ☰
              </span>
              <span className="truncate leading-none">More</span>
            </button>
          </div>
        </nav>

        {/* Footer */}
        <footer className="hidden lg:block border-t border-slate-100 px-8 py-3 text-center text-[11px] text-slate-400">
          Designed by{" "}
          <span className="font-semibold text-emerald-600">Cyber Vision Lab</span>
        </footer>
      </div>
    </div>
  );
}

function AppInner() {
  const { user, loading, isPrivileged, personnelId } = useAuth();
  const [rawTrips, setRawTrips] = useState([]);
  const [locations, setLocations] = useState([]);
  const [rawVehicles, setRawVehicles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [settings, setSettings] = useState({ directApproval: false });
  const [complaints, setComplaints] = useState([]);
  const [loans, setLoans] = useState([]);
  const [earningsConfig, setEarningsConfig] = useState({ ratePerTrip: 200, dailyCommissionAmount: 200, commissionStatus: "Enabled" });
  const [brokers, setBrokers] = useState([]);

  // Manual refresh — called right after add/delete/approve so UI updates instantly
  const refreshTrips = useCallback(async () => {
    const data = await tripService.fetchAll();
    setRawTrips(data);
  }, []);

  useEffect(() => {
    if (!user) {
      setRawTrips([]);
      setLocations([]);
      setRawVehicles([]);
      setPersonnel([]);
      setMaintenance([]);
      setSettings({ directApproval: false });
      setComplaints([]);
      setLoans([]);
      setEarningsConfig({ ratePerTrip: 200, dailyCommissionAmount: 200, commissionStatus: "Enabled" });
      setBrokers([]);
      return;
    }

    const unsubTrips = tripService.subscribe(setRawTrips, refreshTrips);
    const unsubLocs = locationService.subscribe(setLocations);
    const unsubVehs = vehicleService.subscribe(setRawVehicles);
    const unsubPersonnel = personnelService.subscribe(setPersonnel);
    const unsubMaintenance = maintenanceService.subscribe(setMaintenance);
    const unsubSettings = settingsService.subscribe(setSettings);
    const unsubComplaints = complaintService.subscribe(setComplaints);
    const unsubLoans = loanService.subscribe(setLoans);
    const unsubEarnings = earningsService.subscribeConfig(setEarningsConfig);
    const unsubBrokers = brokerService.subscribeBrokers(setBrokers);
    
    return () => {
      unsubTrips();
      unsubLocs();
      unsubVehs();
      unsubPersonnel();
      unsubMaintenance();
      if (unsubSettings) unsubSettings();
      if (unsubComplaints) unsubComplaints();
      if (unsubLoans) unsubLoans();
      if (unsubEarnings) unsubEarnings();
      if (unsubBrokers) unsubBrokers();
    };
  }, [user, refreshTrips]);

  // Data Isolation for non-admins
  const trips = useMemo(() => {
    if (!user) return [];
    if (isPrivileged) return rawTrips;
    return rawTrips.filter(t => t.driverId === personnelId || t.conductorId === personnelId || t.submittedBy === user.uid);
  }, [rawTrips, isPrivileged, personnelId, user?.uid]);

  const vehicles = useMemo(() => {
    if (!user) return [];
    if (isPrivileged) return rawVehicles;
    // Driver can see all vehicles in dropdown for TripForm, so we shouldn't filter vehicles too aggressively, 
    // but the VehiclesPage is adminOnly anyway. We will pass all rawVehicles to allow them to select lorries.
    return rawVehicles; 
  }, [rawVehicles, isPrivileged]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🚛</div>
        <p className="text-slate-500 font-semibold">Loading…</p>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;
  return <Layout trips={trips} locations={locations} vehicles={vehicles} personnel={personnel} maintenance={maintenance} settings={settings} complaints={complaints} loans={loans} earningsConfig={earningsConfig} brokers={brokers} refreshTrips={refreshTrips} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
