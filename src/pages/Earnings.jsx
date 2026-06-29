import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { earningsService } from "../services/earnings";
import { Badge, Modal, StatCard } from "../components/ui";
import { filterByRange, fmt, getMonthRange, getWeekRange, today } from "../utils/helpers";

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom Range" },
];

const STATUS_OPTIONS = ["Enabled", "Disabled"];

const toDateValue = (value) => value || "";

const buildRangeItems = (items, range, customStart, customEnd) => {
  if (range === "today") return filterByRange(items, today(), today());
  if (range === "week") {
    const [start, end] = getWeekRange();
    return filterByRange(items, start, end);
  }
  if (range === "month") {
    const [start, end] = getMonthRange();
    return filterByRange(items, start, end);
  }
  return filterByRange(items, customStart, customEnd);
};

const vehicleMetaForTrip = (trip, vehicles) => {
  const match = vehicles.find((vehicle) => vehicle.id === trip.vehicleId || vehicle.plate === trip.lorry);
  return {
    vehicleId: match?.id || trip.vehicleId || trip.lorry || "unknown",
    vehicleName: match?.name || match?.plate || trip.lorry || "Unknown Vehicle",
    vehiclePlate: match?.plate || trip.lorry || "N/A",
  };
};

const buildCommissionRecords = (trips, vehicles, config) => {
  const amount = Number(config?.dailyCommissionAmount ?? config?.ratePerTrip ?? 200);
  const enabled = (config?.commissionStatus || "Enabled") === "Enabled";
  const effectiveDate = toDateValue(config?.effectiveDate);
  const groups = new Map();

  trips.forEach((trip) => {
    if (!trip?.date || !trip?.lorry) return;
    if (effectiveDate && trip.date < effectiveDate) return;
    const vehicle = vehicleMetaForTrip(trip, vehicles);
    const key = `${vehicle.vehicleId}_${trip.date}`;
    const current = groups.get(key) || {
      id: key,
      date: trip.date,
      vehicleId: vehicle.vehicleId,
      vehicleName: vehicle.vehicleName,
      vehiclePlate: vehicle.vehiclePlate,
      numberOfTrips: 0,
      numberOfPaidTrips: 0,
      commissionAmount: enabled ? amount : 0,
      status: "Pending",
      createdAt: trip.createdAt || null,
      updatedAt: trip.updatedAt || trip.createdAt || null,
      trips: [],
    };

    current.numberOfTrips += 1;
    if (trip.status === "Paid") current.numberOfPaidTrips += 1;
    current.status = enabled && current.numberOfPaidTrips > 0 ? "Earned" : "Pending";
    current.trips.push(trip);
    groups.set(key, current);
  });

  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || a.vehiclePlate.localeCompare(b.vehiclePlate));
};

const buildTrend = (records) => {
  const months = new Map();
  records.forEach((record) => {
    const month = record.date.slice(0, 7);
    const current = months.get(month) || { label: month, earned: 0, pending: 0 };
    if (record.status === "Earned") current.earned += record.commissionAmount;
    else current.pending += record.commissionAmount;
    months.set(month, current);
  });
  return [...months.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(-6);
};

function CommissionSettingsCard({ config, isAdmin, onEdit }) {
  const amount = Number(config?.dailyCommissionAmount ?? config?.ratePerTrip ?? 200);
  const status = config?.commissionStatus || "Enabled";

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Manager Commission Settings</p>
          <h3 className="mt-1 text-lg font-black text-slate-800">{fmt(amount)} per vehicle per paid day</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={status === "Enabled" ? "green" : "red"}>{status}</Badge>
            {config?.effectiveDate && <Badge color="slate">Effective {config.effectiveDate}</Badge>}
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            Edit
          </button>
        )}
      </div>
      {config?.notes && <p className="mt-3 text-sm text-slate-500">{config.notes}</p>}
      <p className="mt-3 text-sm text-slate-500">
        A vehicle earns once per date when it has trips and at least one paid trip. Multiple paid trips on the same day still count once.
      </p>
    </div>
  );
}

