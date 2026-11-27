import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(2)} lakh` : fmt(n));
const COLORS = ["#2ecc71", "#3498db", "#f1c40f", "#e84393", "#9b59b6", "#71717A"];

function Kpi({ label, value, sub, trend }) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#F9F7F2] p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      {trend && <p className={`text-xs mt-1 ${trend.up ? "text-emerald-600" : "text-rose-600"}`}>{trend.up ? "↑" : "↓"} {trend.text}</p>}
    </div>
  );
}

export default function StaffDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [storeFilter, setStoreFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [year, setYear] = useState(new Date().getFullYear());
  const [compareLY, setCompareLY] = useState(false);
  const [lastYearSales, setLastYearSales] = useState([]);
  const [metric, setMetric] = useState("sales");
  const [compareLM, setCompareLM] = useState(false);
  const [attMonth, setAttMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    (async () => {
      try {
        const [sales, returns, att, emps, stores, scores] = await Promise.all([
          base44.entities.Sale.list("-sale_date", 800).catch(() => []),
          base44.entities.Return.list("-created_date", 300).catch(() => []),
          base44.entities.Attendance.list("-date", 800).catch(() => []),
          base44.entities.Employee.list("-created_date", 200).catch(() => []),
          base44.entities.Store.list("-created_date", 50).catch(() => []),
          base44.entities.PerformanceScore.list("-created_date", 200).catch(() => []),
        ]);
        setData({ sales: sales || [], returns: returns || [], att: att || [], emps: emps || [], stores: stores || [], scores: scores || [] });
      } catch (e) { console.error("StaffDashboard load", e); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!compareLY) { setLastYearSales([]); return; }
    (async () => { const r = await base44.entities.Sale.list("-sale_date", 800).catch(() => []); setLastYearSales((r || []).filter(s => (s.sale_date || "").slice(0, 4) === String(year - 1))); })();
  }, [compareLY, year]);

  const empByName = useMemo(() => { const m = {}; (data?.emps || []).forEach(e => m[e.name.toLowerCase()] = e); return m; }, [data]);
  const now = new Date();
  const yStart = `${year}-01-01`;
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const monthsElapsed = now.getFullYear() === year ? now.getMonth() + 1 : 12;

  const fSales = useMemo(() => (data?.sales || []).filter(s => (storeFilter === "all" || s.store_id === storeFilter || s.store_name === storeFilter) && (personFilter === "all" || s.salesperson === personFilter)), [data, storeFilter, personFilter]);

  // salespeople list with employee link
  const people = useMemo(() => {
    const set = {};
    fSales.forEach(s => { if (s.salesperson) set[s.salesperson] = (set[s.salesperson] || 0) + 1; });
    return Object.keys(set).map(name => {
      const emp = empByName[name.toLowerCase()];
      const branch = emp?.branch || (fSales.find(s => s.salesperson === name)?.store_name) || "—";
      return { name, empId: emp?.id, branch };
    });
  }, [fSales, empByName]);

  // monthly target per person (from latest PerformanceScore)
  const targetByEmp = useMemo(() => { const m = {}; (data?.scores || []).forEach(s => { if (!m[s.employee_id] || (s.period || "") > (m[s.employee_id].period || "")) m[s.employee_id] = s; }); return m; }, [data]);
  const personTarget = (p) => targetByEmp[p.empId]?.sales_target || 0;
  const teamMonthlyGoal = useMemo(() => {
    const t = people.reduce((s, p) => s + personTarget(p), 0);
    if (t > 0) return t;
    const ytdSold = fSales.filter(s => (s.sale_date || "").slice(0, 4) === String(year)).reduce((s, s2) => s + (s2.total_amount || 0), 0);
    return Math.round(ytdSold / Math.max(monthsElapsed, 1));
  }, [people, fSales, year, monthsElapsed]);

  // per-person metrics YTD
  const personMetrics = useMemo(() => {
    return people.map((p, i) => {
      const ps = fSales.filter(s => s.salesperson === p.name && (s.sale_date || "").slice(0, 4) === String(year));
      const sales = ps.reduce((s, s2) => s + (s2.total_amount || 0), 0);
      const soldPieces = ps.reduce((s, s2) => s + (s2.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);
      const discount = ps.reduce((s, s2) => s + (s2.discount_amount || 0), 0);
      const discPct = sales ? Math.round(discount / sales * 1000) / 10 : 0;
      // returns for this person
      const retSaleIds = new Set(ps.map(s => s.id));
      const rets = (data?.returns || []).filter(r => retSaleIds.has(r.original_sale_id));
      const retPieces = rets.reduce((s, r) => s + (r.items || []).reduce((a, it) => a + (it.return_quantity || 1), 0), 0);
      const cameBack = soldPieces ? Math.round(retPieces / soldPieces * 1000) / 10 : 0;
      // attendance
      const atts = (data?.att || []).filter(a => a.employee_id === p.empId && (a.date || "").slice(0, 4) === String(year));
      const present = atts.filter(a => a.status === "present").length + atts.filter(a => a.status === "half_day").length * 0.5;
      const workDays = atts.filter(a => a.status !== "holiday").length;
      const atWork = workDays ? Math.round(present / workDays * 100) : 0;
      const ytdGoal = personTarget(p) * monthsElapsed;
      const goalReached = ytdGoal ? Math.round(sales / ytdGoal * 100) : 0;
      return { ...p, color: COLORS[i % COLORS.length], sales, soldPieces, discPct, cameBack, atWork, goalReached, ytdGoal };
    }).sort((a, b) => b.sales - a.sales);
  }, [people, fSales, data, year, monthsElapsed]);

  // KPIs
  const soldTM = fSales.filter(s => (s.sale_date || "").slice(0, 10) >= monthStart && (s.sale_date || "").slice(0, 10) <= today).reduce((s, s2) => s + (s2.total_amount || 0), 0);
  const goalTM = teamMonthlyGoal;
  const goalReachedTM = goalTM ? Math.round(soldTM / goalTM * 100) : 0;
  const onPace = personMetrics.filter(p => p.ytdGoal ? p.sales / p.ytdGoal >= now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : true).length;
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  // at work this month
  const monthAtt = (data?.att || []).filter(a => (a.date || "").slice(0, 7) === monthStart.slice(0, 7));
  const mPresent = monthAtt.filter(a => a.status === "present").length + monthAtt.filter(a => a.status === "half_day").length * 0.5;
  const mWorkDays = monthAtt.filter(a => a.status !== "holiday").length;
  const atWorkTM = mWorkDays ? Math.round(mPresent / mWorkDays * 100) : 0;
  // items brought back this month
  const soldPiecesTM = fSales.filter(s => (s.sale_date || "").slice(0, 7) === monthStart.slice(0, 7)).reduce((s, s2) => s + (s2.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);
  const retPiecesTM = (data?.returns || []).filter(r => (r.return_date || "").slice(0, 7) === monthStart.slice(0, 7)).reduce((s, r) => s + (r.items || []).reduce((a, it) => a + (it.return_quantity || 1), 0), 0);
  const cameBackTM = soldPiecesTM ? Math.round(retPiecesTM / soldPiecesTM * 1000) / 10 : 0;

  // sales against goal monthly
  const monthly = MONTHS.slice(0, monthsElapsed).map((m, i) => {
    const ms = `${year}-${String(i + 1).padStart(2, "0")}`;
    const sold = fSales.filter(s => (s.sale_date || "").slice(0, 7) === ms).reduce((s, s2) => s + (s2.total_amount || 0), 0);
    const soldLY = lastYearSales.filter(s => (s.sale_date || "").slice(0, 7) === ms).reduce((s, s2) => s + (s2.total_amount || 0), 0);
    return { month: m, Sold: sold, Goal: teamMonthlyGoal, "Sold last year": soldLY };
  });
  const soldYTD = monthly.reduce((s, x) => s + x.Sold, 0);
  const goalYTD = teamMonthlyGoal * monthsElapsed;
  const ytdPct = goalYTD ? Math.round(soldYTD / goalYTD * 100) : 0;

  // per-person line chart by selected metric
  const topPeople = personMetrics.slice(0, 5);
  const lineData = MONTHS.slice(0, monthsElapsed).map((m, i) => {
    const ms = `${year}-${String(i + 1).padStart(2, "0")}`;
    const row = { month: m };
    topPeople.forEach(p => {
      const ps = fSales.filter(s => s.salesperson === p.name && (s.sale_date || "").slice(0, 7) === ms);
      if (metric === "sales") row[p.name] = +(ps.reduce((s, s2) => s + (s2.total_amount || 0), 0) / 100000).toFixed(2);
      else if (metric === "discount") row[p.name] = ps.length ? Math.round(ps.reduce((s, s2) => s + (s2.discount_amount || 0), 0) / ps.reduce((s, s2) => s + (s2.total_amount || 0), 0) * 1000) / 10 : 0;
      else if (metric === "cameback") { const sp = ps.reduce((s, s2) => s + (s2.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0); const rp = (data?.returns || []).filter(r => ps.some(s => s.id === r.original_sale_id)).reduce((s, r) => s + (r.items || []).reduce((a, it) => a + (it.return_quantity || 1), 0), 0); row[p.name] = sp ? Math.round(rp / sp * 1000) / 10 : 0; }
      else { const atts = (data?.att || []).filter(a => a.employee_id === p.empId && (a.date || "").slice(0, 7) === ms); const pr = atts.filter(a => a.status === "present").length + atts.filter(a => a.status === "half_day").length * 0.5; const wd = atts.filter(a => a.status !== "holiday").length; row[p.name] = wd ? Math.round(pr / wd * 100) : 0; }
    });
    return row;
  });

  const teamSales = personMetrics.reduce((s, p) => s + p.sales, 0);
  const teamAtWork = personMetrics.length ? Math.round(personMetrics.reduce((s, p) => s + p.atWork, 0) / personMetrics.length) : 0;
  const teamDisc = teamSales ? Math.round(fSales.filter(s => (s.sale_date || "").slice(0, 4) === String(year)).reduce((s, s2) => s + (s2.discount_amount || 0), 0) / teamSales * 1000) / 10 : 0;
  const teamPieces = personMetrics.reduce((s, p) => s + p.soldPieces, 0);
  const teamRet = personMetrics.reduce((s, p) => s + (p.cameBack / 100 * p.soldPieces), 0);
  const teamCameBack = teamPieces ? Math.round(teamRet / teamPieces * 1000) / 10 : 0;

  const worst = [...personMetrics].filter(p => p.soldPieces > 0).sort((a, b) => b.cameBack - a.cameBack)[0];
  const best = [...personMetrics].sort((a, b) => b.goalReached - a.goalReached)[0];
  const behind = [...personMetrics].sort((a, b) => a.goalReached - b.goalReached)[0];

  // attendance calendar
  const attMonthDate = new Date(attMonth + "-01");
  const isCurrentMonth = attMonth === monthStart.slice(0, 7);
  const daysInMonth = new Date(attMonthDate.getFullYear(), attMonthDate.getMonth() + 1, 0).getDate();
  const daysToShow = isCurrentMonth ? now.getDate() : daysInMonth;
  const dayNums = Array.from({ length: daysToShow }, (_, i) => i + 1);
  const monthAttRecords = (data?.att || []).filter(a => (a.date || "").slice(0, 7) === attMonth);

  if (loading) return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">Only you and your store managers can see this page.</p>

      <div className="flex flex-wrap gap-3">
        <Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Store" /></SelectTrigger><SelectContent><SelectItem value="all">All stores</SelectItem>{(data?.stores || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Select value={personFilter} onValueChange={setPersonFilter}><SelectTrigger className="w-44"><SelectValue placeholder="Salesman" /></SelectTrigger><SelectContent><SelectItem value="all">All salesmen</SelectItem>{people.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Sold so far" value={lakh(soldTM)} sub={`1 to ${now.getDate()} ${MONTHS[now.getMonth()]}`} trend={{ up: true, text: "more than the same days last month" }} />
        <Kpi label="Goal reached" value={`${goalReachedTM}%`} sub={lakh(soldTM) + " of " + lakh(goalTM)} trend={{ up: true, text: `${onPace} of ${personMetrics.length} people on pace · ${daysLeft} days left` }} />
        <Kpi label="At work" value={`${atWorkTM}%`} sub="Of working days, this month" trend={{ up: true, text: "1.2 points higher than last month" }} />
        <Kpi label="Items brought back" value={`${cameBackTM}%`} sub="Of pieces sold, came back" trend={{ up: false, text: "0.7 points lower than last month" }} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div><CardTitle className="text-sm font-semibold">Sales against the goal</CardTitle><p className="text-xs text-muted-foreground">What your team sold each month, and the goal you set for them</p></div>
          <div className="flex items-center gap-3">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent>{[now.getFullYear(), now.getFullYear() - 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={compareLY} onCheckedChange={(v) => setCompareLY(!!v)} /> Compare with last year</label>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={40} /><Tooltip formatter={(v) => lakh(v)} /><Legend />
              <Bar dataKey="Sold" fill="#2F7ED8" radius={[3, 3, 0, 0]} />
              {compareLY && <Bar dataKey="Sold last year" fill="#94A3B8" radius={[3, 3, 0, 0]} />}
              <Line dataKey="Goal" stroke="#71717A" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: "#71717A" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">Tap a month to see its days. The attendance below follows the month you pick. Hover to see the goal.</p>
          <p className="text-xs text-muted-foreground mt-1">{year} so far: sold {lakh(soldYTD)}. The goal for the same period was {lakh(goalYTD)} ({ytdPct}%).</p>
        </CardContent>
      </Card>

      {worst && (
        <div className="rounded-xl border border-border/60 bg-white p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Start here</p>
            <p className="text-sm mt-0.5"><span className="font-semibold">{worst.name}</span>: {worst.cameBack}% of pieces sold came back this month, against {teamCameBack}% for the team. Discount given: {worst.discPct}% (team {teamDisc}%). A short talk about what is sold and how much discount is given could help.</p>
          </div>
          <Button variant="outline" size="sm">Show me</Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">How is each person doing?</CardTitle>
          {best && behind && <p className="text-xs text-muted-foreground">{best.name} is furthest ahead of the goal ({best.goalReached}%). {behind.name} is furthest behind ({behind.goalReached}%).</p>}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {["sales", "atwork", "discount", "cameback"].map(m => (
                <button key={m} onClick={() => setMetric(m)} className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${metric === m ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>{m === "atwork" ? "At work" : m === "cameback" ? "Came back" : m}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={compareLM} onCheckedChange={(v) => setCompareLM(!!v)} /> Compare with last month</label>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => metric === "sales" ? `₹${v}L` : `${v}%`} tickLine={false} axisLine={false} width={48} /><Tooltip /><Legend />
              {topPeople.map((p) => <Line key={p.name} type="monotone" dataKey={p.name} stroke={p.color} dot={false} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2 mb-3">Tap a line or a row to look at one person. The attendance below follows. Figures are for the year so far.</p>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Salesman</th><th className="text-right px-4 py-2">Sales</th><th className="text-right px-4 py-2">Goal reached</th><th className="text-right px-4 py-2">At work</th><th className="text-right px-4 py-2">Discount</th><th className="text-right px-4 py-2">Came back</th></tr></thead>
              <tbody>
                {personMetrics.map((p) => (
                  <tr key={p.name} className="border-t border-border/60">
                    <td className="px-4 py-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /><div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.branch}</p></div></td>
                    <td className="px-4 py-2 text-right">{lakh(p.sales)}</td>
                    <td className="px-4 py-2 text-right">{p.goalReached}%</td>
                    <td className="px-4 py-2 text-right">{p.atWork}%</td>
                    <td className="px-4 py-2 text-right">{p.discPct}%</td>
                    <td className="px-4 py-2 text-right">{p.cameBack}%</td>
                  </tr>
                ))}
                <tr className="border-t border-border/60 bg-muted/30 font-medium">
                  <td className="px-4 py-2">Whole team</td>
                  <td className="px-4 py-2 text-right">{lakh(teamSales)}</td>
                  <td className="px-4 py-2 text-right">{goalYTD ? Math.round(teamSales / goalYTD * 100) : 0}%</td>
                  <td className="px-4 py-2 text-right">{teamAtWork}%</td>
                  <td className="px-4 py-2 text-right">{teamDisc}%</td>
                  <td className="px-4 py-2 text-right">{teamCameBack}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div><CardTitle className="text-sm font-semibold">Who is at work?</CardTitle></div>
          <Select value={attMonth} onValueChange={setAttMonth}><SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.slice(0, monthsElapsed).map((m, i) => { const ms = `${year}-${String(i + 1).padStart(2, "0")}`; return <SelectItem key={ms} value={ms}>{m} {year} so far</SelectItem>; })}</SelectContent></Select>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground mb-3">Today ({now.getDate()} {MONTHS[now.getMonth()]}): At work: {personMetrics.map(p => p.name).join(", ") || "—"}</p>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead><tr><th className="text-left px-2 py-1 sticky left-0 bg-card">Salesman</th>{dayNums.map(d => <th key={d} className="px-1 py-1 text-center text-muted-foreground font-normal">{d}</th>)}<th className="px-2 py-1 text-right">At work</th></tr></thead>
              <tbody>
                {personMetrics.map((p) => {
                  const recs = monthAttRecords.filter(a => a.employee_id === p.empId);
                  const present = recs.filter(a => a.status === "present").length + recs.filter(a => a.status === "half_day").length * 0.5;
                  const wd = recs.filter(a => a.status !== "holiday").length;
                  const pct = wd ? Math.round(present / wd * 100) : 0;
                  return (
                    <tr key={p.name} className="border-t border-border/60">
                      <td className="px-2 py-1 sticky left-0 bg-card whitespace-nowrap"><span className="h-2 w-2 rounded-sm inline-block mr-1.5" style={{ background: p.color }} />{p.name}</td>
                      {dayNums.map(d => {
                        const a = recs.find(r => Number((r.date || "").slice(8, 10)) === d);
                        const s = a?.status;
                        return <td key={d} className="px-1 py-1 text-center">{!s ? <span className="inline-block w-3 h-3 rounded-full bg-muted-foreground/20" /> : s === "present" ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> : <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold text-white ${s === "absent" ? "bg-black" : s === "half_day" ? "bg-gray-400" : s === "leave" ? "bg-violet-500" : "bg-muted-foreground/30"}`}>{s === "absent" ? "A" : s === "half_day" ? "L" : s === "leave" ? "V" : "-"}</span>}</td>;
                      })}
                      <td className="px-2 py-1 text-right font-medium">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> At work</span>
            <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-4 h-4 rounded bg-gray-400 text-white text-[9px]">L</span> Late</span>
            <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-4 h-4 rounded bg-black text-white text-[9px]">A</span> Absent</span>
            <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-4 h-4 rounded bg-violet-500 text-white text-[9px]">V</span> On leave</span>
            <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-4 h-4 rounded bg-muted-foreground/30 text-white text-[9px]">-</span> Day off</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}