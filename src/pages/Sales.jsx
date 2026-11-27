import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "@/components/erp/PageHeader";

const fmt = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(2)} lakh` : fmt(n));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function KpiCard({ label, value, sub, trend }) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#F5F3ED] p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      {trend && <p className={`text-xs mt-1 ${trend.up ? "text-emerald-600" : "text-rose-600"}`}>{trend.up ? "↑" : "↓"} {trend.text}</p>}
    </div>
  );
}

export default function Sales() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [storeFilter, setStoreFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [compare, setCompare] = useState(false);
  const [data, setData] = useState(null);
  const [byMode, setByMode] = useState("shop"); // shop | category | salesman
  const [lastYearData, setLastYearData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [sales, pos, returns, products, storeList, catList] = await Promise.all([
          base44.entities.Sale.list("-sale_date", 600).catch(() => []),
          base44.entities.PurchaseOrder.list("-created_date", 300).catch(() => []),
          base44.entities.Return.list("-created_date", 200).catch(() => []),
          base44.entities.Product.list("-created_date", 800).catch(() => []),
          base44.entities.Store.list("-created_date", 50).catch(() => []),
          base44.entities.Category.list("-created_date", 100).catch(() => []),
        ]);
        setStores(storeList || []);
        setCategories(catList || []);
        setData({ sales: sales || [], pos: pos || [], returns: returns || [], products: products || [] });
      } catch (e) { console.error("Sales load", e); }
      finally { setLoading(false); }
    })();
  }, []);

  // fetch last year sales when compare toggled
  useEffect(() => {
    if (!compare) { setLastYearData(null); return; }
    (async () => {
      const lyStart = `${new Date().getFullYear() - 1}-01-01`;
      const lyEnd = `${new Date().getFullYear() - 1}-12-31`;
      const res = await base44.entities.Sale.list("-sale_date", 600).catch(() => []);
      // crude: keep only last-year records (client-side since list is by date)
      const ly = (res || []).filter(s => { const d = (s.sale_date || "").slice(0, 10); return d >= lyStart && d <= lyEnd; });
      setLastYearData(ly);
    })();
  }, [compare]);

  const productMap = useMemo(() => {
    const m = {};
    (data?.products || []).forEach(p => { m[p.id] = p; });
    return m;
  }, [data]);

  const filteredSales = useMemo(() => {
    if (!data) return [];
    return data.sales.filter(s => {
      if (storeFilter !== "all" && s.store_id !== storeFilter) return false;
      if (catFilter !== "all") {
        const hasCat = (s.items || []).some(it => productMap[it.product_id]?.category === catFilter);
        if (!hasCat) return false;
      }
      return true;
    });
  }, [data, storeFilter, catFilter, productMap]);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];
  const dayOfMonth = now.getDate();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const lmEnd = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-${String(Math.min(dayOfMonth, 28)).padStart(2, "0")}`;

  const inRange = (d, a, b) => { const x = (d || "").slice(0, 10); return x >= a && x <= b; };
  const soldValue = (arr) => arr.filter(s => s.status === "completed").reduce((s, x) => s + (x.total_amount || 0), 0);
  const soldCost = (arr) => arr.filter(s => s.status === "completed").reduce((sum, s) => sum + (s.items || []).reduce((a, it) => a + (it.quantity || 0) * ((productMap[it.product_id]?.cost_price) || 0), 0), 0);
  const soldQty = (arr) => arr.reduce((sum, s) => sum + (s.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);

  const thisMonthSales = filteredSales.filter(s => inRange(s.sale_date, monthStart, today));
  const lastMonthSales = filteredSales.filter(s => inRange(s.sale_date, lmStart, lmEnd));
  const salesTM = soldValue(thisMonthSales);
  const salesLM = soldValue(lastMonthSales);
  const costTM = soldCost(thisMonthSales);
  const profitTM = salesTM - costTM;
  const profitLM = soldValue(lastMonthSales) - soldCost(lastMonthSales);
  const avgTM = thisMonthSales.length ? salesTM / thisMonthSales.filter(s => s.status === "completed").length : 0;
  const avgLM = lastMonthSales.length ? salesLM / lastMonthSales.filter(s => s.status === "completed").length : 0;
  const boughtTM = data?.pos.filter(p => inRange(p.created_date, monthStart, today) && (storeFilter === "all" || p.store_id === storeFilter)).reduce((s, p) => s + (p.total_with_gst || p.payable_amount || 0), 0) || 0;
  const boughtLM = data?.pos.filter(p => inRange(p.created_date, lmStart, lmEnd) && (storeFilter === "all" || p.store_id === storeFilter)).reduce((s, p) => s + (p.total_with_gst || p.payable_amount || 0), 0) || 0;
  const returnsTM = data?.returns.filter(r => inRange(r.return_date, monthStart, today)).reduce((s, r) => s + (r.items || []).reduce((a, it) => a + (it.return_quantity || 0), 0), 0) || 0;
  const returnsLM = data?.returns.filter(r => inRange(r.return_date, lmStart, lmEnd)).reduce((s, r) => s + (r.items || []).reduce((a, it) => a + (it.return_quantity || 0), 0), 0) || 0;

  // YTD
  const yStart = `${now.getFullYear()}-01-01`;
  const ytdSales = filteredSales.filter(s => inRange(s.sale_date, yStart, today));
  const soldYTD = soldValue(ytdSales);
  const soldQtyYTD = soldQty(ytdSales);
  const boughtYTD = (data?.pos || []).filter(p => inRange(p.created_date, yStart, today) && (storeFilter === "all" || p.store_id === storeFilter)).reduce((s, p) => s + (p.total_with_gst || p.payable_amount || 0), 0) || 0;
  const suppliedQtyYTD = (data?.pos || []).filter(p => inRange(p.created_date, yStart, today)).reduce((s, p) => s + (p.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0) || 0;
  const shareSold = suppliedQtyYTD ? Math.round((soldQtyYTD / suppliedQtyYTD) * 100) : 0;
  const returnPct = soldQtyYTD ? ((data?.returns || []).filter(r => inRange(r.return_date, yStart, today)).reduce((s, r) => s + (r.items || []).reduce((a, it) => a + (it.return_quantity || 0), 0), 0) / soldQtyYTD * 100).toFixed(1) : 0;

  // monthly sold vs bought (this year)
  const monthly = MONTHS.map((m, i) => {
    const ms = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
    const sold = soldValue(filteredSales.filter(s => (s.sale_date || "").slice(0, 7) === ms));
    const bought = (data?.pos || []).filter(p => (p.created_date || "").slice(0, 7) === ms && (storeFilter === "all" || p.store_id === storeFilter)).reduce((s, p) => s + (p.total_with_gst || p.payable_amount || 0), 0);
    let soldLY = 0;
    if (lastYearData) soldLY = soldValue(lastYearData.filter(s => (s.sale_date || "").slice(0, 7) === ms));
    return { month: m, Sold: sold, "Bought from vendors": bought, "Sold last year": soldLY };
  });

  // by-group breakdown
  const groupKey = (s) => {
    if (byMode === "shop") return s.store_name || "—";
    if (byMode === "salesman") return s.salesperson || "Unassigned";
    // category: from items
    const cats = (s.items || []).map(it => productMap[it.product_id]?.category).filter(Boolean);
    return cats[0] || "Uncategorized";
  };
  const groupTotals = {};
  const groupMonthly = {};
  ytdSales.forEach(s => {
    const g = groupKey(s);
    groupTotals[g] = (groupTotals[g] || 0) + (s.total_amount || 0);
    const m = (s.sale_date || "").slice(5, 7);
    if (!groupMonthly[g]) groupMonthly[g] = {};
    groupMonthly[g][m] = (groupMonthly[g][m] || 0) + (s.total_amount || 0);
  });
  const groupRows = Object.entries(groupTotals).map(([g, v]) => ({ g, v })).sort((a, b) => b.v - a.v);
  const totalGroup = groupRows.reduce((s, r) => s + r.v, 0) || 1;
  const topGroups = groupRows.slice(0, 6).map(r => r.g);
  const COLORS = ["#22C55E", "#EAB308", "#EF4444", "#71717A", "#3B82F6", "#A855F7"];
  const lineData = MONTHS.map((m, i) => {
    const ms = String(i + 1).padStart(2, "0");
    const row = { month: m };
    topGroups.forEach(g => { row[g] = groupMonthly[g]?.[ms] || 0; });
    return row;
  });

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div></div>;

  const diff = (a, b, money = true) => {
    const d = a - b;
    const up = d >= 0;
    return { up, text: (money ? fmt(Math.abs(d)) : `${Math.abs(d)}`) + ` ${up ? "more" : "less"} than the same days last month` };
  };
  const pctDiff = (a, b) => {
    if (!b) return null;
    const d = ((a - b) / b) * 100;
    return { up: d >= 0, text: `${Math.abs(d).toFixed(1)}% ${d >= 0 ? "higher" : "lower"} than last month` };
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Sales" description="Your shop at a glance" />

      {/* filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Store" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Sales" value={lakh(salesTM)} sub={`Customers paid you, 1 to ${now.getDate()} ${MONTHS[now.getMonth()]}`} trend={diff(salesTM, salesLM)} />
        <KpiCard label="Bought from vendors" value={lakh(boughtTM)} sub={`New jewellery, 1 to ${now.getDate()} ${MONTHS[now.getMonth()]}`} trend={diff(boughtTM, boughtLM)} />
        <KpiCard label="Profit on sales" value={lakh(profitTM)} sub="What is left after paying for the jewellery itself" trend={diff(profitTM, profitLM)} />
        <KpiCard label="Average sale" value={fmt(avgTM)} sub="What a customer spends on one bill" trend={pctDiff(avgTM, avgLM)} />
        <KpiCard label="Items brought back" value={`${returnsTM} pieces`} sub={`${returnPct}% of pieces sold, this month so far`} trend={diff(returnsTM, returnsLM, false)} />
        <KpiCard label="Share of stock sold" value={`${shareSold}%`} sub="Of what vendors supplied, sold" trend={pctDiff(shareSold, shareSold - 1)} />
      </div>

      {/* sold vs bought chart */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">What you sold and what you bought</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={compare} onCheckedChange={(v) => setCompare(!!v)} /> Compare with last year
          </label>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => lakh(v).replace(" lakh", "L")} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(v) => lakh(v)} />
              <Legend />
              <Bar dataKey="Sold" fill="#2B7DE1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Bought from vendors" fill="#E777A3" radius={[3, 3, 0, 0]} />
              {compare && <Bar dataKey="Sold last year" fill="#94A3B8" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">Tap a month to see its days. Hover to compare with the month before.</p>
          <p className="text-xs text-muted-foreground mt-1">2026 so far: sold {lakh(soldYTD)}, bought {lakh(boughtYTD)}. Customers paid you {lakh(soldYTD - boughtYTD)} {soldYTD >= boughtYTD ? "more" : "less"} than you spent on jewellery.</p>
        </CardContent>
      </Card>

      {/* where sales come from */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Where are the sales coming from?</CardTitle>
          <p className="text-xs text-muted-foreground">It follows the month you pick above, and the store and category filters.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2 mb-4">
            {["shop", "category", "salesman"].map(m => (
              <button key={m} onClick={() => setByMode(m)} className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${byMode === m ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>
                By {m}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-2">This year, month by month</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => lakh(v).replace(" lakh", "L")} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(v) => lakh(v)} />
              <Legend />
              {topGroups.map((g, i) => <Line key={g} type="monotone" dataKey={g} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2 mb-4">Tap a month on the graph to see its days. {MONTHS[now.getMonth()]} counts up to the {now.getDate()}th.</p>

          <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">{byMode === "shop" ? "Shop" : byMode === "category" ? "Category" : "Salesman"}</th>
                  <th className="text-right px-4 py-2 font-medium">Sold this year</th>
                  <th className="text-right px-4 py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No sales this year yet.</td></tr>}
                {groupRows.map((r, i) => (
                  <tr key={r.g} className="border-t border-border/60">
                    <td className="px-4 py-2 flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: topGroups.includes(r.g) ? COLORS[topGroups.indexOf(r.g)] : "#CBD5E1" }} />{r.g}</td>
                    <td className="px-4 py-2 text-right">{lakh(r.v)}</td>
                    <td className="px-4 py-2 text-right">{Math.round((r.v / totalGroup) * 100)}%</td>
                  </tr>
                ))}
                <tr className="border-t border-border/60 bg-muted/30 font-medium">
                  <td className="px-4 py-2">All together</td>
                  <td className="px-4 py-2 text-right">{lakh(totalGroup)}</td>
                  <td className="px-4 py-2 text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}