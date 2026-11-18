import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, AlertTriangle, TrendingDown, Package, Truck, Copy, Boxes, RefreshCw, Check, Eye, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import StatCard from "@/components/erp/StatCard";
import PageHeader from "@/components/erp/PageHeader";
import RemindersPanel from "@/components/erp/RemindersPanel";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";

const ALERT_CONFIG = {
  gst_gap: { label: "GST Filing Gap", icon: FileBarChart, color: "text-amber-600", bg: "bg-amber-50" },
  expense_spike: { label: "Expense Spike", icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
  negative_inventory: { label: "Negative Inventory", icon: Package, color: "text-red-600", bg: "bg-red-50" },
  stuck_shipment: { label: "Stuck Shipment", icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
  duplicate_payment: { label: "Duplicate Payment", icon: Copy, color: "text-red-600", bg: "bg-red-50" },
  low_stock: { label: "Low Stock", icon: Boxes, color: "text-amber-600", bg: "bg-amber-50" },
  other: { label: "Other", icon: AlertTriangle, color: "text-slate-600", bg: "bg-slate-50" }
};

const SEVERITY_STYLES = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700"
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewAlert, setViewAlert] = useState(null);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    try {
      const data = await base44.entities.Alert.list('-created_date', 200);
      setAlerts(data || []);
    } catch (err) {
      console.error("Failed to load alerts", err);
    } finally {
      setLoading(false);
    }
  };

  const runAnomalyCheck = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('anomalyCheck', {});
      const data = res.data || res;
      if (data.error) {
        toast({ title: "Check failed", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Anomaly check complete",
          description: `${data.alertsCreated || 0} new alerts created`
        });
        loadAlerts();
      }
    } catch (err) {
      toast({ title: "Check failed", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const handleAcknowledge = async (alert) => {
    try {
      await base44.entities.Alert.update(alert.id, { status: "acknowledged" });
      toast({ title: "Alert acknowledged" });
      loadAlerts();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleResolve = async (alert) => {
    try {
      const user = await base44.auth.me().catch(() => null);
      await base44.entities.Alert.update(alert.id, {
        status: "resolved",
        resolved_date: new Date().toISOString(),
        resolved_by: user?.full_name || user?.email || "Admin"
      });
      toast({ title: "Alert resolved" });
      setViewAlert(null);
      loadAlerts();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = alerts.filter(a => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: alerts.length,
    new: alerts.filter(a => a.status === "new").length,
    acknowledged: alerts.filter(a => a.status === "acknowledged").length,
    resolved: alerts.filter(a => a.status === "resolved").length,
    critical: alerts.filter(a => a.severity === "critical" && a.status === "new").length
  };

  if (loading) return <div className="p-6"><div className="h-64 rounded-xl bg-muted animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("alert.title")} description={t("alert.desc")}>
        <Button onClick={runAnomalyCheck} disabled={running}>
          <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Checking..." : "Run Check Now"}
        </Button>
      </PageHeader>

      <RemindersPanel />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Alerts" value={stats.total} icon={Bell} accent="blue" />
        <StatCard label="New" value={stats.new} icon={AlertTriangle} accent="amber" />
        <StatCard label="Critical (New)" value={stats.critical} icon={AlertTriangle} accent="red" />
        <StatCard label="Resolved" value={stats.resolved} icon={Check} accent="emerald" />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(ALERT_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Bell} title={t("alert.no_alerts")} description={t("alert.desc")} />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => {
                const conf = ALERT_CONFIG[a.type] || ALERT_CONFIG.other;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${conf.bg}`}>
                          <conf.icon className={`h-3.5 w-3.5 ${conf.color}`} />
                        </div>
                        <span className="text-xs font-medium">{conf.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.low}`}>{a.severity}</span>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{a.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{a.message}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                        a.status === "new" ? "bg-amber-100 text-amber-700" :
                        a.status === "acknowledged" ? "bg-blue-100 text-blue-700" :
                        "bg-emerald-100 text-emerald-700"
                      }`}>{a.status}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.created_date ? format(new Date(a.created_date), "dd MMM, HH:mm") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewAlert(a)}><Eye className="h-4 w-4" /></Button>
                        {a.status === "new" && <Button variant="outline" size="sm" onClick={() => handleAcknowledge(a)}>Acknowledge</Button>}
                        {a.status !== "resolved" && <Button variant="outline" size="sm" onClick={() => handleResolve(a)} className="text-emerald-600">Resolve</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewAlert} onOpenChange={(open) => !open && setViewAlert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{viewAlert?.title}</DialogTitle></DialogHeader>
          {viewAlert && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{ALERT_CONFIG[viewAlert.type]?.label || viewAlert.type}</span></div>
                <div><span className="text-muted-foreground">Severity:</span> <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[viewAlert.severity]}`}>{viewAlert.severity}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium capitalize">{viewAlert.status}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span>{viewAlert.created_date ? format(new Date(viewAlert.created_date), "dd MMM yyyy, HH:mm") : "—"}</span></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">{viewAlert.message}</p>
              </div>
              {viewAlert.entity_number && <div><span className="text-muted-foreground">Reference:</span> <span className="font-mono text-xs">{viewAlert.entity_number}</span></div>}
              {viewAlert.resolved_by && <div><span className="text-muted-foreground">Resolved by:</span> <span className="font-medium">{viewAlert.resolved_by}</span></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}