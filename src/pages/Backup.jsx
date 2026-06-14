import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Badge } from "../components/ui";
import { fmt } from "../utils/helpers";

const downloadJson = (payload, filename) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function BackupPage({ trips = [], locations = [], vehicles = [], personnel = [], maintenance = [], loans = [], complaints = [], settings = {}, earningsConfig = {} }) {
  const { isAdmin } = useAuth();

  const payload = useMemo(() => ({
    exportedAt: new Date().toISOString(),
    trips,
    locations,
    vehicles,
    personnel,
    maintenance,
    loans,
    complaints,
    settings,
    earningsConfig,
  }), [trips, locations, vehicles, personnel, maintenance, loans, complaints, settings, earningsConfig]);

  const summary = [
    { label: "Trips", value: trips.length, color: "blue" },
    { label: "Locations", value: locations.length, color: "green" },
    { label: "Vehicles", value: vehicles.length, color: "amber" },
    { label: "Loans", value: loans.length, color: "red" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">Backup</h2>
          <p className="mt-1 text-sm text-slate-500">Download the current in-app dataset as JSON.</p>
        </div>
        <Badge color={isAdmin ? "green" : "slate"}>{isAdmin ? "Admin" : "Read only"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mobile-card-rail mobile-card-rail--compact">
        {summary.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700">Export data</h3>
        <p className="mt-2 text-sm text-slate-500">
          This exports the collections currently loaded in the app. It is a quick backup for the records in view.
        </p>
        <button
          type="button"
          onClick={() => downloadJson(payload, `water-transport-backup-${new Date().toISOString().slice(0, 10)}.json`)}
          className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Download JSON Backup
        </button>
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
          Backup size grows with trips, loans, and complaints. Consider downloading it before major changes.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700">Snapshot</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-400">Trips total revenue</p>
            <p className="mt-1 text-lg font-black text-slate-800">{fmt(trips.reduce((sum, trip) => sum + Number(trip.revenue || 0), 0))}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-400">Outstanding loans</p>
            <p className="mt-1 text-lg font-black text-slate-800">{fmt(loans.reduce((sum, loan) => sum + Number(loan.balance || 0), 0))}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