export default function EarningsPage({
  trips = [],
  vehicles = [],
  earningsConfig = { dailyCommissionAmount: 200, commissionStatus: "Enabled" },
}) {
  const { isAdmin } = useAuth();
  const [range, setRange] = useState("month");
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());
  const [configOpen, setConfigOpen] = useState(false);
  const [amountDraft, setAmountDraft] = useState(earningsConfig?.dailyCommissionAmount ?? earningsConfig?.ratePerTrip ?? 200);
  const [statusDraft, setStatusDraft] = useState(earningsConfig?.commissionStatus || "Enabled");
  const [effectiveDateDraft, setEffectiveDateDraft] = useState(earningsConfig?.effectiveDate || today());
  const [notesDraft, setNotesDraft] = useState(earningsConfig?.notes || "");
  const [savingConfig, setSavingConfig] = useState(false);

  const commissionAmount = Number(earningsConfig?.dailyCommissionAmount ?? earningsConfig?.ratePerTrip ?? 200);
  const allRecords = useMemo(() => buildCommissionRecords(trips, vehicles, earningsConfig), [trips, vehicles, earningsConfig]);
  const periodRecords = useMemo(() => buildRangeItems(allRecords, range, customStart, customEnd), [allRecords, range, customStart, customEnd]);
  const earnedRecords = useMemo(() => periodRecords.filter((record) => record.status === "Earned"), [periodRecords]);
  const pendingRecords = useMemo(() => periodRecords.filter((record) => record.status !== "Earned"), [periodRecords]);

  useEffect(() => {
    queueMicrotask(() => {
      setAmountDraft(earningsConfig?.dailyCommissionAmount ?? earningsConfig?.ratePerTrip ?? 200);
      setStatusDraft(earningsConfig?.commissionStatus || "Enabled");
      setEffectiveDateDraft(earningsConfig?.effectiveDate || today());
      setNotesDraft(earningsConfig?.notes || "");
    });
  }, [earningsConfig]);

  const todayRecords = useMemo(() => filterByRange(allRecords, today(), today()), [allRecords]);
  const weekRecords = useMemo(() => {
    const [start, end] = getWeekRange();
    return filterByRange(allRecords, start, end);
  }, [allRecords]);
  const monthRecords = useMemo(() => {
    const [start, end] = getMonthRange();
    return filterByRange(allRecords, start, end);
  }, [allRecords]);

  const summary = useMemo(() => {
    const totalEarned = earnedRecords.reduce((sum, record) => sum + record.commissionAmount, 0);
    const pendingEarnings = pendingRecords.reduce((sum, record) => sum + record.commissionAmount, 0);
    const totalAllTime = allRecords
      .filter((record) => record.status === "Earned")
      .reduce((sum, record) => sum + record.commissionAmount, 0);
    const activeVehiclesToday = new Set(todayRecords.map((record) => record.vehicleId)).size;
    return {
      today: todayRecords.filter((record) => record.status === "Earned").reduce((sum, record) => sum + record.commissionAmount, 0),
      week: weekRecords.filter((record) => record.status === "Earned").reduce((sum, record) => sum + record.commissionAmount, 0),
      month: monthRecords.filter((record) => record.status === "Earned").reduce((sum, record) => sum + record.commissionAmount, 0),
      totalEarned,
      totalAllTime,
      activeVehiclesToday,
      pendingEarnings,
      earningDays: new Set(earnedRecords.map((record) => record.date)).size,
      averageDailyEarnings: earnedRecords.length > 0 ? totalEarned / new Set(earnedRecords.map((record) => record.date)).size : 0,
    };
  }, [allRecords, earnedRecords, monthRecords, pendingRecords, todayRecords, weekRecords]);

  const byVehicle = useMemo(() => {
    const map = new Map();
    periodRecords.forEach((record) => {
      const current = map.get(record.vehicleId) || {
        vehicleId: record.vehicleId,
        vehicleName: record.vehicleName,
        vehiclePlate: record.vehiclePlate,
        totalEarnings: 0,
        earningDays: 0,
        paidDays: 0,
        trips: 0,
        unpaidTrips: 0,
      };
      current.trips += record.numberOfTrips;
      current.unpaidTrips += Math.max(record.numberOfTrips - record.numberOfPaidTrips, 0);
      if (record.status === "Earned") {
        current.totalEarnings += record.commissionAmount;
        current.earningDays += 1;
        current.paidDays += 1;
      }
      map.set(record.vehicleId, current);
    });
    return [...map.values()].sort((a, b) => b.totalEarnings - a.totalEarnings || b.trips - a.trips);
  }, [periodRecords]);

  const byDate = useMemo(() => {
    const map = new Map();
    periodRecords.forEach((record) => {
      const current = map.get(record.date) || { date: record.date, total: 0, vehicles: 0, pending: 0 };
      if (record.status === "Earned") current.total += record.commissionAmount;
      else current.pending += record.commissionAmount;
      current.vehicles += 1;
      map.set(record.date, current);
    });
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [periodRecords]);

  const trendData = useMemo(() => buildTrend(allRecords), [allRecords]);

  const handleSaveConfig = async () => {
    if (amountDraft === "" || Number(amountDraft) <= 0) {
      alert("Enter a valid daily commission amount.");
      return;
    }
    setSavingConfig(true);
    try {
      await earningsService.updateConfig({
        dailyCommissionAmount: Number(amountDraft),
        ratePerTrip: Number(amountDraft),
        commissionStatus: statusDraft,
        effectiveDate: effectiveDateDraft || today(),
        notes: notesDraft.trim(),
      });
      setConfigOpen(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">Manager Earnings</h2>
          <p className="mt-1 text-sm text-slate-500">Daily commission is earned once per paid vehicle day.</p>
        </div>
        <Badge color={earningsConfig?.commissionStatus === "Disabled" ? "red" : "green"}>
          {earningsConfig?.commissionStatus || "Enabled"}
        </Badge>
      </div>

      <CommissionSettingsCard config={earningsConfig} isAdmin={isAdmin} onEdit={() => setConfigOpen(true)} />

      <div className="flex flex-wrap gap-2 mobile-control-rail">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${range === item.id ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">From</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">To</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mobile-card-rail mobile-card-rail--compact">
        <StatCard label="Today's Earnings" value={fmt(summary.today)} icon="KES" color="green" />
        <StatCard label="Weekly Earnings" value={fmt(summary.week)} icon="7d" color="blue" />
        <StatCard label="Monthly Earnings" value={fmt(summary.month)} icon="30d" color="slate" />
        <StatCard label="Total Earnings" value={fmt(summary.totalAllTime)} icon="Σ" color="green" />
        <StatCard label="Active Vehicles Today" value={summary.activeVehiclesToday} icon="V" color="blue" />
        <StatCard label="Pending Earnings" value={fmt(summary.pendingEarnings)} icon="..." color="amber" />
        <StatCard label="Earning Days" value={summary.earningDays} icon="D" color="slate" />
        <StatCard label="Avg Daily Earnings" value={fmt(summary.averageDailyEarnings)} icon="AVG" color="green" />
      </div>

      {pendingRecords.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Pending Earnings</p>
              <h3 className="mt-1 text-base font-black text-amber-900">Vehicles awaiting payment</h3>
            </div>
            <Badge color="amber">{pendingRecords.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingRecords.slice(0, 6).map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                <div>
                  <p className="font-bold text-slate-800">{record.vehiclePlate} - {record.vehicleName}</p>
                  <p className="text-xs text-slate-500">{record.date} · {record.numberOfTrips} trips · awaiting payment</p>
                </div>
                <span className="text-sm font-black text-amber-700">{fmt(record.commissionAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-bold text-slate-700">Earnings by Vehicle</p>
          <div className="space-y-3">
            {byVehicle.map((vehicle) => (
              <div key={vehicle.vehicleId} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800">{vehicle.vehiclePlate}</p>
                    <p className="text-xs text-slate-500">{vehicle.vehicleName}</p>
                  </div>
                  <span className="font-black text-emerald-700">{fmt(vehicle.totalEarnings)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>{vehicle.earningDays} earning days</span>
                  <span>{vehicle.paidDays} paid days</span>
                  <span>{vehicle.unpaidTrips} unpaid trips</span>
                </div>
              </div>
            ))}
            {byVehicle.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No vehicle earnings in this period</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-bold text-slate-700">Earnings by Date</p>
          <div className="space-y-2">
            {byDate.slice(0, 10).map((item) => (
              <div key={item.date} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-bold text-slate-800">{item.date}</p>
                  <p className="text-xs text-slate-500">{item.vehicles} vehicle days</p>
                </div>
                <span className="font-black text-slate-800">{fmt(item.total)}</span>
              </div>
            ))}
            {byDate.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No date earnings in this period</p>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-700">Earnings History</h3>
        </div>
        <div className="table-scroll-container">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-white">
              <tr className="border-b border-slate-100">
                {["Date", "Vehicle", "Total Trips", "Paid Trips", "Commission Amount", "Status"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">No earnings records in this period</td>
                </tr>
              ) : periodRecords.map((record) => (
                <tr key={record.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-700">{record.date}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-800">{record.vehiclePlate}</p>
                      <p className="text-xs text-slate-400">{record.vehicleName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{record.numberOfTrips}</td>
                  <td className="px-4 py-3">{record.numberOfPaidTrips}</td>
                  <td className="px-4 py-3 font-black text-emerald-700">{fmt(record.commissionAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge color={record.status === "Earned" ? "green" : "amber"}>{record.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-700">Monthly Earnings Trends</h3>
          <Badge color="slate">Last 6 months</Badge>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => fmt(value).replace("KES ", "")} />
              <Tooltip formatter={(value, name) => [fmt(value), name]} />
              <Bar dataKey="earned" fill="#059669" radius={[6, 6, 0, 0]} name="Earned" />
              <Bar dataKey="pending" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Manager Commission Settings">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Current commission</p>
            <p className="mt-1 text-lg font-black text-slate-800">{fmt(commissionAmount)} per vehicle per paid day</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Daily commission amount per vehicle</label>
            <input
              type="number"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Commission status</label>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Effective date</label>
            <input
              type="date"
              value={effectiveDateDraft}
              onChange={(e) => setEffectiveDateDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Notes</label>
            <textarea
              rows="3"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-3 mobile-action-stack sm:flex-row">
            <button onClick={() => setConfigOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveConfig} disabled={savingConfig} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {savingConfig ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
