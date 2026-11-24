import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatLakh, formatFull, monthShort } from "./moneyUtils";

export default function MoneyShopProfit({ shopProfit, shopMonthly, shopCosts }) {
  const rows = shopProfit || [];
  const monthly = shopMonthly || [];
  const [metric, setMetric] = useState("profit"); // profit | moneyIn | costs
  const total = rows.reduce((a, s) => ({ moneyIn: a.moneyIn + s.moneyIn, costs: a.costs + s.costs, profit: a.profit + s.profit }), { moneyIn: 0, costs: 0, profit: 0 });
  const costs = shopCosts || [];

  const chartData = monthShort.map((m, i) => {
    const row = { month: m };
    monthly.forEach((s) => { row[s.name] = s.series[i][metric]; });
    return row;
  });

  const best = [...rows].sort((a, b) => b.profit - a.profit)[0];
  const worst = [...rows].sort((a, b) => a.profit - b.profit)[0];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">How is each shop doing?</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">Profit means what you earned on sales, after paying for the jewellery, minus the shop's own costs.</p>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg bg-[#F3F1ED] p-0.5">
          {[["profit", "Profit"], ["moneyIn", "Money in"], ["costs", "Shop costs"]].map(([k, label]) => (
            <button key={k} onClick={() => setMetric(k)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${metric === k ? "bg-neutral-900 text-white" : "text-neutral-600"}`}>{label}</button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" className="h-3.5 w-3.5" /> Compare with last month
        </label>
      </div>

      {best && worst && (
        <p className="text-xs text-muted-foreground mb-2">
          {best.name} earns the most after its costs ({formatFull(best.profit)} so far this month). {worst.name} is lowest ({formatFull(worst.profit)}).
        </p>
      )}

      {monthly.length > 0 && (
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => formatLakh(v)} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatFull(v)} />
              <Legend />
              {monthly.map((s) => (
                <Line key={s.id} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">The table is for this month so far.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 font-medium">Shop</th>
              <th className="py-2 font-medium text-right">Money in</th>
              <th className="py-2 font-medium text-right">Shop costs</th>
              <th className="py-2 font-medium text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No shops yet.</td></tr>
            )}
            {rows.map((s) => {
              const color = monthly.find((m) => m.id === s.id)?.color || "#7f8c8d";
              return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      <span className="font-medium">{s.name}</span>
                      {s.type === "warehouse" && <span className="text-xs text-muted-foreground">· holds stock</span>}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">{formatLakh(s.moneyIn)}</td>
                  <td className="py-2.5 text-right">{formatLakh(s.costs)}</td>
                  <td className={`py-2.5 text-right font-medium ${s.profit < 0 ? "text-red-600" : "text-foreground"}`}>{formatFull(s.profit)}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="py-2.5">All shops</td>
              <td className="py-2.5 text-right">{formatLakh(total.moneyIn)}</td>
              <td className="py-2.5 text-right">{formatLakh(total.costs)}</td>
              <td className="py-2.5 text-right">{formatFull(total.profit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {costs.length > 0 && (
        <div className="mt-5 pt-4 border-t">
          <p className="text-xs font-semibold mb-2">Shop costs this month</p>
          <div className="space-y-1.5 text-sm">
            {costs.map((c) => (
              <div key={c.type} className="flex justify-between">
                <span className="capitalize text-muted-foreground">{c.type}</span>
                <span className="font-medium">{formatFull(c.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold pt-1.5 border-t">
              <span>All shop costs</span>
              <span>{formatFull(costs.reduce((a, c) => a + c.amount, 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}