import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gem } from "lucide-react";
import { format } from "date-fns";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n) => (Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(2)} lakh` : fmt(n));
const COLORS = ["#00C48C", "#007AFF", "#FFAB00", "#FF6B9D", "#A855F7", "#71717A"];

export default function ReturnsDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [range, setRange] = useState("ytd");
  const [onlyDecide, setOnlyDecide] = useState(false);
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(8);

  const load = async () => {
    try {
      const [rets, sales, products, vendors, stores] = await Promise.all([
        base44.entities.Return.list("-return_date", 300).catch(() => []),
        base44.entities.Sale.list("-sale_date", 400).catch(() => []),
        base44.entities.Product.list("-created_date", 1000).catch(() => []),
        base44.entities.Vendor.list("-created_date", 200).catch(() => []),
        base44.entities.Store.list("-created_date", 50).catch(() => []),
      ]);
      setData({ rets: rets || [], sales: sales || [], products: products || [], vendors: vendors || [], stores: stores || [] });
    } catch (e) { console.error("ReturnsDashboard load", e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const productMap = useMemo(() => { const m = {}; (data?.products || []).forEach(p => m[p.id] = p); return m; }, [data]);
  const vendorMap = useMemo(() => { const m = {}; (data?.vendors || []).forEach(v => m[v.id] = v); return m; }, [data]);
  const saleMap = useMemo(() => { const m = {}; (data?.sales || []).forEach(s => m[s.id] = s); return m; }, [data]);
  const now = new Date();
  const yStart = `${now.getFullYear()}-01-01`;
  const d90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const inRange = (d) => { if (!d) return false; if (range === "ytd") return d.slice(0, 10) >= yStart; if (range === "90d") return d >= d90; return true; };

  // category metrics
  const catMetrics = useMemo(() => {
    const soldByCat = {}, retByCat = {}, moneyByCat = {};
    (data?.sales || []).forEach(s => { if (inRange(s.sale_date)) (s.items || []).forEach(it => { const c = productMap[it.product_id]?.category || "Other"; soldByCat[c] = (soldByCat[c] || 0) + (it.quantity || 0); }); });
    (data?.rets || []).forEach(r => { if (inRange(r.return_date)) (r.items || []).forEach(it => { const c = productMap[it.product_id]?.category || "Other"; retByCat[c] = (retByCat[c] || 0) + (it.return_quantity || 1); moneyByCat[c] = (moneyByCat[c] || 0) + (it.refund_amount || 0); }); });
    const cats = [...new Set([...Object.keys(soldByCat), ...Object.keys(retByCat)])];
    return cats.map(c => ({ cat: c, pieces: retByCat[c] || 0, money: moneyByCat[c] || 0, rate: soldByCat[c] ? Math.round((retByCat[c] || 0) / soldByCat[c] * 1000) / 10 : 0 }))
      .filter(x => x.pieces > 0).sort((a, b) => b.pieces - a.pieces);
  }, [data, productMap, range]);

  const topCats = catMetrics.slice(0, 4);
  const headline = catMetrics.slice().sort((a, b) => b.rate - a.rate)[0];
  const totalPieces = catMetrics.reduce((s, x) => s + x.pieces, 0);
  const totalMoney = catMetrics.reduce((s, x) => s + x.money, 0);
  const totalSold = (data?.sales || []).filter(s => inRange(s.sale_date)).reduce((s, s2) => s + (s2.items || []).reduce((a, it) => a + (it.quantity || 0), 0), 0);
  const totalRate = totalSold ? Math.round(totalPieces / totalSold * 1000) / 10 : 0;

  // monthly line per top category
  const lineData = MONTHS.map((m, i) => {
    const ms = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
    const row = { month: m };
    topCats.forEach(c => { row[c.cat] = (data?.rets || []).filter(r => (r.return_date || "").slice(0, 7) === ms).reduce((s, r) => s + (r.items || []).filter(it => (productMap[it.product_id]?.category || "Other") === c.cat).reduce((a, it) => a + (it.return_quantity || 1), 0), 0); });
    return row;
  });

  // flatten items
  const items = useMemo(() => {
    const rows = [];
    (data?.rets || []).forEach(r => {
      (r.items || []).forEach(it => {
        const p = productMap[it.product_id];
        const sale = saleMap[r.original_sale_id];
        const status = r.status === "pending" ? "decide" : (r.inventory_restocked ? "stock" : "vendor");
        rows.push({
          id: r.id, productName: it.product_name || p?.name, cat: p?.category || "Other", qty: it.return_quantity || 1,
          store: r.store_name, date: r.return_date, reason: r.return_reason || it.reason, refund: it.refund_amount || 0,
          vendor: vendorMap[p?.vendor_id]?.name, image: p?.image, status,
          salesperson: sale?.salesperson, saleDate: sale?.sale_date, daysBefore: sale?.sale_date ? Math.round((new Date(r.return_date) - new Date(sale.sale_date)) / 86400000) : null,
        });
      });
    });
    return rows.filter(r => inRange(r.date)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [data, productMap, saleMap, vendorMap, range]);

  const decideCount = items.filter(i => i.status === "decide").length;
  const shown = items.filter(i => !onlyDecide || i.status === "decide");
  const sel = selected || shown[0];

  const advice = (reason) => {
    const r = (reason || "").toLowerCase();
    if (r.includes("quality") || r.includes("damage")) return "Send it back to the vendor and ask for a credit note.";
    if (r.includes("wrong")) return "Check whether the right piece is still in stock and offer an exchange.";
    if (r.includes("changed")) return "Restock it and resell it. A small cleaning and re-tag may be enough.";
    return "Restock it if it is sellable, or send it back to the vendor for credit.";
  };

  const sendToVendor = async (id) => {
    try { await base44.entities.Return.update(id, { status: "approved", inventory_restocked: false }); await load(); }
    catch (e) { console.error(e); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  const statusPill = (s) => s === "decide"
    ? <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-foreground text-background">To decide</span>
    : <span className="px-2.5 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground">{s === "stock" ? "Back in stock" : "Sent to vendor"}</span>;

  return (
    <div className="space-y-5">
      {headline && <p className="text-base font-medium">{headline.cat} come back most often: {headline.rate}% of those sold.</p>}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">What comes back, by type</CardTitle><p className="text-xs text-muted-foreground">Pieces brought back each month, by type of jewellery</p></CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} /><Tooltip /><Legend />
              {topCats.map((c, i) => <Line key={c.cat} type="monotone" dataKey={c.cat} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">Tap a line or a row to show only its items in the table below. Figures are for the year so far.</p>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Type</th><th className="text-right px-4 py-2">Pieces</th><th className="text-right px-4 py-2">Money given back</th><th className="text-right px-4 py-2">Return rate</th></tr></thead>
          <tbody>
            {catMetrics.map((c, i) => (
              <tr key={c.cat} className="border-t border-border/60">
                <td className="px-4 py-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.cat}</td>
                <td className="px-4 py-2 text-right">{c.pieces}</td>
                <td className="px-4 py-2 text-right">{lakh(c.money)}</td>
                <td className="px-4 py-2 text-right">{c.rate}%</td>
              </tr>
            ))}
            <tr className="border-t border-border/60 bg-muted/30 font-medium">
              <td className="px-4 py-2">All together</td>
              <td className="px-4 py-2 text-right">{totalPieces}</td>
              <td className="px-4 py-2 text-right">{lakh(totalMoney)}</td>
              <td className="px-4 py-2 text-right">{totalRate}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Select value={range} onValueChange={setRange}><SelectTrigger className="w-36 h-8 text-xs rounded-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ytd">{now.getFullYear()} so far</SelectItem><SelectItem value="90d">Last 90 days</SelectItem><SelectItem value="all">All time</SelectItem></SelectContent></Select>
            <p className="text-xs text-muted-foreground">{shown.length} pieces · newest first · {decideCount} to decide</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground ml-auto"><Checkbox checked={onlyDecide} onCheckedChange={(v) => setOnlyDecide(!!v)} /> Only those I need to decide</label>
          </div>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Item</th><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Status</th></tr></thead>
              <tbody>
                {shown.slice(0, visible).map((it, i) => (
                  <tr key={i} className={`border-t border-border/60 cursor-pointer ${sel?.id === it.id && sel?.productName === it.productName ? "bg-accent/40" : "hover:bg-accent/20"}`} onClick={() => setSelected(it)}>
                    <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Gem className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="font-medium">{it.productName}</p><p className="text-xs text-muted-foreground">{it.qty} piece{it.qty > 1 ? "s" : ""} · {it.store}</p></div></div></td>
                    <td className="px-4 py-2.5 text-sm">{it.date ? format(new Date(it.date), "dd MMM") : "—"}</td>
                    <td className="px-4 py-2.5">{statusPill(it.status)}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No returns in this range.</td></tr>}
              </tbody>
            </table>
          </div>
          {shown.length > visible && <button onClick={() => setVisible(v => v + 8)} className="w-full mt-2 py-2 text-xs text-muted-foreground hover:bg-accent/40 rounded-md border border-border/60">Show 8 more · {shown.length - visible} items left</button>}
        </div>

        {sel && (
          <Card className="lg:sticky lg:top-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Gem className="h-4 w-4" /> Photo of this item</div>
              <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                {sel.image ? <img src={sel.image} alt={sel.productName} className="w-full h-full object-cover" /> : <Gem className="h-10 w-10 text-muted-foreground/40" />}
              </div>
              <div>
                <p className="font-semibold">{sel.productName}</p>
                <p className="text-xs text-muted-foreground">{sel.cat} · {sel.qty} piece{sel.qty > 1 ? "s" : ""}{sel.vendor ? ` · from ${sel.vendor}` : ""}</p>
              </div>
              <p className="text-sm">Brought back {sel.date ? format(new Date(sel.date), "dd MMMM") : "—"} to {sel.store}</p>
              {sel.salesperson && <p className="text-sm">Sold by {sel.salesperson} on {sel.saleDate ? format(new Date(sel.saleDate), "dd MMM") : "—"}{sel.daysBefore != null ? ` (${sel.daysBefore} days before)` : ""}</p>}
              <p className="text-sm">Reason: {sel.reason || "—"}</p>
              <p className="text-sm">Money given back: {fmt(sel.refund)}</p>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-semibold mb-0.5">What we suggest</p>
                <p className="text-sm text-muted-foreground">{advice(sel.reason)}</p>
              </div>
              {sel.status === "decide" && <Button className="w-full" onClick={() => sendToVendor(sel.id)}>Send back to the vendor</Button>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}