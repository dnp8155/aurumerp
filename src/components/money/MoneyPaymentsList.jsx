import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { formatFull } from "./moneyUtils";

// Segmented filter matching the reference: All / Came in / Vendors / Shop costs / GST, with counts.
const FILTERS = [
  { key: "all", label: "All" },
  { key: "sales", label: "Came in" },
  { key: "vendor", label: "Vendors" },
  { key: "shopcost", label: "Shop costs" },
  { key: "gst", label: "GST" },
];

export default function MoneyPaymentsList({ payments, scopeLabel }) {
  const [filter, setFilter] = useState("all");
  const [visible, setVisible] = useState(10);

  const counts = useMemo(() => {
    const c = { all: payments.length, sales: 0, vendor: 0, shopcost: 0, gst: 0 };
    (payments || []).forEach((p) => { c[p.cat] = (c[p.cat] || 0) + 1; });
    return c;
  }, [payments]);

  const base = filter === "all" ? payments : (payments || []).filter((p) => p.cat === filter);
  const totalIn = base.reduce((a, p) => a + (p.kind === "in" ? p.amount : 0), 0);
  const totalOut = base.reduce((a, p) => a + (p.kind === "out" ? p.amount : 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold">Every payment in and out</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Newest first. The list follows the month, day and shop you pick above.</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#F3F1ED] px-3 py-1 text-xs font-medium text-neutral-700">Showing {scopeLabel}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setVisible(10); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f.key ? "bg-neutral-900 text-white" : "bg-[#F3F1ED] text-neutral-600 hover:bg-neutral-200"}`}
          >
            {f.label} ({counts[f.key] || 0})
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{counts.all} payments · {formatFull(totalIn)} came in · {formatFull(totalOut)} went out</p>

      <div className="space-y-1">
        {base.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No payments to show.</p>}
        {base.slice(0, visible).map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{p.label || p.type}</p>
              <p className="text-xs text-muted-foreground">
                <span className="inline-flex rounded bg-[#F3F1ED] px-1.5 py-0.5 mr-1.5 text-[10px] font-medium text-neutral-700">{p.type}</span>
                {p.store ? `${p.store} · ` : ""}{p.date ? format(new Date(p.date), "dd MMM") : "—"}{p.ref ? ` · ${p.ref}` : ""}
              </p>
            </div>
            <p className={`text-sm font-medium shrink-0 ml-3 ${p.kind === "in" ? "text-emerald-700" : "text-foreground"}`}>
              {p.kind === "in" ? "+" : "−"}{formatFull(p.amount)}
            </p>
          </div>
        ))}
        {visible < base.length && (
          <button onClick={() => setVisible((v) => v + 20)} className="w-full py-2 text-xs text-primary hover:underline">
            Show {Math.min(20, base.length - visible)} more · {base.length - visible} payments left
          </button>
        )}
      </div>
    </div>
  );
}