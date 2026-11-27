import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMoneyData } from "@/components/money/useMoneyData";
import MoneyDashboard from "@/components/money/MoneyDashboard";

export default function Money() {
  const [storeId, setStoreId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [category, setCategory] = useState("");
  const [pickedMonth, setPickedMonth] = useState(null);
  const [pickedDay, setPickedDay] = useState(null);

  const { data, loading } = useMoneyData({ storeId, vendorId, category });

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#faf9f6]">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
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
      </div>
      <MoneyDashboard data={data} pickedMonth={pickedMonth} pickedDay={pickedDay} setPickedMonth={setPickedMonth} setPickedDay={setPickedDay} />
    </div>
  );
}