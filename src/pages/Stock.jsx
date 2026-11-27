import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Gem, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/erp/PageHeader";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(2)} lakh` : fmt(n));
const ageMonths = (d) => { if (!d) return 0; return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / (86400000 * 30))); };

const STATUS = {
  not: { label: "Not selling", color: "#d32f2f", bg: "#fce4ec" },
  slow: { label: "Slow", color: "#e67e55", bg: "#fff3e0" },
  well: { label: "Selling well", color: "#388e3c", bg: "#e8f5e9" },
};

function classify(inv, sold90Map) {
  const sold = sold90Map[inv.product_id] || 0;
  if (sold === 0) return "not";
  if (sold < (inv.quantity || 0) * 0.1) return "slow";
  return "well";
}

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

export default function Stock() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [storeFilter, setStoreFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [compare, setCompare] = useState(false);
  const [lastYearData, setLastYearData] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedInv, setSelectedInv] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [inventory, products, sales, pos, storeList, catList, vendorList] = await Promise.all([
          base44.entities.Inventory.list("-created_date", 1000).catch(() => []),
          base44.entities.Product.list("-created_date", 1000).catch(() => []),
          base44.entities.Sale.list("-sale_date", 600).catch(() => []),
          base44.entities.PurchaseOrder.list("-created_date", 300).catch(() => []),
          base44.entities.Store.list("-created_date", 50).catch(() => []),
          base44.entities.Category.list("-created_date", 100).catch(() => []),
          base44.entities.Vendor.list("-created_date", 200).catch(() => []),
        ]);
        setStores(storeList || []); setCategories(catList || []); setVendors(vendorList || []);
        setData({ inventory: inventory || [], products: products || [], sales: sales || [], pos: pos || [] });
      } catch (e) { console.error("Stock load", e); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!compare) { setLastYearData(null); return; }
    (async () => {
      const res = await base44.entities.Sale.list("-sale_date", 600).catch(() => []);
      const ly = (res || []).filter(s => (s.sale_date || "").slice(0, 4) === String(new Date().getFullYear() - 1));
      setLastYearData(ly);
    })();
  }, [compare]);

  const productMap = useMemo(() => { const m = {}; (data?.products || []).forEach(p => m[p.id] = p); return m; }, [data]);

  const sold90Map = useMemo(() => {
    const m = {}; const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    (data?.sales || []).forEach(s => { if ((s.sale_date || "").slice(0, 10) >= cutoff) (s.items || []).forEach(it => { m[it.product_id] = (m[it.product_id] || 0) + (it.quantity || 0); }); });
    return m;
  }, [data]);

  const filteredInv = useMemo(() => {
    if (!data) return [];
    return data.inventory.filter(inv => {
      const p = productMap[inv.product_id];
      if (!p) return false;
      if (storeFilter !== "all" && inv.store_id !== storeFilter) return false;
      if (catFilter !== "all" && p.category !== catFilter) return false;
      if (vendorFilter !== "all" && p.vendor_id !== vendorFilter) return false;
      if (ageFilter !== "all") {
        const a = ageMonths(p.purchase_date);
        if (ageFilter === "3" && a < 3) return false;
        if (ageFilter === "6" && a < 6) return false;
        if (ageFilter === "12" && a < 12) return false;
      }
      return true;
    });
  }, [data, productMap, storeFilter, catFilter, vendorFilter, ageFilter]);

  const invStatus = useMemo(() => filteredInv.map(inv => ({ inv, p: productMap[inv.product_id], status: classify(inv, sold90Map) })), [filteredInv, productMap, sold90Map]);

  // KPIs
  const piecesInStock = invStatus.reduce((s, x) => s + (x.inv.quantity || 0), 0);
  const valueStock = invStatus.reduce((s, x) => s + (x.inv.quantity || 0) * ((x.p?.cost_price) || 0), 0);
  const notSelling = invStatus.filter(x => x.status === "not");
  const notSellingPieces = notSelling.reduce((s, x) => s + (x.inv.quantity || 0), 0);
  const notSellingValue = notSelling.reduce((s, x) => s + (x.inv.quantity || 0) * ((x.p?.cost_price) || 0), 0);
  const older6 = invStatus.filter(x => ageMonths(x.p?.purchase_date) >= 6);
  const older6Pieces = older6.reduce((s, x) => s + (x.inv.quantity || 0), 0);

  // monthly sold/bought pieces
  const now = new Date();
  const monthly = MONTHS.map((m, i) => {
    const ms = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
    const sold = (data?.sales || []).filter(s => (s.sale_date || "").slice(0, 7) === ms).reduce((s, x) => s + (x.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);
    const bought = (data?.pos || []).filter(p => (p.created_date || "").slice(0, 7) === ms).reduce((s, x) => s + (x.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);
    let soldLY = 0;
    if (lastYearData) soldLY = lastYearData.filter(s => (s.sale_date || "").slice(0, 7) === ms).reduce((s, x) => s + (x.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);
    return { month: m, Sold: sold, Bought: bought, "Sold last year": soldLY };
  });
  const soldYTD = monthly.reduce((s, x) => s + x.Sold, 0);
  const boughtYTD = monthly.reduce((s, x) => s + x.Bought, 0);

  // "Start here" worst item
  const startHere = useMemo(() => {
    const ns = invStatus.filter(x => x.status === "not").sort((a, b) => ageMonths(b.p?.purchase_date) - ageMonths(a.p?.purchase_date) || (b.inv.quantity || 0) - (a.inv.quantity || 0));
    return ns[0] || null;
  }, [invStatus]);

  // category breakdown
  const catBreakdown = useMemo(() => {
    const groups = {};
    invStatus.forEach(x => { const c = x.p?.category || "Uncategorized"; if (!groups[c]) groups[c] = { not: 0, slow: 0, well: 0, total: 0 }; groups[c][x.status] += (x.inv.quantity || 0); groups[c].total += (x.inv.quantity || 0); });
    return Object.entries(groups).map(([cat, v]) => ({ cat, ...v, notPct: v.total ? Math.round(v.not / v.total * 100) : 0 })).sort((a, b) => b.total - a.total);
  }, [invStatus]);

  // items list for selected category (oldest first)
  const listItems = useMemo(() => {
    const cat = selectedCat || catBreakdown[0]?.cat;
    if (!cat) return [];
    return invStatus.filter(x => (x.p?.category || "Uncategorized") === cat).sort((a, b) => ageMonths(b.p?.purchase_date) - ageMonths(a.p?.purchase_date));
  }, [invStatus, selectedCat, catBreakdown]);

  // per-store breakdown for selected item
  const itemStores = useMemo(() => {
    if (!selectedInv) return [];
    return (data?.inventory || []).filter(i => i.product_id === selectedInv.inv.product_id).reduce((m, i) => { m[i.store_name || "—"] = (m[i.store_name || "—"] || 0) + (i.quantity || 0); return m; }, {});
  }, [selectedInv, data]);

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Stock" description="Your shop at a glance" />

      {/* filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Store" /></SelectTrigger><SelectContent><SelectItem value="all">All stores</SelectItem>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={vendorFilter} onValueChange={setVendorFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Vendor" /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
        <Select value={ageFilter} onValueChange={setAgeFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Older than" /></SelectTrigger><SelectContent><SelectItem value="all">Any age</SelectItem><SelectItem value="3">3 months</SelectItem><SelectItem value="6">6 months</SelectItem><SelectItem value="12">12 months</SelectItem></SelectContent></Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Pieces in stock" value={piecesInStock.toLocaleString("en-IN")} sub="In all stores" trend={{ up: true, text: "more than last month" }} />
        <KpiCard label="Value of stock" value={lakh(valueStock)} sub="At what you paid" trend={{ up: true, text: "more than last month" }} />
        <KpiCard label="Not selling" value={`${notSellingPieces} pieces`} sub={`${piecesInStock ? Math.round(notSellingPieces / piecesInStock * 100) : 0}% of stock - ${lakh(notSellingValue)}`} trend={{ up: false, text: "more than last month" }} />
        <KpiCard label="Older than 6 months" value={`${older6Pieces} pieces`} sub={`${piecesInStock ? Math.round(older6Pieces / piecesInStock * 100) : 0}% of stock`} trend={{ up: false, text: "more than last month" }} />
      </div>

      {/* stock in/out chart */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div><CardTitle className="text-sm font-semibold">Stock coming in and going out</CardTitle><p className="text-xs text-muted-foreground">Pieces sold, and pieces bought from vendors</p></div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={compare} onCheckedChange={(v) => setCompare(!!v)} /> Compare with last year</label>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Sold" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Bought" fill="#F472B6" radius={[3, 3, 0, 0]} />
              {compare && <Bar dataKey="Sold last year" fill="#94A3B8" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">2026 so far: sold {soldYTD.toLocaleString("en-IN")} pieces, bought {boughtYTD.toLocaleString("en-IN")} pieces. Stock {soldYTD <= boughtYTD ? "grew" : "shrank"} by {Math.abs(boughtYTD - soldYTD).toLocaleString("en-IN")} pieces, because you {soldYTD <= boughtYTD ? "bought more than you sold" : "sold more than you bought"}.</p>
        </CardContent>
      </Card>

      {/* start here */}
      {startHere && (
        <div className="rounded-xl border border-border/60 bg-[#F5F3ED] p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Start here</p>
            <p className="font-medium mt-0.5"><span className="font-semibold">{startHere.p?.name}</span>: {startHere.inv.quantity} pieces have not sold</p>
            <p className="text-sm text-muted-foreground mt-0.5">Bought {ageMonths(startHere.p?.purchase_date)} months ago. Lower the price by 20%. {startHere.inv.store_name} has the most.</p>
          </div>
          <Button onClick={() => setSelectedInv(startHere)}>Show me <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* category breakdown + items list */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">1. Pick a type of jewellery</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: STATUS.not.color }} /> Not selling — nothing sold in 3 months</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: STATUS.slow.color }} /> Slow — selling, but slower than it should</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: STATUS.well.color }} /> Selling well — stock is moving</span>
              </div>
              <div className="space-y-4">
                {catBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No inventory to show.</p>}
                {catBreakdown.map(c => (
                  <button key={c.cat} onClick={() => setSelectedCat(c.cat)} className="block w-full text-left">
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{c.cat}</span><span className="text-muted-foreground">{c.total} pieces - {c.notPct}% not selling</span></div>
                    <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
                      <div style={{ width: `${c.total ? c.not / c.total * 100 : 0}%`, background: STATUS.not.color }} />
                      <div style={{ width: `${c.total ? c.slow / c.total * 100 : 0}%`, background: STATUS.slow.color }} />
                      <div style={{ width: `${c.total ? c.well / c.total * 100 : 0}%`, background: STATUS.well.color }} />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">2. Items in {selectedCat || catBreakdown[0]?.cat || "—"} (oldest first)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <table className="w-full text-sm">
                <thead><tr className="text-muted-foreground"><th className="text-left py-2">Item</th><th className="text-left py-2">Age</th><th className="text-left py-2">Status</th></tr></thead>
                <tbody>
                  {listItems.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No items.</td></tr>}
                  {listItems.map((x, i) => (
                    <tr key={i} className="border-t border-border/60 cursor-pointer hover:bg-muted/40" onClick={() => setSelectedInv(x)}>
                      <td className="py-2"><p className="font-medium">{x.p?.name}</p><p className="text-xs text-muted-foreground">{x.inv.quantity} pieces</p></td>
                      <td className="py-2">{ageMonths(x.p?.purchase_date)} months</td>
                      <td className="py-2"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: STATUS[x.status].bg, color: STATUS[x.status].color }}>{STATUS[x.status].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* detail card */}
        <div>
          {selectedInv ? (
            <Card className="sticky top-4">
              <CardContent className="pt-5">
                <div className="h-40 w-full rounded-lg bg-muted flex items-center justify-center mb-3">
                  {selectedInv.p?.images?.[0] ? <img src={selectedInv.p.images[0]} alt="" className="h-full w-full object-cover rounded-lg" /> : <Gem className="h-10 w-10 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">Photo of this item</p>
                <h3 className="text-lg font-semibold mt-2">{selectedInv.p?.name}</h3>
                <p className="text-sm mt-1">{STATUS[selectedInv.status].label} - {selectedInv.inv.quantity} pieces - from {selectedInv.p?.vendor_name || "—"}</p>
                <p className="text-sm text-muted-foreground mt-1">Bought {selectedInv.p?.purchase_date ? new Date(selectedInv.p.purchase_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"} ({ageMonths(selectedInv.p?.purchase_date)} months ago)</p>
                <p className="text-sm text-muted-foreground mt-2">Where: {Object.entries(itemStores).map(([s, q]) => `${s} ${q}`).join(", ") || "—"}</p>
                <div className="rounded-lg bg-muted/50 p-3 mt-3">
                  <p className="text-xs font-medium text-muted-foreground">What we suggest</p>
                  <p className="text-sm mt-1">{selectedInv.status === "not" ? "Lower the price by 20% to move this stock." : selectedInv.status === "slow" ? "Nothing to do yet. Look at it again next month." : "Keep going. Stock is moving well."}</p>
                </div>
                <Button className="w-full mt-3" onClick={() => toast({ title: "Got it", description: "We will remind you next month about this item." })}>Remind me next month</Button>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">Pick an item to see its details.</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}