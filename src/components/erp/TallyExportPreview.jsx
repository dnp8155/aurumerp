import React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Check, X, AlertTriangle } from "lucide-react";

export default function TallyExportPreview({ label, data }) {
  if (!data) return null;
  const { headers, rows, skipped, sheetName } = data;
  const previewRows = rows.slice(0, 5);
  const totalAmount = rows.reduce((sum, r) => {
    const totalIdx = headers.findIndex(h => h.includes("Total Amount"));
    return sum + (totalIdx >= 0 ? (Number(r[totalIdx]) || 0) : 0);
  }, 0);

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">Sheet: {sheetName}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {rows.length > 0 ? (
            <span className="text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {rows.length} rows</span>
          ) : (
            <span className="text-muted-foreground">0 rows</span>
          )}
          {skipped.length > 0 && (
            <span className="text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {skipped.length} skipped</span>
          )}
          {rows.length > 0 && totalAmount > 0 && (
            <span className="text-muted-foreground">Total: ₹{totalAmount.toLocaleString('en-IN')}</span>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto max-h-64">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h, i) => <TableHead key={i} className="whitespace-nowrap text-xs">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, ri) => (
                <TableRow key={ri}>
                  {row.map((cell, ci) => <TableCell key={ci} className="whitespace-nowrap text-xs">{String(cell ?? "")}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 5 && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t">Showing 5 of {rows.length} rows — download to see all</p>
          )}
        </div>
      )}

      {skipped.length > 0 && (
        <div className="px-4 py-3 border-t bg-amber-50/50">
          <p className="text-xs font-medium text-amber-700 mb-1.5">Skipped records (fix before importing):</p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {skipped.map((s, i) => (
              <div key={i} className="text-xs flex items-start gap-2 text-amber-700">
                <X className="h-3 w-3 mt-0.5 shrink-0" />
                <span><strong>{s.number}</strong> — {s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 && skipped.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">No records found for this category</div>
      )}
    </div>
  );
}