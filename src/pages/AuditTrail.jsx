import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ScrollText, Filter } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      const data = await base44.entities.AuditTrail.list('-created_date', 100);
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to load audit trail", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(log => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("audit.title")} description={t("audit.desc")} />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
              <SelectItem value="sync">Sync</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All entities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="Store">Store</SelectItem>
            <SelectItem value="Vendor">Vendor</SelectItem>
            <SelectItem value="PurchaseOrder">Purchase Order</SelectItem>
            <SelectItem value="GoodsReceipt">Goods Receipt</SelectItem>
            <SelectItem value="Product">Product</SelectItem>
            <SelectItem value="Inventory">Inventory</SelectItem>
            <SelectItem value="Allocation">Allocation</SelectItem>
            <SelectItem value="Pallet">Pallet</SelectItem>
            <SelectItem value="Shipment">Shipment</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadLogs}>Refresh</Button>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Actions performed across the system will be logged here" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.created_date ? format(new Date(log.created_date), "dd MMM, HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{log.user_name || log.user_email || "System"}</TableCell>
                  <TableCell><StatusBadge status={log.action === "create" ? "active" : log.action === "delete" ? "cancelled" : log.action === "approve" ? "approved" : log.action === "reject" ? "rejected" : "pending"} label={log.action} /></TableCell>
                  <TableCell className="text-sm">{log.entity_type}</TableCell>
                  <TableCell className="text-sm font-medium">{log.entity_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}