import React from "react";
import { Store, Calendar, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function DashboardFilterBar({ stores, filter, onFilterChange }) {
  const hasFilter = filter.shopId || filter.dateFrom || filter.dateTo;

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-end mb-6 p-4 rounded-xl border bg-card shadow-sm">
      <div className="flex-1 min-w-[180px]">
        <Label className="text-xs mb-1.5 flex items-center gap-1"><Store className="h-3 w-3" /> Shop</Label>
        <Select
          value={filter.shopId || "all"}
          onValueChange={(v) => onFilterChange({ ...filter, shopId: v === "all" ? "" : v })}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="All Shops" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shops</SelectItem>
            {(stores || []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs mb-1.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> From</Label>
        <Input
          type="date"
          value={filter.dateFrom}
          onChange={(e) => onFilterChange({ ...filter, dateFrom: e.target.value })}
          className="h-9 w-[150px]"
        />
      </div>
      <div>
        <Label className="text-xs mb-1.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> To</Label>
        <Input
          type="date"
          value={filter.dateTo}
          onChange={(e) => onFilterChange({ ...filter, dateTo: e.target.value })}
          className="h-9 w-[150px]"
        />
      </div>
      {hasFilter && (
        <Button variant="outline" size="sm" onClick={() => onFilterChange({ shopId: "", dateFrom: "", dateTo: "" })}>
          <X className="mr-1 h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}