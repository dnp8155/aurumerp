import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, Wallet, FileBarChart } from "lucide-react";

// "What you need to do" — derived from stuck Tally, due vendor payables, pending expenses, GST due date.
export default function MoneyActions({ tally, vendorPayables, pendingExpenses }) {
  const items = [];
  if (tally?.stuck > 0) {
    items.push({ tag: "Urgent", tone: "dark", icon: AlertTriangle, text: `Reconnect your accounts (Tally). It has ${tally.stuck} entries stuck.`, action: "Fix it", to: "/tally-sync" });
  }
  const early = (vendorPayables || []).filter((v) => v.earlySave > 0).slice(0, 2);
  if (early.length > 0) {
    const save = early.reduce((a, v) => a + v.earlySave, 0);
    items.push({ tag: "Important", tone: "light", icon: Wallet, text: `Pay ${early.map((v) => v.vendor_name).join(" and ")} early and save ₹${save.toLocaleString()}.`, action: "Plan these payments", to: "/vendor-payouts" });
  }
  if (pendingExpenses > 0) {
    items.push({ tag: "Soon", tone: "light", icon: Wallet, text: `Approve ${pendingExpenses} shop expense${pendingExpenses === 1 ? "" : "s"} waiting for your OK.`, action: "Approve", to: "/finance" });
  }
  // GSTR-1 is due on the 11th of the month after the tax period.
  const now = new Date();
  const dueMonth = (now.getMonth() + 1) % 12;
  const dueYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const due = new Date(dueYear, dueMonth, 11);
  const dueStr = `${due.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dueMonth]}`;
  items.push({ tag: "Later", tone: "light", icon: FileBarChart, text: `File your GST return 1 (GSTR-1). It is due on ${dueStr}.`, action: "Remind me", to: "/gst" });

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-3">What you need to do</h3>
      <div className="space-y-3">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${it.tone === "dark" ? "bg-neutral-800 text-white" : "bg-neutral-200 text-neutral-700"}`}>{it.tag}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm flex items-start gap-2"><Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />{it.text}</p>
              </div>
              <Button asChild variant={it.tone === "dark" ? "default" : "outline"} size="sm"><Link to={it.to}>{it.action}</Link></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}