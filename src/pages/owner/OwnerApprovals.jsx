import { useMemo } from "react";
import { fmt } from "../../utils/helpers";

export default function OwnerApprovalsPage({ trips }) {
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const pendingTrips = useMemo(() =>
    trips.filter(t => t.approvalStatus === "pending" || t.approvalStatus === "pending_edit")
      .sort((a, b) => (a.date || "").localeCompare(b.date || "")), // oldest first
    [trips]
  );

  const recentlyApproved = useMemo(() =>
    trips.filter(t => t.approvalStatus === "approved" && t.date >= sevenDaysAgo)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [trips, sevenDaysAgo]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Approvals Monitor</h2>
        <p className="text-sm text-slate-500">Read-only view of pending and recently approved trips.</p>
      </div>

      {/* Pending Trips */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <span className="text-amber-500">⏳</span>
          <h3 className="font-bold text-slate-800">Awaiting Approval</h3>
          {pendingTrips.length > 0 && (
            <span className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-xs font-black">
              {pendingTrips.length}
            </span>
          )}
        </div>
        {pendingTrips.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Trip #</th>
                  <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Lorry</th>
                  <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Destination</th>
                  <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Driver</th>
                  <th className="px-5 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Revenue</th>
                  <th className="px-5 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingTrips.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-700">{t.tripNumber || t.id.slice(0, 6)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{t.lorry}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{t.locationName || "—"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{t.driverName || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600">{fmt(t.revenue)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-xs">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-slate-500 font-semibold">No trips awaiting approval.</p>
          </div>
        )}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-400 italic">Approval is handled by admin. This is a monitoring view only.</p>
        </div>
      </div>

      {/* Recently Approved */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <span className="text-emerald-500">✅</span>
          <h3 className="font-bold text-slate-800">Recently Approved (Last 7 Days)</h3>
          {recentlyApproved.length > 0 && (
            <span className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">
              {recentlyApproved.length}
            </span>
          )}
        </div>
        {recentlyApproved.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Trip #</th>
                  <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Lorry</th>
                  <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Destination</th>
                  <th className="px-5 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Revenue</th>
                  <th className="px-5 py-3 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentlyApproved.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-700">{t.tripNumber || t.id.slice(0, 6)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{t.lorry}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{t.locationName || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600">{fmt(t.revenue)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-xs">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-slate-400 text-sm">No trips approved in the last 7 days.</p>
          </div>
        )}
      </div>
    </div>
  );
}
