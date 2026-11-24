import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatLakh, formatFull } from "./moneyUtils";
import { format } from "date-fns";

export default function MoneyVendorPayments({ vendorPayables, vendorPaidYTD, vendorSavedYTD, vendorPaidThisMonth }) {
  const rows = vendorPayables || [];
  const total = rows.reduce((a, v) => a + v.owe, 0);
  const totalSave = rows.reduce((a, v) => a + v.earlySave, 0);
  const firstDue = rows.find((v) => v.dueDate)?.dueDate;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">Payments to vendors</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">Money you owe for jewellery you have already received, and what paying early can save.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 font-medium">Vendor</th>
              <th className="py-2 font-medium text-right">You owe</th>
              <th className="py-2 font-medium text-right">Pay by</th>
              <th className="py-2 font-medium text-right">Save if paid early</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">You don't owe anything to vendors right now.</td></tr>
            )}
            {rows.slice(0, 8).map((v) => (
              <tr key={v.id} className="border-b last:border-0 align-top">
                <td className="py-2.5">
                  <p className="font-medium">{v.vendor_name}</p>
                  <p className="text-xs text-muted-foreground">{v.po_number ? `PO ${v.po_number}` : "—"}</p>
                </td>
                <td className="py-2.5 text-right font-medium">{formatFull(v.owe)}</td>
                <td className="py-2.5 text-right text-xs">{v.dueDate ? format(new Date(v.dueDate), "dd MMM") : "—"}</td>
                <td className="py-2.5 text-right text-xs text-emerald-700 font-medium">
                  {v.earlySave > 0 ? (<><span className="font-semibold">₹{v.earlySave.toLocaleString()}</span><br /><span className="text-muted-foreground font-normal">if paid by {v.earlyDate ? format(new Date(v.earlyDate), "dd MMM") : "—"}</span></>) : "—"}
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Button asChild variant="outline" size="sm"><Link to="/vendor-payouts">Plan payment</Link></Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">Hold</Button>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2.5">All vendors</td>
              <td className="py-2.5 text-right">{formatLakh(total)}</td>
              <td className="py-2.5 text-right text-xs">{firstDue ? format(new Date(firstDue), "dd MMM") : "—"}</td>
              <td className="py-2.5 text-right text-xs text-emerald-700">{totalSave > 0 ? formatFull(totalSave) : "—"}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This year you paid your vendors {formatLakh(vendorPaidYTD || 0)}. This month so far you paid {formatLakh(vendorPaidThisMonth || 0)}. What you owe and the pay-by dates are for the whole business.
      </p>
    </div>
  );
}