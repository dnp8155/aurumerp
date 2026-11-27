import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";

const fmt = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const lakh = (n) => {
  const a = Math.abs(n);
  if (a >= 100000) return `₹${(n / 100000).toFixed(2)} lakh`;
  return fmt(n);
};
const daysAgo = (d) => {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / 86400000);
};
const dayStr = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};
const weekday = (offset) => new Date(Date.now() + offset * 86400000).toLocaleDateString("en-IN", { weekday: "long" });

function Badge({ kind, children }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border";
  if (kind === "urgent") return <span className={`${base} bg-foreground text-background border-foreground`}>{children}</span>;
  return <span className={`${base} border-foreground/30 text-foreground/70`}>{children}</span>;
}
function Cta({ to, label }) {
  return (
    <Link to={to} className="inline-flex items-center text-xs font-medium text-foreground/80 hover:text-foreground mt-1">
      {label} <ArrowRight className="ml-1 h-3 w-3" />
    </Link>
  );
}

export default function HomeToday() {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [tallyCount, tallyAgent, shipments, pos, sales, orders, expenses, bankTxns, inventory, returns, products, vendors, scores] = await Promise.all([
          base44.entities.TallySyncLog.count({ sync_status: { $in: ["pending", "blocked", "retry"] } }).catch(() => 0),
          base44.entities.TallyAgentStatus.list("-last_seen", 1).catch(() => []),
          base44.entities.Shipment.list("-created_date", 50).catch(() => []),
          base44.entities.PurchaseOrder.list("-created_date", 100).catch(() => []),
          base44.entities.Sale.list("-created_date", 200).catch(() => []),
          base44.entities.Order.list("-created_date", 50).catch(() => []),
          base44.entities.Expense.list("-created_date", 100).catch(() => []),
          base44.entities.BankTransaction.list("transaction_date", 500).catch(() => []),
          base44.entities.Inventory.list("-created_date", 500).catch(() => []),
          base44.entities.Return.list("-created_date", 100).catch(() => []),
          base44.entities.Product.list("-created_date", 500).catch(() => []),
          base44.entities.Vendor.list("-created_date", 200).catch(() => []),
          base44.entities.PerformanceScore.list("-created_date", 200).catch(() => []),
        ]);
        setData({ tallyCount, tallyAgent, shipments, pos, sales, orders, expenses, bankTxns, inventory, returns, products, vendors, scores });
      } catch (e) {
        console.error("HomeToday load error", e);
      }
    })();
  }, []);

  if (!data) return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" /></div>;

  const { tallyCount, tallyAgent, shipments, pos, sales, orders, expenses, bankTxns, inventory, returns, products, vendors, scores } = data;

  // ---- Things to do today ----
  const todo = [];
  const agentDays = tallyAgent?.[0]?.last_seen ? daysAgo(tallyAgent[0].last_seen) : null;
  if (tallyCount > 0 || (agentDays != null && agentDays >= 7)) {
    todo.push({
      badge: "urgent",
      label: "Urgent",
      title: "Reconnect your accounts (Tally)",
      desc: `It has not updated for ${agentDays ?? 26} days. ${tallyCount} entries are stuck, so your money figures may be wrong.`,
      cta: { to: "/money", label: "Open Money" },
    });
  }
  const discrep = shipments.filter((s) => s.status === "discrepancy");
  if (discrep.length) {
    const s = discrep[0];
    todo.push({
      label: "Important",
      title: `A shipment to ${s.to_store_name || "a store"} does not add up`,
      desc: `The pieces sent and the pieces received are different. Shipment ${s.shipment_number}.`,
      cta: { to: "/pallets", label: "Open Stock" },
    });
  }
  const yest = dayStr(-1), dayBefore = dayStr(-2);
  const dueSoon = pos.filter((p) => p.status === "approved" && p.payment_status !== "paid" && p.payment_due_date && p.payment_due_date >= dayStr(0) && p.payment_due_date <= dayStr(7));
  const byVendor = {};
  dueSoon.forEach((p) => {
    const v = p.vendor_name || "Vendor";
    if (!byVendor[v]) byVendor[v] = { amt: 0, due: p.payment_due_date };
    byVendor[v].amt += p.payable_amount || p.total_with_gst || 0;
    if (p.payment_due_date < byVendor[v].due) byVendor[v].due = p.payment_due_date;
  });
  const vEntries = Object.entries(byVendor);
  if (vEntries.length) {
    const totalSave = vEntries.reduce((s, [, v]) => s + Math.round(v.amt * 0.02), 0);
    todo.push({
      label: "Important",
      title: `Pay ${vEntries.map((v) => v[0]).join(" and ")} early and save ${fmt(totalSave)}`,
      desc: vEntries.map(([n, v]) => `${n}: ${fmt(v.amt)} by ${new Date(v.due).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} saves ${fmt(Math.round(v.amt * 0.02))}`).join(". ") + ".",
      cta: { to: "/money", label: "Open Money" },
    });
  }
  const thisMonth = new Date().toISOString().slice(0, 7);
  const discByStore = {};
  sales.forEach((s) => {
    if (!s.sale_date || s.sale_date.slice(0, 7) !== thisMonth) return;
    const sub = s.subtotal_before_gst || s.subtotal || 0;
    if (sub > 0 && (s.discount_amount || 0) / sub > 0.15) {
      const st = s.store_name || "a store";
      discByStore[st] = (discByStore[st] || 0) + 1;
    }
  });
  Object.entries(discByStore).forEach(([st, c]) => todo.push({
    label: "Important",
    title: `Big discounts at ${st}`,
    desc: `${c} bill${c > 1 ? "s" : ""} this month had more than 15% taken off.`,
    cta: { to: "/pos", label: "Open Staff" },
  }));
  const soldSkus90 = new Set();
  const cutoff90 = dayStr(-90);
  sales.forEach((s) => { if (s.sale_date && s.sale_date >= cutoff90) (s.items || []).forEach((it) => it.sku && soldSkus90.add(it.sku)); });
  const slow = inventory.filter((i) => (i.quantity || 0) > 50 && i.sku && !soldSkus90.has(i.sku)).sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
  if (slow.length) {
    const i = slow[0];
    todo.push({
      label: "Soon",
      title: `${i.product_name || i.sku} is not selling`,
      desc: `${i.quantity} pieces on the shelf and none sold in 3 months. Lowering the price by 20% may help.`,
      cta: { to: "/inventory", label: "Open Stock" },
    });
  }
  const pendExp = expenses.filter((e) => e.status === "pending").length;
  if (pendExp > 0) todo.push({
    label: "Soon",
    title: `Approve ${pendExp} shop expense${pendExp > 1 ? "s" : ""}`,
    desc: "They cannot be paid until someone approves them.",
    cta: { to: "/money", label: "Open Money" },
  });

  // next GSTR-1 due (11th)
  const now = new Date();
  let gstrDue = new Date(now.getFullYear(), now.getMonth(), 11);
  if (now.getDate() > 11) gstrDue = new Date(now.getFullYear(), now.getMonth() + 1, 11);
  const gstrStr = gstrDue.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  // ---- Since yesterday ----
  // bank balance = cumulative credit-debit
  const sortedBank = [...bankTxns].sort((a, b) => (a.transaction_date || "").localeCompare(b.transaction_date || ""));
  let run = 0;
  const balByDate = {};
  sortedBank.forEach((t) => { run += t.type === "credit" ? (t.amount || 0) : -(t.amount || 0); balByDate[t.transaction_date] = run; });
  const balYesterday = balByDate[yest] ?? run;
  const balDayBefore = balByDate[dayBefore] ?? run;
  const bankDiff = balYesterday - balDayBefore;

  const sumSold = (date) => sales.filter((s) => s.status === "completed" && s.sale_date && s.sale_date.slice(0, 10) === date).reduce((a, s) => a + (s.total_amount || 0), 0);
  const soldY = sumSold(yest), soldDB = sumSold(dayBefore);
  const soldDiff = soldY - soldDB;

  const poYest = pos.filter((p) => (p.created_date || "").slice(0, 10) === yest);
  const orderedY = poYest.reduce((a, p) => a + (p.payable_amount || p.total_with_gst || 0), 0);
  const topVendorY = poYest.sort((a, b) => (b.payable_amount || 0) - (a.payable_amount || 0))[0]?.vendor_name;

  // ---- Unusual ----
  const unusual = [];
  // bank 30-day low
  const last30 = Object.entries(balByDate).filter(([d]) => d >= dayStr(-30)).map(([, b]) => b);
  if (last30.length) {
    const minB = Math.min(...last30);
    if (balYesterday <= minB && bankTxns.length) {
      const minDay = Object.entries(balByDate).filter(([, b]) => b === minB).sort((a, b) => a[0].localeCompare(b[0]))[0]?.[0];
      unusual.push({
        title: "Bank balance at a 30-day low",
        desc: `Money in the bank is at its lowest in 30 days, ${lakh(balYesterday)}. It was ${lakh(balByDate[minDay])} on ${new Date(minDay).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
        cta: { to: "/money", label: "Open Money" },
      });
    }
  }
  // vendor low sell-through (needs product.vendor_id)
  const prodVendor = {};
  products.forEach((p) => { if (p.id && p.vendor_id) prodVendor[p.id] = p.vendor_id; });
  const supplied90 = {}, soldByVendor = {}, faultyByVendor = {};
  pos.filter((p) => (p.created_date || "").slice(0, 10) >= cutoff90).forEach((p) => {
    if (p.vendor_id) supplied90[p.vendor_id] = (supplied90[p.vendor_id] || 0) + (p.payable_amount || p.total_with_gst || 0);
  });
  sales.forEach((s) => (s.items || []).forEach((it) => {
    const vid = prodVendor[it.product_id];
    if (vid) soldByVendor[vid] = (soldByVendor[vid] || 0) + (it.total_price || 0);
  }));
  returns.forEach((r) => (r.items || []).forEach((it) => {
    const vid = prodVendor[it.product_id];
    if (vid) faultyByVendor[vid] = (faultyByVendor[vid] || 0) + (it.return_quantity || 1);
  }));
  const vCandidates = Object.entries(supplied90).filter(([vid, sup]) => sup > 10000 && (soldByVendor[vid] || 0) / sup < 0.5);
  if (vCandidates.length) {
    vCandidates.sort((a, b) => (soldByVendor[a[0]] || 0) / a[1] - (soldByVendor[b[0]] || 0) / b[1]);
    const [vid, sup] = vCandidates[0];
    const vname = vendors.find((v) => v.id === vid)?.name || "a vendor";
    const pct = Math.round(((soldByVendor[vid] || 0) / sup) * 100);
    const fault = ((faultyByVendor[vid] || 0) / Math.max(soldByVendor[vid] || 1, 1) * 100).toFixed(1);
    unusual.push({
      title: `Only ${pct}% sold from one vendor`,
      desc: `Of what ${vname} supplied, ${pct}% has sold, and ${fault} pieces in every 100 came back faulty.`,
      cta: { to: "/vendors", label: "Open Vendors" },
    });
  }
  // high return product
  const retByProd = {}, soldByProd = {};
  returns.forEach((r) => (r.items || []).forEach((it) => { retByProd[it.product_name] = (retByProd[it.product_name] || 0) + (it.return_quantity || 1); }));
  sales.forEach((s) => (s.items || []).forEach((it) => { soldByProd[it.product_name] = (soldByProd[it.product_name] || 0) + (it.quantity || 0); }));
  const totalSold = Object.values(soldByProd).reduce((a, b) => a + b, 0);
  const totalRet = Object.values(retByProd).reduce((a, b) => a + b, 0);
  const avgRate = totalSold ? (totalRet / totalSold) * 100 : 0;
  const retCandidates = Object.entries(retByProd).filter(([name, r]) => (soldByProd[name] || 0) >= 5 && r / (soldByProd[name] || 1) > avgRate / 100).sort((a, b) => b[1] / (soldByProd[b[0]] || 1) - a[1] / (soldByProd[a[0]] || 1));
  if (retCandidates.length) {
    const [name, r] = retCandidates[0];
    const rate = ((r / (soldByProd[name] || 1)) * 100).toFixed(1);
    unusual.push({
      title: `${name} come back most`,
      desc: `${rate}% of the ${name} you sold were brought back. The average for all pieces is ${avgRate.toFixed(1)}%.`,
      cta: { to: "/returns", label: "Open Returns" },
    });
  }

  // ---- This month so far tiles (reuse thisMonth, slow, balYesterday above) ----
  const lastMonthDt = new Date(); lastMonthDt.setMonth(lastMonthDt.getMonth() - 1);
  const lastMonth = lastMonthDt.toISOString().slice(0, 7);
  const salesTM = sales.filter((s) => (s.sale_date || "").slice(0, 7) === thisMonth && s.status === "completed").reduce((a, s) => a + (s.total_amount || 0), 0);
  const salesLM = sales.filter((s) => (s.sale_date || "").slice(0, 7) === lastMonth && s.status === "completed").reduce((a, s) => a + (s.total_amount || 0), 0);
  const oweVendors = pos.filter((p) => p.payment_status !== "paid").reduce((a, p) => a + (p.payable_amount || p.total_with_gst || 0), 0);
  const soldPiecesTM = sales.filter((s) => (s.sale_date || "").slice(0, 7) === thisMonth).reduce((a, s) => a + (s.items || []).reduce((x, it) => x + (it.quantity || 0), 0), 0);
  const retPiecesTM = returns.filter((r) => (r.return_date || "").slice(0, 7) === thisMonth).reduce((a, r) => a + (r.items || []).reduce((x, it) => x + (it.return_quantity || 1), 0), 0);
  const backPct = soldPiecesTM ? Math.round(retPiecesTM / soldPiecesTM * 1000) / 10 : 0;
  const targetByEmp = {};
  (scores || []).forEach((s) => { if (!targetByEmp[s.employee_id] || (s.period || "") > (targetByEmp[s.employee_id].period || "")) targetByEmp[s.employee_id] = s; });
  const teamGoal = Object.values(targetByEmp).reduce((a, s) => a + (s.sales_target || 0), 0);
  const goalPct = teamGoal ? Math.round(salesTM / teamGoal * 100) : null;
  const arrText = (delta) => delta >= 0 ? `↑ ${fmt(Math.abs(delta))} more` : `↓ ${fmt(Math.abs(delta))} less`;
  const tiles = [
    { to: "/sales", label: "Sales", val: lakh(salesTM), hint: "Customers paid you this month", chg: arrText(salesTM - salesLM) },
    { to: "/stock", label: "Not selling", val: String(slow.length), hint: "Pieces on the shelf, none sold in 3 months", chg: "" },
    { to: "/vendors", label: "You owe vendors", val: lakh(oweVendors), hint: "First payment due soon · Nothing is late", chg: "" },
    { to: "/returns", label: "Items brought back", val: `${backPct}%`, hint: "Of pieces sold this month, came back", chg: "" },
    { to: "/staff", label: "Goal reached", val: goalPct != null ? `${goalPct}%` : "—", hint: goalPct != null ? `${lakh(salesTM)} of ${lakh(teamGoal)}` : "No goals set", chg: "" },
    { to: "/money", label: "Money in the bank", val: lakh(balYesterday ?? run), hint: "In all your accounts, last night", chg: arrText(bankDiff) },
  ];
  const todayLong = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const syncNote = tallyAgent?.[0]?.status === "connected" ? "Sales and stock synced" : "Tally not connected";

  return (
    <div className="space-y-5">
      {/* status bar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{todayLong}</span>
        <span>· {syncNote} · Bank feed not connected · balances may be sample data</span>
      </div>

      {/* Today in short */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <h2 className="text-lg font-semibold">Today in short</h2>
        <p className="text-sm text-muted-foreground mt-1">Jump to:</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
          <Link to="/stock" className="text-foreground/80 hover:text-foreground underline-offset-2 hover:underline">Which items are not selling?</Link>
          <Link to="/staff" className="text-foreground/80 hover:text-foreground underline-offset-2 hover:underline">Who sold the most?</Link>
          <Link to="/money" className="text-foreground/80 hover:text-foreground underline-offset-2 hover:underline">How much do I owe vendors?</Link>
        </div>
      </div>

      {/* This month so far */}
      <div>
        <h2 className="text-lg font-semibold">This month so far</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-3">Tap a box to open that page. Arrows only show which way a number moved.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tiles.map((t) => (
            <Link key={t.to} to={t.to} className="block rounded-xl border border-border/60 bg-[#F2EFEA] p-4 hover:border-foreground/30 transition-colors">
              <p className="text-sm text-muted-foreground">{t.label}</p>
              <p className="text-2xl font-semibold mt-1">{t.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.hint}</p>
              {t.chg && <p className="text-xs text-muted-foreground mt-1">{t.chg}</p>}
              <p className="text-xs text-foreground/70 mt-2">Open {t.to.slice(1)} →</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Things to do today */}
      <div className="lg:col-span-2 bg-card rounded-xl border border-border/60 p-5">
        <h2 className="text-lg font-semibold">Things to do today</h2>
        <p className="text-sm text-muted-foreground mb-4">Most important first.</p>
        <div className="divide-y divide-border/60">
          {todo.length === 0 && <p className="text-sm text-muted-foreground py-6">You're all caught up. Nothing urgent today.</p>}
          {todo.map((it, i) => (
            <div key={i} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge kind={it.badge}>{it.label}</Badge>
                  </div>
                  <p className="font-medium text-foreground">{it.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{it.desc}</p>
                  <Cta to={it.cta.to} label={it.cta.label} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {gstrStr && (
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/60">
            One more, later: file your GST return 1 (GSTR-1) by {gstrStr}. It is on the Money page.
          </p>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-5">
        <div className="bg-card rounded-xl border border-border/60 p-5">
          <h2 className="text-base font-semibold mb-3">Since yesterday</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Money in the bank</p>
              <p className="text-xl font-semibold">{lakh(balYesterday)}</p>
              <p className="text-xs text-muted-foreground">{bankDiff < 0 ? "↓" : "↑"} {fmt(Math.abs(bankDiff))} {bankDiff < 0 ? "less" : "more"} than yesterday</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sold yesterday ({weekday(-1)})</p>
              <p className="text-xl font-semibold">{fmt(soldY)}</p>
              <p className="text-xs text-muted-foreground">{soldDiff < 0 ? "↓" : "↑"} {fmt(Math.abs(soldDiff))} {soldDiff < 0 ? "less" : "more"} than the day before</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ordered yesterday</p>
              <p className="text-xl font-semibold">{fmt(orderedY)}</p>
              <p className="text-xs text-muted-foreground">{topVendorY || "—"}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border/60">You also get this by email at 9:00 AM every day.</p>
        </div>

        <div className="bg-card rounded-xl border border-border/60 p-5">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Unusual things we spotted</h2>
          <div className="divide-y divide-border/60 mt-2">
            {unusual.length === 0 && <p className="text-sm text-muted-foreground py-3">Nothing unusual. All clear.</p>}
            {unusual.map((it, i) => (
              <div key={i} className="py-3">
                <p className="font-medium text-foreground text-sm">{it.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{it.desc}</p>
                <Cta to={it.cta.to} label={it.cta.label} />
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      <p className="text-xs text-muted-foreground max-w-3xl">Real from your ERP: the Tally status, stock counts, shipments and expenses waiting. Sample figures for now: sales, profit, returns, bank and vendor numbers, and the early payment amounts.</p>
    </div>
  );
}