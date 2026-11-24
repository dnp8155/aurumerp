import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { monthShort, monthLong, formatLakh, formatFull, sameDay } from "./moneyUtils";

// Year -> month -> day drill-down. `payments` follow the selected month/day.
export default function MoneyFlowChart({ monthlyFlow, monthlyFlowPrev, payments, year, month, onPickMonth, onPickDay }) {
  const [view, setView] = useState("year"); // year | month
  const [selMonth, setSelMonth] = useState(null);
  const [compare, setCompare] = useState(false);

  const openMonth = (m) => {
    setSelMonth(m);
    setView("month");
    onPickMonth(m);
  };
  const backToYear = () => {
    setView("year");
    setSelMonth(null);
    onPickMonth(null);
    onPickDay(null);
  };

  const yearTotalIn = (monthlyFlow || []).reduce((a, x) => a + x.in, 0);
  const yearTotalOut = (monthlyFlow || []).reduce((a, x) => a + x.out, 0);
  const kept = yearTotalIn - yearTotalOut;

  // Day-level data for selected month (from payments)
  let dayData = [];
  if (view === "month" && selMonth !== null) {
    const days = new Date(year, selMonth + 1, 0).getDate();
    const map = {};
    for (let d = 1; d <= days; d++) { map[d] = { day: String(d), in: 0, out: 0 }; }
    (payments || []).forEach((p) => {
      if (!p.date) return;
      const dt = new Date(p.date);
      if (dt.getFullYear() === year && dt.getMonth() === selMonth) {
        const d = dt.getDate();
        if (p.kind === "in") map[d].in += p.amount; else map[d].out += p.amount;
      }
    });
    dayData = Object.values(map);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold">Money in and money out</h3>
          <p className="text-xs text-muted-foreground mt-0.5">What customers paid you, and what you paid to vendors, for shop costs and for GST</p>
        </div>
        {view === "month" && (
          <Button variant="outline" size="sm" onClick={backToYear}>← Back to the year {year}</Button>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 text-xs mb-3">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-600" /> Came in</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-violet-600" /> Went out</span>
          {compare && (
            <>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-300" /> Came in (last year)</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-violet-300" /> Went out (last year)</span>
            </>
          )}
        </div>
        {view === "year" && (
          <label className="inline-flex items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" className="h-3.5 w-3.5" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            Compare with last year (after 12 months)
          </label>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {view === "year" ? (
          <BarChart data={compare && monthlyFlowPrev ? monthlyFlow.map((m, i) => ({ ...m, inPrev: monthlyFlowPrev[i]?.in || 0, outPrev: monthlyFlowPrev[i]?.out || 0 })) : monthlyFlow} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatLakh(v)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatFull(v)} />
            <Legend />
            <Bar dataKey="in" name="Came in" fill="#2563eb" radius={[3, 3, 0, 0]} onClick={(d) => openMonth(monthShort.indexOf(d.month))} cursor="pointer" />
            <Bar dataKey="out" name="Went out" fill="#7c3aed" radius={[3, 3, 0, 0]} onClick={(d) => openMonth(monthShort.indexOf(d.month))} cursor="pointer" />
            {compare && monthlyFlowPrev && (
              <>
                <Bar dataKey="inPrev" name="Came in (last year)" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outPrev" name="Went out (last year)" fill="#c4b5fd" radius={[3, 3, 0, 0]} />
              </>
            )}
          </BarChart>
        ) : (
          <BarChart data={dayData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => formatLakh(v)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatFull(v)} />
            <Legend />
            <Bar dataKey="in" name="Came in" fill="#2563eb" radius={[3, 3, 0, 0]} onClick={(d) => onPickDay(Number(d.day))} cursor="pointer" />
            <Bar dataKey="out" name="Went out" fill="#7c3aed" radius={[3, 3, 0, 0]} onClick={(d) => onPickDay(Number(d.day))} cursor="pointer" />
          </BarChart>
        )}
      </ResponsiveContainer>

      <p className="mt-3 text-xs text-muted-foreground">
        {view === "year"
          ? `Tap a month to see its days. The list at the bottom follows the month you pick. ${year} so far: ${formatLakh(yearTotalIn)} came in and ${formatLakh(yearTotalOut)} went out. You kept ${formatLakh(kept)}.`
          : `Days of ${monthLong[selMonth]}. Tap a day to filter the list below.`}
      </p>
    </div>
  );
}