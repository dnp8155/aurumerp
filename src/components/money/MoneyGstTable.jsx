import React from "react";
import { formatFull } from "./moneyUtils";

export default function MoneyGstTable({ gstMonths }) {
  const rows = gstMonths || [];
  const current = rows[0];
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">GST (tax)</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">Tax you collected from customers, minus tax you already paid on what you bought.</p>
      {current && (
        <p className="text-xs mb-3">
          This month so far: you collected <span className="font-medium">{formatFull(current.collected)}</span> from customers and can claim back <span className="font-medium">{formatFull(current.claim)}</span> on what you bought. That leaves <span className="font-medium">{formatFull(current.pay)}</span> to pay by 20 Dec.
        </p>
      )}
      <div className="flex flex-wrap gap-2 mb-3 text-xs text-muted-foreground">
        <span>GST return 1 (GSTR-1): due 11th of next month</span>
        <span>·</span>
        <span>GST return 3B (GSTR-3B): due 20th of next month</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 font-medium">Month</th>
              <th className="py-2 font-medium text-right">You collected</th>
              <th className="py-2 font-medium text-right">Claim back</th>
              <th className="py-2 font-medium text-right">To pay</th>
              <th className="py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2.5">{r.month}{i === 0 ? " (so far)" : ""}</td>
                <td className="py-2.5 text-right">{formatFull(r.collected)}</td>
                <td className="py-2.5 text-right">{formatFull(r.claim)}</td>
                <td className="py-2.5 text-right font-medium">{formatFull(r.pay)}</td>
                <td className="py-2.5 text-right text-xs">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}