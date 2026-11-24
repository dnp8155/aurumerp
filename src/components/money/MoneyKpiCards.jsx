import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatLakh, formatFull } from "./moneyUtils";

function Card({ title, value, sub, delta, deltaUp }) {
  return (
    <div className="rounded-xl bg-[#F3F1ED] p-4">
      <p className="text-xs font-medium text-neutral-600">{title}</p>
      <p className="mt-1.5 text-2xl font-heading font-bold tracking-tight text-neutral-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
      {delta !== undefined && delta !== 0 && (
        <p className={`mt-1.5 text-xs font-medium inline-flex items-center gap-1 ${deltaUp ? "text-emerald-700" : "text-red-600"}`}>
          {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {deltaUp ? "↑" : "↓"} {formatFull(Math.abs(delta))} {deltaUp ? "more" : "less"} than last month
        </p>
      )}
    </div>
  );
}

export default function MoneyKpiCards({ kpis }) {
  const k = kpis || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Card title="Money in the bank" value={formatLakh(k.bank)} sub="In all your accounts, last night" delta={k.bankPrevDelta} deltaUp={false} />
      <Card title="Money in this month" value={formatLakh(k.monthIn)} sub="Customers paid you this month" delta={k.monthInDelta} deltaUp={true} />
      <Card title="You owe vendors" value={formatLakh(k.oweVendors)} sub="Payable to vendors. Nothing is late." delta={undefined} deltaUp={false} />
      <Card title="GST to pay" value={formatLakh(k.gstPay)} sub={`Collected ${formatFull(k.outGst)}, can claim back ${formatFull(k.inGstExp)}. Due 20th of next month.`} delta={undefined} deltaUp={false} />
      <Card title="Shop expenses" value={formatLakh(k.shopExpenses)} sub="Salaries, rent and bills this month" delta={undefined} deltaUp={false} />
      <Card title="Profit after expenses" value={formatLakh(k.profit)} sub="After paying for the jewellery and the shops' costs" delta={undefined} deltaUp={true} />
    </div>
  );
}