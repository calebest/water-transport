import { useState } from "react";
import { Badge } from "./ui";
import { fmt } from "../utils/helpers";
import { exportVoucher } from "../utils/export";

export default function TripGroup({ group, isAdmin, onEdit, onDel, onStatusChange, markingPaid }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden mt-4">
      <div 
        className="flex flex-wrap items-center justify-between p-4 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-lg">{expanded ? "▼" : "▶"}</span>
          <h3 className="font-bold text-slate-800 text-lg">{group.date}</h3>
          <Badge color="slate">{group.trips.length} trips</Badge>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium mt-2 sm:mt-0">
          <span className="text-blue-600">Rev: {fmt(group.summary.revenue)}</span>
          <span className="text-rose-500">Exp: {fmt(group.summary.expenses)}</span>
          <span className={`font-bold ${group.summary.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            Net: {fmt(group.summary.profit)}
          </span>
        </div>
      </div>
      
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-white">
                {["Lorry", "Trip #", "Location", "Revenue", "Expenses", "Profit", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.trips.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Badge color={t.lorry === "KBZ" ? "blue" : "amber"}>{t.lorry}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-semibold">{t.tripNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{t.location || "N/A"}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">{fmt(t.revenue)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-500">{fmt(t.totalExpenses)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${Number(t.profit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {fmt(t.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && onStatusChange ? (
                      <select
                        value={t.status}
                        disabled={markingPaid === t.id}
                        onChange={e => onStatusChange(t, e.target.value)}
                        className={`rounded-lg border px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60
                          ${ t.status === "Paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : t.status === "Partial" ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-rose-200 bg-rose-50 text-rose-600" }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Partial">Partial</option>
                        <option value="Paid">Paid</option>
                      </select>
                    ) : (
                      <Badge color={t.status === "Paid" ? "green" : t.status === "Partial" ? "amber" : "rose"}>
                        {t.status}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => exportVoucher(t)}
                        className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100" title="Print Receipt">🖨️</button>
                      {isAdmin && onEdit && onDel && (
                        <>
                          <button onClick={() => onEdit(t)}
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100">Edit</button>
                          <button onClick={() => onDel(t)}
                            className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-100">Del</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
