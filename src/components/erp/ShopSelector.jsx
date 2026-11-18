import React from "react";
import { Store } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

export default function ShopSelector({ stores, value, onChange, includeAll = true }) {
  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-muted-foreground" />
      <Select value={value || "all"} onValueChange={v => onChange(v === "all" ? "" : v)}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="All Shops" />
        </SelectTrigger>
        <SelectContent>
          {includeAll && <SelectItem value="all">All Shops</SelectItem>}
          {stores.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}