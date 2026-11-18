import React from "react";
import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/erp/EmptyState";
import { format } from "date-fns";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";

export default function ReturnSearchSection({ sales, searchQuery, onSearchChange, onReturnClick }) {
  const filtered = searchQuery.trim()
    ? sales.filter(s => fuzzyMatchAny(searchQuery, s.customer_name, s.customer_phone, s.customer_email, s.sale_number))
    : sales;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Name, Number, Email, or Invoice number..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No sales found" description="Search by customer name, phone, email, or invoice number to process a return" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 20).map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs font-medium">{s.sale_number}</TableCell>
                  <TableCell className="text-sm">{s.customer_name}</TableCell>
                  <TableCell className="text-sm">{s.customer_phone || "—"}</TableCell>
                  <TableCell className="text-right font-medium">₹{(s.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{(s.items || []).length}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.sale_date ? format(new Date(s.sale_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onReturnClick(s)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Return
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}