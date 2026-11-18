import React from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCw } from "lucide-react";

const STATUS_STYLE = {
  success: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  retry: "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-600",
  skipped: "bg-blue-100 text-blue-700",
  blocked: "bg-orange-100 text-orange-700",
};

export default function TallySyncLogTable({ logs, loading, onRetry }) {
  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No sync activity yet. Records will sync automatically once Tally is connected.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Entity</TableHead>
          <TableHead>Number</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tally Ref</TableHead>
          <TableHead>Error</TableHead>
          <TableHead>Time</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map(log => (
          <TableRow key={log.id}>
            <TableCell className="font-medium capitalize">{log.entity_type}</TableCell>
            <TableCell>{log.entity_number || "—"}</TableCell>
            <TableCell><Badge className={STATUS_STYLE[log.sync_status] || STATUS_STYLE.pending} variant="secondary">{log.sync_status}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">{log.tally_reference_id ? log.tally_reference_id.slice(0, 12) : "—"}</TableCell>
            <TableCell className="text-xs text-red-600 max-w-[240px] truncate" title={(log.validation_errors?.length ? log.validation_errors.join(" ") : log.error_message) || ""}>
              {(log.validation_errors?.length ? log.validation_errors.join(" ") : log.error_message) || "—"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{log.last_sync_timestamp ? new Date(log.last_sync_timestamp).toLocaleString() : "—"}</TableCell>
            <TableCell className="text-right">
              {(log.sync_status === "failed" || log.sync_status === "retry" || log.sync_status === "blocked") && (
                <Button size="sm" variant="ghost" onClick={() => onRetry(log.id)}>
                  <RotateCw className="h-3.5 w-3.5 mr-1" /> Retry
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}