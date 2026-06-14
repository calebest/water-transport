import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { earningsService } from "../services/earnings";
import { Badge, Modal, StatCard } from "../components/ui";
import TripReviewModal from "../components/TripReviewModal";
import { filterByRange, fmt, getMonthRange, getWeekRange, today } from "../utils/helpers";

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom Range" },
];

const LORRY_PLATES = ["KBZ", "KBL"];

const toNumber = (value) => Number(value || 0);

const buildRangeTrips = (trips, range, customStart, customEnd) => {
  if (range === "today") return filterByRange(trips, today(), today());
  if (range === "week") {
    const [start, end] = getWeekRange();
    return filterByRange(trips, start, end);
  }
  if (range === "month") {
    const [start, end] = getMonthRange();
    return filterByRange(trips, start, end);
  }
  return filterByRange(trips, customStart, customEnd);
};

const buildSeries = (trips, mode, ratePerTrip) => {
  const now = new Date();
  const periods = [];

  if (mode === "months") {
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-KE", { month: "short" });
      periods.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label, earned: 0, pending: 0 });
    }
    trips.forEach((trip) => {
      const date = new Date(trip.date);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = periods.find((item) => item.key === key);
      if (!bucket) return;
      const value = trip.status === "Paid" ? ratePerTrip : 0;
      bucket.earned += value;
      bucket.pending += trip.status === "Paid" ? 0 : ratePerTrip;
    });
    return periods;
  }

  for (let i = 7; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1 - (i * 7));
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    periods.push({
      key: d.toISOString().slice(0, 10),
      label: `${d.toISOString().slice(5, 10)}`,
      earned: 0,
      pending: 0,
      start: d.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }
  trips.forEach((trip) => {
    const entry = periods.find((item) => trip.date >= item.start && trip.date <= item.end);
    if (!entry) return;
    const value = trip.status === "Paid" ? ratePerTrip : 0;
    entry.earned += value;
    entry.pending += trip.status === "Paid" ? 0 : ratePerTrip;
  });
  return periods;
};

function ConfigCard({ ratePerTrip, isAdmin, onEdit }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Rate Config</p>
          <h3 className="mt-1 text-lg font-black text-slate-800">Current rate: {fmt(ratePerTrip)} per paid trip</h3>
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
      <p className="mt-3 text-sm text-slate-500">
        Earnings are calculated automatically from trip payment status. Only paid trips earn the configured rate.
      </p>
    </div>
  );
}

