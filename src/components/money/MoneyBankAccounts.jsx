import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatLakh, formatFull } from "./moneyUtils";
import { format, parseISO } from "date-fns";

export default function MoneyBankAccounts({ accounts, bank, bankPrevDelta, bankDaily30, oweVendors, gstPay, shopExpenses }) {
  const list = accounts || [];
  const series = bankDaily30 || [];
  const minBal = series.length ? Math.min(...series.map((s) => s.balance)) : 0;
  const maxBal = series.length ? Math.max(...series.map((s) => s.balance)) : 0;
  // Safe ratio: bank / (oweVendors + gstPay + next month's est. expenses)
  const obligations = (oweVendors || 0) + (gstPay || 0) + (shopExpenses || 0);
  const ratio = obligations > 0 ? (bank || 0) / obligations : null;
  const safe = ratio !== null && ratio >= 1.5;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">Money in the bank</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-2">What is in all your accounts at the end of each day. This is for the whole business.</p>
      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <input type="checkbox" className="h-3.5 w-3.5" /> Compare with the 30 days before
      </label>
      <p className="text-sm mb-3">
        <span className="font-bold text-lg">{formatLakh(bank)}</span> last night.
        {bankPrevDelta ? <> {bankPrevDelta < 0 ? "↓" : "↑"} {formatFull(Math.abs(bankPrevDelta))} {bankPrevDelta < 0 ? "less" : "more"} than the night before.</> : null}
        {series.length > 0 && <> Lowest in 30 days: {formatLakh(minBal)}. Highest: {formatLakh(maxBal)}.</>}
      </p>

      {series.length > 1 && (
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={series}>
              <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "dd MMM")} tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis tickFormatter={(v) => formatLakh(v)} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip labelFormatter={(d) => format(parseISO(d), "dd MMM yyyy")} formatter={(v) => formatFull(v)} />
              <Line type="monotone" dataKey="balance" stroke="#1f1f1f" strokeWidth={1.5} dot={{ r: 2, fill: "#1f1f1f" }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1">Hover or tap a day to see the balance at the end of it.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 font-medium">Account</th>
              <th className="py-2 font-medium text-right">Balance</th>
              <th className="py-2 font-medium text-right">Since yesterday</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No bank transactions imported yet.</td></tr>
            )}
            {list.map((a) => {
              const dates = Object.keys(a.daily || {}).sort();
              const last = dates.length ? a.daily[dates[dates.length - 1]] : a.balance;
              const prev = dates.length > 1 ? a.daily[dates[dates.length - 2]] : last;
              const delta = last - prev;
              return (
                <tr key={a.name} className="border-b last:border-0">
                  <td className="py-2.5">{a.name}</td>
                  <td className="py-2.5 text-right font-medium">{formatLakh(a.balance)}</td>
                  <td className={`py-2.5 text-right text-xs ${delta < 0 ? "text-red-600" : "text-emerald-600"}`}>{delta < 0 ? "↓" : delta > 0 ? "↑" : ""} {delta !== 0 ? formatFull(Math.abs(delta)) : "No change"}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="py-2.5">All accounts</td>
              <td className="py-2.5 text-right">{formatLakh(bank)}</td>
              <td className="py-2.5 text-right text-xs">{bankPrevDelta < 0 ? "↓" : "↑"} {formatFull(Math.abs(bankPrevDelta || 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {ratio !== null && (
        <div className="mt-4 rounded-lg border border-border p-3 text-sm">
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${safe ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {safe ? "✓ Safe" : "⚠ Watch"}
          </span>
          <p className="mt-1.5 text-xs text-neutral-600">
            You have <span className="font-medium">{ratio ? ratio.toFixed(1) : "—"} times</span> what you still have to pay: {formatFull(obligations)}. That is what you owe vendors, your GST, and next month's salaries, rent and bills. If it falls below 1½ times we will ask you to keep an eye on it.
          </p>
        </div>
      )}
    </div>
  );
}