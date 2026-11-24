import React, { useState, useMemo } from "react";
import { Wallet, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMoneyData } from "@/components/money/useMoneyData";
import MoneyKpiCards from "@/components/money/MoneyKpiCards";
import MoneyFlowChart from "@/components/money/MoneyFlowChart";
import MoneyActions from "@/components/money/MoneyActions";
import MoneyBankAccounts from "@/components/money/MoneyBankAccounts";
import MoneyVendorPayments from "@/components/money/MoneyVendorPayments";
import MoneyShopProfit from "@/components/money/MoneyShopProfit";
import MoneyGstTable from "@/components/money/MoneyGstTable";
import MoneyTallyLink from "@/components/money/MoneyTallyLink";
import MoneyPaymentsList from "@/components/money/MoneyPaymentsList";
import { monthLong } from "@/components/money/moneyUtils";

export default function Money() {
  const [storeId, setStoreId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [category, setCategory] = useState("");
  const [pickedMonth, setPickedMonth] = useState(null);
  const [pickedDay, setPickedDay] = useState(null);

  const { data, loading } = useMoneyData({ storeId, vendorId, category });

  // Filter the payments list to the picked month / day
  const scopedPayments = useMemo(() => {
    if (!data) return [];
    let list = data.payments;
    if (pickedMonth !== null) {
      list = list.filter((p) => {
        if (!p.date) return false;
        const d = new Date(p.date);
        return d.getFullYear() === data.year && d.getMonth() === pickedMonth;
      });
      if (pickedDay !== null) {
        list = list.filter((p) => {
          const d = new Date(p.date);
          return d.getDate() === pickedDay;
        });
      }
    }
    return list;
  }, [data, pickedMonth, pickedDay]);

  const scopeLabel = pickedMonth !== null
    ? (pickedDay !== null ? `${monthLong[pickedMonth]} ${pickedDay}, ${data?.year}` : `${monthLong[pickedMonth]} ${data?.year}`)
    : `${data?.year || ""} so far`;

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingExpenses = data.pendingExpenses || 0;

  return (
    <div className="min-h-full bg-[#faf9f6]">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold tracking-tight">Dashboard 1</h1>
            <p className="text-xs text-muted-foreground">Your shop at a glance — new (trial)</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger><SelectValue placeholder="All stores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All stores</SelectItem>
              {data.stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All categories</SelectItem>
              {data.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger><SelectValue placeholder="All vendors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All vendors</SelectItem>
              {data.vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <MoneyKpiCards kpis={data.kpis} />

        <MoneyFlowChart
          monthlyFlow={data.monthlyFlow}
          monthlyFlowPrev={data.monthlyFlowPrev}
          payments={data.payments}
          year={data.year}
          month={data.month}
          onPickMonth={(m) => { setPickedMonth(m); setPickedDay(null); }}
          onPickDay={(d) => setPickedDay(d)}
        />

        <MoneyActions tally={data.tally} vendorPayables={data.vendorPayables} pendingExpenses={pendingExpenses} />

        <MoneyBankAccounts accounts={data.accounts} bank={data.kpis.bank} bankPrevDelta={data.kpis.bankPrevDelta} bankDaily30={data.bankDaily30} oweVendors={data.kpis.oweVendors} gstPay={data.kpis.gstPay} shopExpenses={data.kpis.shopExpenses} />

        <MoneyVendorPayments vendorPayables={data.vendorPayables} vendorPaidYTD={data.vendorPaidYTD} vendorSavedYTD={data.vendorSavedYTD} vendorPaidThisMonth={data.vendorPaidThisMonth} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MoneyShopProfit shopProfit={data.shopProfit} shopMonthly={data.shopMonthly} shopCosts={data.shopCosts} />
          <MoneyGstTable gstMonths={data.gstMonths} />
        </div>

        <MoneyTallyLink tally={data.tally} />

        <MoneyPaymentsList payments={scopedPayments} scopeLabel={scopeLabel} />
      </div>
    </div>
  );
}