export default function EarningsPage({
  trips = [],
  earningsConfig = { ratePerTrip: 200 },
  onOpenTripReview,
  onMarkTripPaid,
}) {
  const { isAdmin } = useAuth();
  const [range, setRange] = useState("month");
  const [customStart, setCustomStart] = useState(today());
  const [customEnd, setCustomEnd] = useState(today());
  const [chartMode, setChartMode] = useState("weeks");
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [rateDraft, setRateDraft] = useState(earningsConfig?.ratePerTrip || 200);
  const [savingRate, setSavingRate] = useState(false);

  const ratePerTrip = Number(earningsConfig?.ratePerTrip || 200);

  useEffect(() => {
    setRateDraft(ratePerTrip);
  }, [ratePerTrip]);

  const periodTrips = useMemo(() => buildRangeTrips(trips, range, customStart, customEnd), [trips, range, customStart, customEnd]);

  const summary = useMemo(() => {
    const paidTrips = periodTrips.filter((trip) => trip.status === "Paid");
    const pendingTrips = periodTrips.filter((trip) => trip.status !== "Paid");
    return {
      totalEarned: paidTrips.length * ratePerTrip,
      pendingEarnings: pendingTrips.length * ratePerTrip,
      tripsThisPeriod: periodTrips.length,
      paidTripsThisPeriod: paidTrips.length,
    };
  }, [periodTrips, ratePerTrip]);

  const lorryCards = useMemo(() => LORRY_PLATES.map((plate) => {
    const tripsForPlate = periodTrips.filter((trip) => trip.lorry === plate);
    const paid = tripsForPlate.filter((trip) => trip.status === "Paid");
    const pending = tripsForPlate.filter((trip) => trip.status !== "Paid");
    return {
      plate,
      paidCount: paid.length,
      earned: paid.length * ratePerTrip,
      pendingCount: pending.length,
      pendingEarnings: pending.length * ratePerTrip,
    };
  }), [periodTrips, ratePerTrip]);

  const chartData = useMemo(() => buildSeries(trips, chartMode, ratePerTrip), [trips, chartMode, ratePerTrip]);
  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId) || null, [trips, selectedTripId]);

  const handleSaveRate = async () => {
    if (rateDraft === "" || Number(rateDraft) <= 0) {
      alert("Enter a valid rate.");
      return;
    }
    setSavingRate(true);
    try {
      await earningsService.updateConfig({ ratePerTrip: Number(rateDraft) });
      setConfigOpen(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800">Earnings</h2>
          <p className="mt-1 text-sm text-slate-500">Owner earnings are derived from paid trips only.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setChartMode("weeks")}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${chartMode === "weeks" ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            8 Weeks
          </button>
          <button
            type="button"
            onClick={() => setChartMode("months")}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${chartMode === "months" ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            6 Months
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mobile-card-rail mobile-card-rail--compact">
        <StatCard label="Total Earned" value={fmt(summary.totalEarned)} icon="💰" color="green" />
        <StatCard label="Pending Earnings" value={fmt(summary.pendingEarnings)} icon="⏳" color="amber" />
        <StatCard label="Trips This Period" value={summary.tripsThisPeriod} icon="🚚" color="blue" />
        <StatCard label="Paid Trips" value={summary.paidTripsThisPeriod} icon="✅" color="slate" />
      </div>

      <ConfigCard ratePerTrip={ratePerTrip} isAdmin={isAdmin} onEdit={() => setConfigOpen(true)} />

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {lorryCards.map((card) => (
          <div key={card.plate} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{card.plate}</p>
                <p className="mt-1 text-lg font-black text-slate-800">{fmt(card.earned)}</p>
              </div>
              <Badge color={card.pendingCount > 0 ? "amber" : "green"}>{card.pendingCount > 0 ? "Pending" : "Paid"}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Paid Trips</p>
                <p className="mt-1 font-black text-emerald-700">{card.paidCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Pending Trips</p>
                <p className="mt-1 font-black text-amber-700">{card.pendingCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Earned</p>
                <p className="mt-1 font-black text-slate-800">{fmt(card.earned)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-400">Pending Earnings</p>
                <p className="mt-1 font-black text-slate-800">{fmt(card.pendingEarnings)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="table-scroll-container">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-100">
                {["Date", "Lorry", "Trip #", "Destination", "Status", "Earnings", ""].map((head, index) => (
                  <th
                    key={head || index}
                    className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 ${index === 0 ? "sticky left-0 z-[3] bg-slate-50" : ""}`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">No trips found in this period</td>
                </tr>
              ) : periodTrips.map((trip) => (
                <tr
                  key={trip.id}
                  onClick={() => setSelectedTripId(trip.id)}
                  className="group cursor-pointer border-b border-slate-50 bg-white transition-colors hover:bg-slate-50"
                >
                  <td className="sticky left-0 z-[2] bg-white px-4 py-3 font-medium text-slate-700 group-hover:bg-slate-50">{trip.date || "N/A"}</td>
                  <td className="px-4 py-3"><Badge color={trip.lorry === "KBZ" ? "blue" : "amber"}>{trip.lorry}</Badge></td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{trip.tripNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{trip.location || "N/A"}</td>
                  <td className="px-4 py-3">
                    <Badge color={trip.status === "Paid" ? "green" : "amber"}>{trip.status || "Pending"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {trip.status === "Paid" ? (
                      <span className="font-bold text-emerald-700">{fmt(ratePerTrip)}</span>
                    ) : (
                      <Badge color="amber">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTripId(trip.id);
                      }}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-700">Earnings Trend</h3>
          <Badge color="slate">{chartMode === "weeks" ? "Last 8 weeks" : "Last 6 months"}</Badge>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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

      <TripReviewModal
        open={!!selectedTrip}
        trip={selectedTrip}
        ratePerTrip={ratePerTrip}
        onClose={() => setSelectedTripId(null)}
        onMarkPaid={isAdmin ? onMarkTripPaid : undefined}
        onEditTrip={isAdmin ? (trip) => onOpenTripReview?.(trip, true) : undefined}
      />

      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Edit Earnings Rate">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Current rate</p>
            <p className="mt-1 text-lg font-black text-slate-800">{fmt(ratePerTrip)} per paid trip</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">KES per trip</label>
            <input
              type="number"
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-3 mobile-action-stack sm:flex-row">
            <button onClick={() => setConfigOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveRate} disabled={savingRate} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {savingRate ? "Saving..." : "Save Rate"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
