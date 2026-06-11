import { useMemo } from "react";
import { getMonthRange, filterByRange, sumExpenseKey } from "../../utils/helpers";

function AlertCard({ icon, title, desc, severity, isResolved = false }) {
  const colors = {
    Critical: isResolved ? "border-slate-200 bg-slate-50" : "border-rose-200 bg-rose-50",
    High: isResolved ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50",
    Medium: isResolved ? "border-slate-200 bg-slate-50" : "border-blue-100 bg-blue-50",
  };
  const textColors = {
    Critical: isResolved ? "text-slate-500" : "text-rose-700",
    High: isResolved ? "text-slate-500" : "text-amber-700",
    Medium: isResolved ? "text-slate-500" : "text-blue-700",
  };
  const badgeColors = {
    Critical: isResolved ? "bg-slate-200 text-slate-500" : "bg-rose-100 text-rose-700",
    High: isResolved ? "bg-slate-200 text-slate-500" : "bg-amber-100 text-amber-700",
    Medium: isResolved ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-blue-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[severity] || colors.Medium} ${isResolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-bold text-sm ${textColors[severity] || textColors.Medium}`}>{title}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeColors[severity] || badgeColors.Medium}`}>
              {isResolved ? "Resolved" : severity}
            </span>
          </div>
          <p className={`text-xs ${isResolved ? 'text-slate-400' : 'text-slate-600'}`}>{desc}</p>
        </div>
      </div>
    </div>
  );
}

export default function OwnerAlertsPage({ trips, vehicles, targets }) {
  const [monthStart, monthEnd] = getMonthRange();
  const currentMonthStr = monthStart.slice(0, 7);

  const monthTrips = useMemo(() => filterByRange(trips, monthStart, monthEnd), [trips, monthStart, monthEnd]);

  const d = new Date();
  const daysLeft = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();

  // Compute week date range
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekTrips = useMemo(() => trips.filter(t => t.date >= weekStartStr), [trips, weekStartStr]);

  // Collection rate
  const totalMonthRev = monthTrips.reduce((s, t) => s + Number(t.revenue || 0), 0);
  const totalMonthPaid = monthTrips.reduce((s, t) => s + Number(t.amountPaid || 0), 0);
  const collectionRate = totalMonthRev > 0 ? (totalMonthPaid / totalMonthRev) * 100 : 100;

  // Build alerts
  const { activeAlerts, resolvedAlerts } = useMemo(() => {
    const active = [];
    const resolved = [];

    // 1. Idle Vehicle (no trips for 3+ consecutive days)
    vehicles.forEach(v => {
      const vTrips = trips.filter(t => t.lorry === v.plate).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const lastTrip = vTrips[0];
      const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().slice(0, 10);
      
      const isIdle = !lastTrip || lastTrip.date < threeDaysAgoStr;

      if (isIdle) {
        const idleDays = lastTrip ? Math.floor((new Date() - new Date(lastTrip.date)) / (1000 * 60 * 60 * 24)) : 0;
        active.push({
          icon: "🚛",
          title: `${v.plate} — Idle Vehicle`,
          desc: `${v.plate} has had no trips for ${idleDays} day${idleDays !== 1 ? "s" : ""}. Possible breakdown or unlogged trips.`,
          severity: "High"
        });
      } else {
        resolved.push({
          icon: "🚛",
          title: `${v.plate} — Vehicle Active`,
          desc: `${v.plate} last had a trip on ${lastTrip.date}. No longer idle.`,
          severity: "High"
        });
      }
    });

    // 2. Low Collection Rate (< 65%)
    if (collectionRate < 65) {
      active.push({
        icon: "💳",
        title: "Low Collection Rate",
        desc: `Only ${collectionRate.toFixed(1)}% of this month's revenue has been collected. Target is 65%.`,
        severity: "Critical"
      });
    } else {
      resolved.push({
        icon: "💳",
        title: "Collection Rate Normal",
        desc: `Collection rate is ${collectionRate.toFixed(1)}%, above the 65% threshold.`,
        severity: "Critical"
      });
    }

    // 3. Below Target (< 50% with > 10 days left)
    if (daysLeft > 10) {
      vehicles.forEach(v => {
        const tObj = targets.find(t => t.lorry === v.plate && t.month === currentMonthStr);
        if (!tObj || !tObj.target) return;
        const vMonthRev = monthTrips.filter(t => t.lorry === v.plate).reduce((s, t) => s + Number(t.revenue || 0), 0);
        const pct = (vMonthRev / tObj.target) * 100;

        if (pct < 50) {
          active.push({
            icon: "🎯",
            title: `${v.plate} — Below Target`,
            desc: `${v.plate} is at ${pct.toFixed(1)}% of its monthly target with ${daysLeft} days remaining. Action needed.`,
            severity: "High"
          });
        }
      });
    }

    // 4. Fuel Spike (diesel avg this week > 130% of monthly avg)
    vehicles.forEach(v => {
      const vMonthTrips = monthTrips.filter(t => t.lorry === v.plate);
      const vWeekTrips = weekTrips.filter(t => t.lorry === v.plate);

      if (vMonthTrips.length < 3 || vWeekTrips.length < 1) return;

      const monthDieselAvg = sumExpenseKey(vMonthTrips, "diesel", false) / vMonthTrips.length;
      const weekDieselAvg = sumExpenseKey(vWeekTrips, "diesel", false) / vWeekTrips.length;

      if (monthDieselAvg > 0 && weekDieselAvg > monthDieselAvg * 1.3) {
        active.push({
          icon: "⛽",
          title: `${v.plate} — Fuel Spike Detected`,
          desc: `${v.plate}'s diesel cost this week (avg KES ${weekDieselAvg.toFixed(0)}/trip) is >130% of its monthly average (KES ${monthDieselAvg.toFixed(0)}/trip).`,
          severity: "Medium"
        });
      }
    });

    // 5. Override Used (overrideReason present in last 7 days)
    const overrideTrips = weekTrips.filter(t => t.overrideReason);
    if (overrideTrips.length > 0) {
      active.push({
        icon: "⚠️",
        title: "Trip Limit Override Used",
        desc: `${overrideTrips.length} trip(s) in the last 7 days used the trip limit override. Review if authorised.`,
        severity: "Medium"
      });
    }

    return { activeAlerts: active, resolvedAlerts: resolved };
  }, [trips, vehicles, targets, monthTrips, weekTrips, collectionRate, currentMonthStr, daysLeft]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Alerts</h2>
        <p className="text-sm text-slate-500">Live business health alerts calculated from your trip data.</p>
      </div>

      {activeAlerts.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-10 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-bold text-emerald-800">All Clear!</p>
          <p className="text-sm text-emerald-600 mt-1">No active alerts. Everything looks good.</p>
        </div>
      )}

      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-rose-700 uppercase tracking-wider">
            🚨 Active Alerts ({activeAlerts.length})
          </h3>
          {activeAlerts.map((a, i) => (
            <AlertCard key={i} {...a} isResolved={false} />
          ))}
        </div>
      )}

      {resolvedAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">
            ✅ Resolved Conditions ({resolvedAlerts.length})
          </h3>
          {resolvedAlerts.map((a, i) => (
            <AlertCard key={i} {...a} isResolved={true} />
          ))}
        </div>
      )}
    </div>
  );
}
