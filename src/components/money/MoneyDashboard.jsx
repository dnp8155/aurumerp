import React, { useMemo, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatLakh, formatFull, monthShort, monthLong, ymd } from "./moneyUtils";

function Kpi({ label, value, sub, trend }) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#F2EFEA] p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      {trend && <p className={`text-xs mt-1 ${trend.up ? "text-emerald-600" : "text-rose-600"}`}>{trend.up ? "↑" : "↓"} {trend.text}</p>}
    </div>
  );
}

function Pill({ tone, children }) {
  const styles = { urgent: "bg-neutral-900 text-white", important: "bg-neutral-200 text-neutral-800", soon: "bg-neutral-200 text-neutral-800", later: "bg-neutral-200 text-neutral-800" };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[tone] || styles.important}`}>{children}</span>;
}

export default function MoneyDashboard({ data, pickedMonth, pickedDay, setPickedMonth, setPickedDay }) {
  const [year, setYear] = useState(data.year);
  const [compareLY, setCompareLY] = useState(false);
  const [compare30, setCompare30] = useState(false);
  const [shopMetric, setShopMetric] = useState("profit");
  const [compareLM, setCompareLM] = useState(false);
  const [payFilter, setPayFilter] = useState("all");
  const [payVisible, setPayVisible] = useState(12);
  const k = data.kpis;

  // monthly flow chart
  const flow = useMemo(() => data.monthlyFlow.map((m, i) => ({
    month: m.month, "Came in": m.in, "Went out": m.out,
    "Came in last year": compareLY ? data.monthlyFlowPrev[i]?.in : 0,
    "Went out last year": compareLY ? data.monthlyFlowPrev[i]?.out : 0,
  })), [data, compareLY]);
  const inYTD = data.monthlyFlow.reduce((s, m) => s + m.in, 0);
  const outYTD = data.monthlyFlow.reduce((s, m) => s + m.out, 0);
  const keptYTD = inYTD - outYTD;

  // bank daily line (last 30)
  const bankLine = data.bankDaily30.map((d) => ({ date: d.date, balance: d.balance }));
  const bankLow = bankLine.length ? Math.min(...bankLine.map(b => b.balance)) : 0;
  const bankHigh = bankLine.length ? Math.max(...bankLine.map(b => b.balance)) : 0;
  const bankLast = bankLine.length ? bankLine[bankLine.length - 1].balance : k.bank;

  // accounts with since-yesterday delta
  const accounts = data.accounts.map((a) => {
    const dates = Object.keys(a.daily).sort();
    const last = dates.length ? a.daily[dates[dates.length - 1]] : a.balance;
    const prev = dates.length > 1 ? a.daily[dates[dates.length - 2]] : last;
    return { name: a.name, balance: last, delta: last - prev };
  });

  // safety ratio
  const obligations = k.oweVendors + k.gstPay + k.shopExpenses;
  const safeRatio = obligations ? k.bank / obligations : 0;
  const safeLabel = safeRatio >= 1.5 ? "Safe" : safeRatio >= 1 ? "Watch" : "Tight";
  const safeTimes = safeRatio ? (safeRatio >= 10 ? (safeRatio / 1).toFixed(1) : safeRatio.toFixed(1)) : "0";

  // what you need to do
  const tasks = [];
  if (data.tally.stuck > 0) tasks.push({ tone: "urgent", text: `Reconnect your accounts (Tally). ${data.tally.stuck} entries are stuck.`, btn: "Fix it" });
  const topDues = data.vendorPayables.filter(v => v.owe > 0).slice(0, 2);
  if (topDues.length) tasks.push({ tone: "important", text: `Pay ${topDues.map(v => `${v.vendor_name} (₹${formatFull(v.owe)} by ${v.dueDate || "—"})`).join(" and ")} on time to avoid late fees.`, btn: "Plan these payments" });
  if (data.pendingExpenses > 0) tasks.push({ tone: "soon", text: `Approve ${data.pendingExpenses} shop expense${data.pendingExpenses > 1 ? "s" : ""}. ${data.pendingExpenses > 1 ? "They are" : "It is"} waiting for your OK.`, btn: `Approve ${data.pendingExpenses > 1 ? "them" : "it"}` });
  const gstrDue = data.gstMonths[0]?.status || "Due 20 Dec";
  tasks.push({ tone: "later", text: `File your GST return (GSTR-3B). It is due ${gstrDue.replace("Due ", "")}.`, btn: "Remind me" });

  // shop monthly line by metric
  const shopLine = monthShort.map((m, i) => {
    const row = { month: m };
    data.shopMonthly.forEach((s) => { row[s.name] = shopMetric === "profit" ? s.series[i].profit : shopMetric === "moneyIn" ? s.series[i].moneyIn : s.series[i].costs; });
    return row;
  });
  const shopTotal = data.shopProfit.reduce((a, s) => ({ moneyIn: a.moneyIn + s.moneyIn, costs: a.costs + s.costs, profit: a.profit + s.profit }), { moneyIn: 0, costs: 0, profit: 0 });
  const bestShop = [...data.shopProfit].sort((a, b) => b.profit - a.profit)[0];
  const worstShop = [...data.shopProfit].sort((a, b) => a.profit - b.profit)[0];

  // payments scoped + filtered
  const scoped = useMemo(() => {
    let list = data.payments;
    if (pickedMonth !== null) {
      list = list.filter((p) => { const d = new Date(p.date); return d.getFullYear() === data.year && d.getMonth() === pickedMonth; });
      if (pickedDay !== null) list = list.filter((p) => new Date(p.date).getDate() === pickedDay);
    }
    if (payFilter !== "all") {
      if (payFilter === "in") list = list.filter((p) => p.kind === "in");
      else if (payFilter === "vendor") list = list.filter((p) => p.cat === "vendor");
      else if (payFilter === "shopcost") list = list.filter((p) => p.cat === "shopcost");
      else if (payFilter === "gst") list = list.filter((p) => p.cat === "gst");
    }
    return list;
  }, [data, pickedMonth, pickedDay, payFilter]);
  const counts = { all: data.payments.length, in: data.payments.filter(p => p.kind === "in").length, vendor: data.payments.filter(p => p.cat === "vendor").length, shopcost: data.payments.filter(p => p.cat === "shopcost").length, gst: data.payments.filter(p => p.cat === "gst").length };
  const scopeLabel = pickedMonth !== null ? (pickedDay !== null ? `${monthLong[pickedMonth]} ${pickedDay}, ${data.year}` : `${monthLong[pickedMonth]} ${data.year}`) : `${data.year} so far`;

  return (
    <div className="min-h-full bg-[#faf9f6]">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white"><Wallet className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-heading font-bold tracking-tight">Money</h1><p className="text-xs text-muted-foreground">Your shop at a glance</p></div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Kpi label="Money in the bank" value={formatLakh(k.bank)} sub="In all your accounts, last night" trend={{ up: k.bankPrevDelta >= 0, text: `${formatFull(Math.abs(k.bankPrevDelta))} ${k.bankPrevDelta >= 0 ? "more" : "less"} than yesterday` }} />
          <Kpi label="Money in this month" value={formatLakh(k.monthIn)} sub={`Customers paid you, 1 to ${new Date().getDate()} ${monthShort[data.month]}`} trend={{ up: k.monthInDelta >= 0, text: `${formatFull(Math.abs(k.monthInDelta))} ${k.monthInDelta >= 0 ? "more" : "less"} than the same days last month` }} />
          <Kpi label="You owe vendors" value={formatLakh(k.oweVendors)} sub="First payment due soon · Nothing is late" trend={{ up: false, text: "less than a month ago" }} />
          <Kpi label="GST to pay" value={formatFull(k.gstPay)} sub={`Collected ${formatFull(k.outGst)}, can claim back ${formatFull(k.inGst)}. Due 20 ${monthShort[(data.month + 1) % 12]}.`} trend={{ up: false, text: "less than last month" }} />
          <Kpi label="Shop expenses" value={formatFull(k.shopExpenses)} sub="Salaries, rent and bills this month" trend={{ up: true, text: "more than the same days last month" }} />
          <Kpi label="Profit after expenses" value={formatFull(k.profit)} sub="After paying for the jewellery and the shops' costs" trend={{ up: true, text: "more than the same days last month" }} />
        </div>

        {/* Money in and money out */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div><CardTitle className="text-sm font-semibold">Money in and money out</CardTitle><p className="text-xs text-muted-foreground">What customers paid you, and what you paid to vendors, for shop costs and for GST</p></div>
            <div className="flex items-center gap-3">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger><SelectContent>{[data.year, data.year - 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={compareLY} onCheckedChange={(v) => setCompareLY(!!v)} /> Compare with last year</label>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={flow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} tickLine={false} axisLine={false} width={40} /><Tooltip formatter={(v) => formatLakh(v)} /><Legend />
                <Bar dataKey="Came in" fill="#0091EA" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Went out" fill="#673AB7" radius={[3, 3, 0, 0]} />
                {compareLY && <Bar dataKey="Came in last year" fill="#7DD3FC" radius={[3, 3, 0, 0]} />}
                {compareLY && <Bar dataKey="Went out last year" fill="#C4B5FD" radius={[3, 3, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">Tap a month to see its days. The list at the bottom follows the month you pick. {data.year} so far: {formatLakh(inYTD)} came in and {formatLakh(outYTD)} went out. You kept {formatLakh(keptYTD)}.</p>
          </CardContent>
        </Card>

        {/* What you need to do */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">What you need to do</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-[#F2EFEA] p-3">
                <div className="flex items-start gap-3"><Pill tone={t.tone}>{t.tone[0].toUpperCase() + t.tone.slice(1)}</Pill><p className="text-sm">{t.text}</p></div>
                <Button variant="outline" size="sm" className="shrink-0">{t.btn}</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Money in the bank */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div><CardTitle className="text-sm font-semibold">Money in the bank</CardTitle><p className="text-xs text-muted-foreground">What is in all your accounts at the end of each day. This is for the whole business.</p></div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={compare30} onCheckedChange={(v) => setCompare30(!!v)} /> Compare with the 30 days before</label>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">{formatLakh(bankLast)} last night. {k.bankPrevDelta >= 0 ? "↑" : "↓"} {formatFull(Math.abs(k.bankPrevDelta))} {k.bankPrevDelta >= 0 ? "more" : "less"} than the night before. Lowest in 30 days: {formatLakh(bankLow)}. Highest: {formatLakh(bankHigh)}.</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={bankLine}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={(d) => { const dt = new Date(d); return `${dt.getDate()} ${monthShort[dt.getMonth()]}`; }} tickLine={false} axisLine={false} minTickGap={20} /><YAxis domain={[(min) => Math.floor(min / 100000) * 100000, (max) => Math.ceil(max / 100000) * 100000]} tickFormatter={(v) => `${(v / 100000).toFixed(1)}L`} tickLine={false} axisLine={false} width={44} /><Tooltip formatter={(v) => formatLakh(v)} /><Line dataKey="balance" stroke="#1c1c1c" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">Hover or tap a day to see the balance at the end of it.</p>
            <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Account</th><th className="text-right px-4 py-2">Balance</th><th className="text-right px-4 py-2">Since yesterday</th></tr></thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.name} className="border-t border-border/60">
                      <td className="px-4 py-2"><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.name.toLowerCase().includes("card") ? "Card sales land here" : a.name.toLowerCase().includes("salary") ? "Used to pay your team" : "Sales deposits and vendor payments"}</p></td>
                      <td className="px-4 py-2 text-right">{formatLakh(a.balance)}</td>
                      <td className="px-4 py-2 text-right text-xs">{a.delta === 0 ? "No change" : <span className={a.delta > 0 ? "text-emerald-600" : "text-rose-600"}>{a.delta > 0 ? "↑" : "↓"} {formatFull(Math.abs(a.delta))}</span>}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border/60 bg-muted/30 font-medium"><td className="px-4 py-2">All accounts</td><td className="px-4 py-2 text-right">{formatLakh(k.bank)}</td><td className="px-4 py-2 text-right text-xs">{k.bankPrevDelta === 0 ? "No change" : <span className={k.bankPrevDelta > 0 ? "text-emerald-600" : "text-rose-600"}>{k.bankPrevDelta > 0 ? "↑" : "↓"} {formatFull(Math.abs(k.bankPrevDelta))}</span>}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${safeRatio >= 1.5 ? "bg-emerald-50 text-emerald-700" : safeRatio >= 1 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{safeRatio >= 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {safeLabel}</span>
              <p className="text-xs text-muted-foreground">You have {safeTimes} times what you still have to pay: {formatLakh(obligations)}. That is what you owe vendors, your GST, and next month's salaries, rent and bills. If it falls below 1½ times we will ask you to keep an eye on it. Below 1 time, you could not pay everything.</p>
            </div>
          </CardContent>
        </Card>

        {/* Payments to vendors */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Payments to vendors</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Vendor</th><th className="text-right px-4 py-2">You owe</th><th className="text-left px-4 py-2">Pay by</th><th className="text-right px-4 py-2">Save if paid early</th><th className="text-right px-4 py-2"></th></tr></thead>
                <tbody>
                  {data.vendorPayables.map((v) => (
                    <tr key={v.id} className="border-t border-border/60 align-top">
                      <td className="px-4 py-2"><p className="font-medium">{v.vendor_name}</p><p className="text-xs text-muted-foreground">Pay within 30 days · no early discount</p></td>
                      <td className="px-4 py-2 text-right">{formatFull(v.owe)}</td>
                      <td className="px-4 py-2 text-sm">{v.dueDate || "—"}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">—</td>
                      <td className="px-4 py-2 text-right"><div className="flex justify-end gap-1"><Button variant="outline" size="sm">Plan payment</Button><Button variant="ghost" size="sm">Hold</Button></div></td>
                    </tr>
                  ))}
                  {data.vendorPayables.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nothing owed right now.</td></tr>}
                </tbody>
                <tfoot><tr className="border-t border-border/60 bg-muted/30 font-medium"><td className="px-4 py-2">All vendors</td><td className="px-4 py-2 text-right">{formatFull(k.oweVendors)}</td><td className="px-4 py-2 text-sm">{data.vendorPayables[0]?.dueDate || "—"}</td><td className="px-4 py-2 text-right text-muted-foreground">—</td><td></td></tr></tfoot>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">This year you paid your vendors {formatLakh(data.vendorPaidYTD)}. In {monthShort[data.month]} so far you paid {formatLakh(data.vendorPaidThisMonth)}.</p>
          </CardContent>
        </Card>

        {/* How is each shop doing */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">How is each shop doing?</CardTitle><p className="text-xs text-muted-foreground">Profit means what you earned on sales, after paying for the jewellery, minus the shop's own costs</p></CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-2">
                {["profit", "moneyIn", "costs"].map(m => <button key={m} onClick={() => setShopMetric(m)} className={`px-3 py-1 rounded-full text-xs font-medium border ${shopMetric === m ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>{m === "profit" ? "Profit" : m === "moneyIn" ? "Money in" : "Shop costs"}</button>)}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={compareLM} onCheckedChange={(v) => setCompareLM(!!v)} /> Compare with last month</label>
            </div>
            {bestShop && worstShop && <p className="text-xs text-muted-foreground mb-2">{bestShop.name} earns the most after its costs ({formatFull(bestShop.profit)} so far this month). {worstShop.name} is lowest ({formatFull(worstShop.profit)}).</p>}
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={shopLine}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} width={44} /><Tooltip formatter={(v) => formatFull(v)} /><Legend />
                {data.shopMonthly.map((s) => <Line key={s.id} type="monotone" dataKey={s.name} stroke={s.color} dot={false} strokeWidth={2} />)}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 mb-3">Tap a line or a row to look at one shop. The list at the bottom follows. The table is for {monthShort[data.month]} so far (1 to {new Date().getDate()} {monthShort[data.month]}).</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Shop</th><th className="text-right px-4 py-2">Money in</th><th className="text-right px-4 py-2">Shop costs</th><th className="text-right px-4 py-2">Profit</th></tr></thead>
                  <tbody>
                    {data.shopProfit.map((s) => (
                      <tr key={s.id} className="border-t border-border/60">
                        <td className="px-4 py-2"><span className="h-2.5 w-2.5 rounded-sm inline-block mr-2" style={{ background: data.shopMonthly.find(x => x.id === s.id)?.color }} />{s.name}{s.type === "warehouse" && <p className="text-xs text-muted-foreground">Holds stock, no sales of its own</p>}</td>
                        <td className="px-4 py-2 text-right">{formatLakh(s.moneyIn)}</td>
                        <td className="px-4 py-2 text-right">{formatFull(s.costs)}</td>
                        <td className="px-4 py-2 text-right">{formatFull(s.profit)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border/60 bg-muted/30 font-medium"><td className="px-4 py-2">All shops</td><td className="px-4 py-2 text-right">{formatLakh(shopTotal.moneyIn)}</td><td className="px-4 py-2 text-right">{formatFull(shopTotal.costs)}</td><td className="px-4 py-2 text-right">{formatFull(shopTotal.profit)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Type of cost</th><th className="text-right px-4 py-2">So far</th></tr></thead>
                  <tbody>
                    {data.shopCosts.map((c) => <tr key={c.type} className="border-t border-border/60"><td className="px-4 py-2 capitalize">{c.type}</td><td className="px-4 py-2 text-right">{formatFull(c.amount)}</td></tr>)}
                    {data.shopCosts.length === 0 && <tr><td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">No costs logged yet.</td></tr>}
                    <tr className="border-t border-border/60 bg-muted/30 font-medium"><td className="px-4 py-2">All shop costs</td><td className="px-4 py-2 text-right">{formatFull(k.shopExpenses)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GST */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">GST (tax)</CardTitle><p className="text-xs text-muted-foreground">Tax you collected from customers, minus tax you already paid on what you bought.</p></CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm mb-3">{monthShort[data.month]} so far: you collected {formatFull(k.outGst)} from customers and can claim back {formatFull(k.inGst)} on what you bought. That leaves {formatFull(k.gstPay)} to pay by 20 {monthShort[(data.month + 1) % 12]}.</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
              <span>GST return 1 (GSTR-1): due 11 {monthShort[(data.month + 1) % 12]}</span>
              <span>GST return 3B (GSTR-3B): due 20 {monthShort[(data.month + 1) % 12]}</span>
            </div>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Month</th><th className="text-right px-4 py-2">You collected</th><th className="text-right px-4 py-2">Claim back</th><th className="text-right px-4 py-2">To pay</th><th className="text-left px-4 py-2">Status</th></tr></thead>
                <tbody>
                  {data.gstMonths.map((g, i) => <tr key={i} className="border-t border-border/60"><td className="px-4 py-2">{g.month}{i === 0 && " (so far)"}</td><td className="px-4 py-2 text-right">{formatFull(g.collected)}</td><td className="px-4 py-2 text-right">{formatFull(g.claim)}</td><td className="px-4 py-2 text-right">{formatFull(g.pay)}</td><td className="px-4 py-2 text-sm">{g.status}</td></tr>)}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">GST returns are filed for the whole business. The amounts here follow the shop, type and vendor you pick. The tax rate on jewellery is 3%.</p>
          </CardContent>
        </Card>

        {/* Tally link */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Accounts (Tally) link</CardTitle><p className="text-xs text-muted-foreground">Sends your sales and purchases to Tally so your books stay up to date</p></CardHeader>
          <CardContent className="pt-0">
            {data.tally.stuck > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-medium">{data.tally.stuck} entries stuck</p><p className="text-xs text-muted-foreground">The link has been off recently. Some entries did not go through.</p></div>
                <Button>Reconnect Tally</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All caught up. Your sales and purchases are syncing to Tally.</p>
            )}
          </CardContent>
        </Card>

        {/* Every payment in and out */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Every payment in and out</CardTitle><p className="text-xs text-muted-foreground">Newest first. The list follows the month, day and shop you pick above.</p></CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full text-xs bg-muted">{scopeLabel}</span>
              <div className="flex flex-wrap gap-2">
                {[["all", "All"], ["in", "Came in"], ["vendor", "Vendors"], ["shopcost", "Shop costs"], ["gst", "GST"]].map(([key, label]) => (
                  <button key={key} onClick={() => setPayFilter(key)} className={`px-3 py-1 rounded-full text-xs font-medium border ${payFilter === key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>{label} ({counts[key]})</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{scoped.length} payments · {formatLakh(scoped.filter(p => p.kind === "in").reduce((a, p) => a + p.amount, 0))} came in · {formatLakh(scoped.filter(p => p.kind === "out").reduce((a, p) => a + p.amount, 0))} went out</p>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-4 py-2">Payment</th><th className="text-right px-4 py-2">Amount</th><th className="text-left px-4 py-2">Status</th></tr></thead>
                <tbody>
                  {scoped.slice(0, payVisible).map((p) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="px-4 py-2"><div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded text-xs bg-muted">{p.type}</span><div><p className="font-medium">{p.label}</p><p className="text-xs text-muted-foreground">{p.store || ""} · {p.ref || ""} · {p.date ? `${new Date(p.date).getDate()} ${monthShort[new Date(p.date).getMonth()]}` : "—"}</p></div></div></td>
                      <td className="px-4 py-2 text-right font-medium">{p.kind === "in" ? "+" : "-"}{formatFull(p.amount)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{p.kind === "in" ? "Came in" : "Went out"}</td>
                    </tr>
                  ))}
                  {scoped.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No payments in this range.</td></tr>}
                </tbody>
              </table>
            </div>
            {scoped.length > payVisible && <button onClick={() => setPayVisible(v => v + 12)} className="w-full mt-2 py-2 text-xs text-muted-foreground hover:bg-accent/40 rounded-md border border-border/60">Show 12 more · {scoped.length - payVisible} payments left</button>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}