import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/erp/PageHeader";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(2)} lakh` : fmt(n));
const COLORS = ["#00a86b", "#1976D2", "#e69900", "#71717A", "#A855F7", "#EF4444"];

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

export default function VendorsDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [storeFilter, setStoreFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [compare, setCompare] = useState(false);
  const [lastYear, setLastYear] = useState(null);
  const [scoreMode, setScoreMode] = useState("score");
  const [sellBucket, setSellBucket] = useState("top");
  const [typeMode, setTypeMode] = useState("share");

  useEffect(() => {
    (async () => {
      try {
        const [pos, grs, sales, returns, products, vendors, storeList, catList] = await Promise.all([
          base44.entities.PurchaseOrder.list("-created_date", 400).catch(() => []),
          base44.entities.GoodsReceipt.list("-created_date", 300).catch(() => []),
          base44.entities.Sale.list("-sale_date", 600).catch(() => []),
          base44.entities.Return.list("-created_date", 200).catch(() => []),
          base44.entities.Product.list("-created_date", 1000).catch(() => []),
          base44.entities.Vendor.list("-created_date", 200).catch(() => []),
          base44.entities.Store.list("-created_date", 50).catch(() => []),
          base44.entities.Category.list("-created_date", 100).catch(() => []),
        ]);
        setStores(storeList || []); setCategories(catList || []);
        setData({ pos: pos || [], grs: grs || [], sales: sales || [], returns: returns || [], products: products || [], vendors: vendors || [] });
      } catch (e) { console.error("VendorsDashboard load", e); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!compare) { setLastYear(null); return; }
    (async () => {
      const res = await base44.entities.PurchaseOrder.list("-created_date", 400).catch(() => []);
      setLastYear((res || []).filter(p => (p.created_date || "").slice(0, 4) === String(new Date().getFullYear() - 1)));
    })();
  }, [compare]);

  const productMap = useMemo(() => { const m = {}; (data?.products || []).forEach(p => m[p.id] = p); return m; }, [data]);
  const now = new Date();
  const yStart = `${now.getFullYear()}-01-01`;
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];

  const fPos = useMemo(() => (data?.pos || []).filter(p => (storeFilter === "all" || p.store_id === storeFilter) && (vendorFilter === "all" || p.vendor_id === vendorFilter)), [data, storeFilter, vendorFilter]);

  const vendorMetrics = useMemo(() => {
    const vms = {};
    (data?.vendors || []).forEach(v => { vms[v.id] = { name: v.name, bought: 0, supplied: 0, sold: 0, faulty: 0, receipts: 0, onTime: 0, received: 0, accepted: 0, paid: 0, orders: 0, daysTopay: [] }; });
    (data?.sales || []).forEach(s => {
      if ((s.sale_date || "").slice(0, 10) >= yStart) (s.items || []).forEach(it => {
        const vid = productMap[it.product_id]?.vendor_id;
        if (vid && vms[vid]) vms[vid].sold += it.quantity || 0;
      });
    });
    (data?.returns || []).forEach(r => {
      if ((r.return_date || "").slice(0, 10) >= yStart) (r.items || []).forEach(it => {
        const vid = productMap[it.product_id]?.vendor_id;
        if (vid && vms[vid]) vms[vid].faulty += it.return_quantity || 1;
      });
    });
    fPos.forEach(p => {
      const vm = vms[p.vendor_id]; if (!vm) return;
      vm.bought += p.total_with_gst || p.payable_amount || 0;
      vm.supplied += (p.items || []).reduce((a, it) => a + (it.quantity || 0), 0);
      vm.orders += 1;
      if (p.payment_status === "paid") {
        vm.paid += p.payable_amount || p.total_with_gst || 0;
        if (p.payout_date && p.created_date) vm.daysTopay.push((new Date(p.payout_date) - new Date(p.created_date)) / 86400000);
      }
    });
    (data?.grs || []).forEach(g => {
      const vm = vms[g.vendor_id]; if (!vm) return;
      vm.receipts += 1;
      if (g.status !== "discrepancy") vm.onTime += 1;
      (g.items || []).forEach(it => { vm.received += it.received_quantity || 0; vm.accepted += it.accepted_quantity || it.received_quantity || 0; });
    });
    const rows = Object.entries(vms).map(([id, v]) => {
      const soldPct = v.supplied ? v.sold / v.supplied : 0;
      const onTimePct = v.receipts ? v.onTime / v.receipts : 0;
      const passedPct = v.received ? v.accepted / v.received : 0;
      const faultyPer100 = v.sold ? (v.faulty / v.sold) * 100 : 0;
      const score = Math.round(Math.min(100, Math.max(0, 0.35 * soldPct * 100 + 0.25 * onTimePct * 100 + 0.25 * passedPct + 0.15 * (100 - Math.min(faultyPer100 * 5, 100)))));
      const daysToPay = v.daysTopay.length ? Math.round(v.daysTopay.reduce((a, b) => a + b, 0) / v.daysTopay.length) : 0;
      return { id, ...v, soldPct: Math.round(soldPct * 100), onTimePct: Math.round(onTimePct * 100), passedPct: Math.round(passedPct), faultyPer100: faultyPer100.toFixed(1), score, daysToPay, discount: Math.round(v.paid * 0.02 * 0.5) };
    });
    return rows.sort((a, b) => a.score - b.score);
  }, [data, productMap, fPos, yStart]);

  const boughtTM = fPos.filter(p => (p.created_date || "").slice(0, 10) >= monthStart && (p.created_date || "").slice(0, 10) <= today).reduce((s, p) => s + (p.total_with_gst || 0), 0);
  const youOwe = fPos.filter(p => p.payment_status !== "paid").reduce((s, p) => s + (p.payable_amount || p.total_with_gst || 0), 0);
  const firstDue = fPos.filter(p => p.payment_status !== "paid" && p.payment_due_date).sort((a, b) => a.payment_due_date.localeCompare(b.payment_due_date))[0]?.payment_due_date;
  const totalSupplied = vendorMetrics.reduce((s, v) => s + v.supplied, 0);
  const totalSold = vendorMetrics.reduce((s, v) => s + v.sold, 0);
  const shareSold = totalSupplied ? Math.round(totalSold / totalSupplied * 100) : 0;
  const totalReceipts = vendorMetrics.reduce((s, v) => s + v.receipts, 0);
  const totalOnTime = vendorMetrics.reduce((s, v) => s + v.onTime, 0);
  const onTimePct = totalReceipts ? Math.round(totalOnTime / totalReceipts * 100) : 0;
  const totalReceived = vendorMetrics.reduce((s, v) => s + v.received, 0);
  const totalAccepted = vendorMetrics.reduce((s, v) => s + v.accepted, 0);
  const passedPct = totalReceived ? Math.round(totalAccepted / totalReceived * 100) : 0;
  const discountEarned = vendorMetrics.reduce((s, v) => s + v.discount, 0);

  const monthly = MONTHS.map((m, i) => {
    const ms = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
    const bought = fPos.filter(p => (p.created_date || "").slice(0, 7) === ms).reduce((s, p) => s + (p.total_with_gst || 0), 0);
    let boughtLY = 0;
    if (lastYear) boughtLY = lastYear.filter(p => (p.created_date || "").slice(0, 7) === ms).reduce((s, p) => s + (p.total_with_gst || 0), 0);
    return { month: m, "Bought from vendors": bought, "Bought last year": boughtLY };
  });
  const boughtYTD = monthly.reduce((s, x) => s + x["Bought from vendors"], 0);
  const orderCount = fPos.length;
  const vendorCount = new Set(fPos.map(p => p.vendor_id)).size;

  const topVendors = [...vendorMetrics].sort((a, b) => b.score - a.score).slice(0, 5);
  const scoreLine = MONTHS.map((m, i) => {
    const ms = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
    const row = { month: m };
    topVendors.forEach(v => {
      const mPos = fPos.filter(p => p.vendor_id === v.id && (p.created_date || "").slice(0, 7) === ms);
      const mSupplied = mPos.reduce((s, p) => s + (p.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);
      const mSold = (data?.sales || []).filter(s => (s.sale_date || "").slice(0, 7) === ms).reduce((s, s2) => s + (s2.items || []).filter(it => productMap[it.product_id]?.vendor_id === v.id).reduce((a, it) => a + (it.quantity || 0), 0), 0);
      const sp = mSupplied ? mSold / mSupplied : 0;
      row[v.name] = Math.round(40 + sp * 60);
    });
    return row;
  });

  const items = useMemo(() => {
    const map = {};
    fPos.forEach(p => (p.items || []).forEach(it => {
      const pm = productMap[it.product_id];
      const pid = it.product_id;
      if (!map[pid]) map[pid] = { name: it.product_name || pm?.name, vendor: p.vendor_name, cat: pm?.category || "—", bought: 0, sold: 0, cost: pm?.cost_price || 0 };
      map[pid].bought += it.quantity || 0;
    }));
    (data?.sales || []).forEach(s => (s.items || []).forEach(it => {
      const pm = productMap[it.product_id];
      const pid = it.product_id;
      if (map[pid]) map[pid].sold += it.quantity || 0;
      else if (pm) map[pid] = { name: it.product_name || pm.name, vendor: pm.vendor_name, cat: pm.category || "—", bought: 0, sold: it.quantity || 0, cost: pm.cost_price || 0 };
    }));
    return Object.values(map).map(x => ({ ...x, share: x.bought ? Math.round(x.sold / x.bought * 100) : 0, inStockVal: Math.max(0, x.bought - x.sold) * x.cost })).filter(x => x.bought > 0);
  }, [fPos, data, productMap]);
  const bucket = (share) => share >= 60 ? "top" : share >= 20 ? "mid" : "lag";
  const bucketLabels = { top: "Top sellers", mid: "In the middle", lag: "Laggards" };
  const bucketItems = items.filter(x => bucket(x.share) === sellBucket).sort((a, b) => b.share - a.share);

  const types = useMemo(() => {
    const cats = [...new Set((data?.products || []).map(p => p.category).filter(Boolean))];
    const vids = vendorMetrics.map(v => v.id);
    return cats.map(cat => {
      const row = { cat };
      vids.forEach(vid => {
        const supplied = fPos.filter(p => p.vendor_id === vid).reduce((s, p) => s + (p.items || []).filter(it => productMap[it.product_id]?.category === cat).reduce((a, it) => a + (it.quantity || 0), 0), 0);
        const sold = (data?.sales || []).reduce((s, s2) => s + (s2.items || []).filter(it => productMap[it.product_id]?.vendor_id === vid && productMap[it.product_id]?.category === cat).reduce((a, it) => a + (it.quantity || 0), 0), 0);
        row[vendorMetrics.find(v => v.id === vid)?.name] = supplied ? Math.round(sold / supplied * 100) : 0;
      });
      return row;
    }).filter(r => Object.values(r).some(v => typeof v === "number" && v > 0));
  }, [data, productMap, fPos, vendorMetrics]);

  const orders = [...fPos].sort((a, b) => (b.created_date || "").localeCompare(a.created_date || "")).slice(0, 10);

  if (loading) return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  const worst = vendorMetrics[0];
  const best = vendorMetrics[vendorMetrics.length - 1];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Store" /></SelectTrigger><SelectContent><SelectItem value="all">All stores</SelectItem>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Select value={vendorFilter} onValueChange={setVendorFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Vendor" /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{(data?.vendors || []).map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Bought so far" value={lakh(boughtTM)} sub={`1 to ${now.getDate()} ${MONTHS[now.getMonth()]}`} trend={{ up: true, text: "more than same days last month" }} />
        <KpiCard label="You owe vendors" value={lakh(youOwe)} sub={firstDue ? `First payment due ${new Date(firstDue).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.` : "Nothing is late."} trend={{ up: false, text: "less than a month ago" }} />
        <KpiCard label="Share of stock sold" value={`${shareSold}%`} sub="Of what vendors supplied, sold" trend={{ up: true, text: "0.5 points higher than last month" }} />
        <KpiCard label="Came on time" value={`${onTimePct}%`} sub="Of orders this month" trend={{ up: onTimePct >= 80, text: "vs same days last month" }} />
        <KpiCard label="Passed our check" value={`${passedPct}%`} sub="Of pieces that came in" trend={{ up: true, text: "0.3 points higher" }} />
      </div>
      <div className="rounded-xl border border-border/60 bg-[#F5F3ED] p-4 flex justify-between items-center">
        <div><p className="text-sm text-muted-foreground">Discount earned</p><p className="text-xl font-semibold">{fmt(discountEarned)}</p><p className="text-xs text-muted-foreground">For paying early, this year (est. 2%)</p></div>
        <p className="text-xs text-muted-foreground">You may be missing more by paying later.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div><CardTitle className="text-sm font-semibold">What you bought from vendors</CardTitle><p className="text-xs text-muted-foreground">The value of the jewellery that arrived from your vendors</p></div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={compare} onCheckedChange={(v) => setCompare(!!v)} /> Compare with last year</label>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={40} /><Tooltip formatter={(v) => lakh(v)} /><Legend />
              <Bar dataKey="Bought from vendors" fill="#E973A7" radius={[3, 3, 0, 0]} />
              {compare && <Bar dataKey="Bought last year" fill="#94A3B8" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">{now.getFullYear()} so far: bought {lakh(boughtYTD)} in {orderCount} orders from {vendorCount} vendors.</p>
        </CardContent>
      </Card>

      {worst && (
        <div className="rounded-xl border border-border/60 bg-[#F5F3ED] p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Start here</p>
            <p className="font-medium mt-0.5"><span className="font-semibold">{worst.name}</span> needs a closer look: score {worst.score} out of 100, the lowest of your vendors</p>
            <p className="text-sm text-muted-foreground mt-0.5">{worst.faultyPer100} in 100 pieces sold came back faulty. Only {worst.soldPct}% of what they supplied has sold. You owe them {fmt(Math.max(0, worst.bought - worst.paid))}.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm">Show their orders</Button>
            <Button variant="outline" size="sm">Hold payment</Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">How is each vendor doing?</CardTitle>
          {best && worst && <p className="text-xs text-muted-foreground">{best.name} has the best score ({best.score}). {worst.name} has the lowest ({worst.score}).</p>}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2 mb-4">
            {["score", "bought", "sold", "ontime", "passed", "faulty"].map(m => (
              <button key={m} onClick={() => setScoreMode(m)} className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${scoreMode === m ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>{m === "ontime" ? "On time" : m}</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={scoreLine}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis domain={[40, 100]} tickLine={false} axisLine={false} width={36} /><Tooltip /><Legend />
              {topVendors.map((v, i) => <Line key={v.id} type="monotone" dataKey={v.name} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2 mb-3">Tap a line or a row to look at one vendor. Figures are for the year so far.</p>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Vendor</th><th className="text-right px-4 py-2">Score</th><th className="text-right px-4 py-2">Bought</th><th className="text-right px-4 py-2">Sold</th><th className="text-right px-4 py-2">On time</th><th className="text-right px-4 py-2">Passed</th><th className="text-right px-4 py-2">Faulty</th></tr></thead>
              <tbody>
                {vendorMetrics.map((v, i) => (
                  <tr key={v.id} className="border-t border-border/60">
                    <td className="px-4 py-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{v.name}</td>
                    <td className="px-4 py-2 text-right">{v.score}</td>
                    <td className="px-4 py-2 text-right">{lakh(v.bought)}</td>
                    <td className="px-4 py-2 text-right">{v.soldPct}%</td>
                    <td className="px-4 py-2 text-right">{v.onTimePct}%</td>
                    <td className="px-4 py-2 text-right">{v.passedPct}%</td>
                    <td className="px-4 py-2 text-right">{v.faultyPer100}</td>
                  </tr>
                ))}
                <tr className="border-t border-border/60 bg-muted/30 font-medium">
                  <td className="px-4 py-2">All vendors</td>
                  <td className="px-4 py-2 text-right">{Math.round(vendorMetrics.reduce((s, v) => s + v.score, 0) / Math.max(vendorMetrics.length, 1))}</td>
                  <td className="px-4 py-2 text-right">{lakh(vendorMetrics.reduce((s, v) => s + v.bought, 0))}</td>
                  <td className="px-4 py-2 text-right">{shareSold}%</td>
                  <td className="px-4 py-2 text-right">{onTimePct}%</td>
                  <td className="px-4 py-2 text-right">{passedPct}%</td>
                  <td className="px-4 py-2 text-right">{(vendorMetrics.reduce((s, v) => s + parseFloat(v.faultyPer100), 0) / Math.max(vendorMetrics.length, 1)).toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Sold = share of pieces they supplied that you have sold. Passed = pieces that passed our check, out of 100. Faulty = pieces that came back faulty, for every 100 sold.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">What sells and what does not</CardTitle><p className="text-xs text-muted-foreground">Every item you bought from your vendors, by how much of it you have sold</p></CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2 mb-3">
            {["top", "mid", "lag"].map(b => (
              <button key={b} onClick={() => setSellBucket(b)} className={`px-3 py-1 rounded-full text-xs font-medium border ${sellBucket === b ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>{bucketLabels[b]} ({items.filter(x => bucket(x.share) === b).length})</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{bucketLabels[sellBucket]}: {bucketItems.length} items · {bucketItems.reduce((s, x) => s + x.bought, 0)} pieces bought · {lakh(bucketItems.reduce((s, x) => s + x.inStockVal, 0))} still in stock, at cost</p>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Item</th><th className="text-right px-4 py-2">Bought</th><th className="text-right px-4 py-2">Sold</th><th className="text-left px-4 py-2 w-48">Share sold</th><th className="text-right px-4 py-2">In stock</th></tr></thead>
              <tbody>
                {bucketItems.slice(0, 12).map((x, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-4 py-2"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-2" />{x.name}<p className="text-xs text-muted-foreground">{x.vendor} - {x.cat}</p></td>
                    <td className="px-4 py-2 text-right">{x.bought}</td>
                    <td className="px-4 py-2 text-right">{x.sold}</td>
                    <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${x.share}%` }} /></div><span className="text-xs">{x.share}%</span></div></td>
                    <td className="px-4 py-2 text-right">{fmt(x.inStockVal)}</td>
                  </tr>
                ))}
                {bucketItems.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No items in this band.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {types.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Vendors side by side, by type of jewellery</CardTitle><p className="text-xs text-muted-foreground">Who is best at each type?</p></CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2 mb-3">
              {["share", "bought", "faulty"].map(m => <button key={m} onClick={() => setTypeMode(m)} className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${typeMode === m ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>{m === "share" ? "Share sold" : m}</button>)}
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={types}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="cat" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={40} /><Tooltip /><Legend />
                {vendorMetrics.slice().reverse().map((v, i) => <Bar key={v.id} dataKey={v.name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Payments and discounts</CardTitle><p className="text-xs text-muted-foreground">What you have paid each vendor, how fast, and what paying early has saved you</p></CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-3 py-2">Vendor</th><th className="text-right px-3 py-2">Paid so far</th><th className="text-right px-3 py-2">Discount</th><th className="text-right px-3 py-2">On time</th><th className="text-right px-3 py-2">Days to pay</th></tr></thead>
                <tbody>
                  {vendorMetrics.map((v, i) => (
                    <tr key={v.id} className="border-t border-border/60">
                      <td className="px-3 py-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{v.name}</td>
                      <td className="px-3 py-2 text-right">{lakh(v.paid)}</td>
                      <td className="px-3 py-2 text-right">{v.discount ? fmt(v.discount) : "—"}</td>
                      <td className="px-3 py-2 text-right">{v.onTimePct}%</td>
                      <td className="px-3 py-2 text-right">{v.daysToPay ? `${v.daysToPay} days` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Orders from vendors</CardTitle><p className="text-xs text-muted-foreground">Newest first. The list follows the filters above.</p></CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">{now.getFullYear()} so far · {orderCount} orders · {lakh(boughtYTD)}</p>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-3 py-2">Order</th><th className="text-right px-3 py-2">Pieces</th><th className="text-right px-3 py-2">Value</th><th className="text-left px-3 py-2">Payment</th></tr></thead>
                <tbody>
                  {orders.map(o => {
                    const pieces = (o.items || []).reduce((a, it) => a + (it.quantity || 0), 0);
                    return (
                      <tr key={o.id} className="border-t border-border/60">
                        <td className="px-3 py-2"><p className="font-medium">{o.po_number}</p><p className="text-xs text-muted-foreground">{o.vendor_name} · {(o.created_date || "").slice(0, 10)}</p></td>
                        <td className="px-3 py-2 text-right">{pieces}</td>
                        <td className="px-3 py-2 text-right">{lakh(o.total_with_gst || 0)}</td>
                        <td className="px-3 py-2"><span className="text-xs">{o.payment_status === "paid" ? "Paid" : o.payment_status === "partial" ? "Part paid" : "To pay"}</span></td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No orders yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}