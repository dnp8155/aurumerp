import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, Plus, Save, Download, Trash2, Eye, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";

const ENTITY_CONFIG = {
  Sale: { label: "Sales", dateField: "sale_date", fields: ["sale_number", "store_name", "customer_name", "total_amount", "tax_amount", "payment_method", "payment_status", "status", "sale_date"] },
  PurchaseOrder: { label: "Purchase Orders", dateField: "created_date", fields: ["po_number", "vendor_name", "store_name", "total_amount", "total_gst_amount", "status", "payment_status", "created_date"] },
  Expense: { label: "Expenses", dateField: "expense_date", fields: ["expense_number", "category", "description", "vendor_name", "amount", "gst_amount", "total_amount", "payment_mode", "status", "expense_date"] },
  Transaction: { label: "Transactions", dateField: "transaction_date", fields: ["transaction_number", "amount", "payment_method", "provider", "status", "store_name", "customer_name", "transaction_date"] },
  Rental: { label: "Rentals", dateField: "created_date", fields: ["rental_number", "customer_name", "store_name", "total_rental_charge", "security_deposit", "status", "payment_status", "created_date"] },
  Repair: { label: "Repairs", dateField: "created_date", fields: ["repair_number", "customer_name", "product_name", "total_charge", "status", "priority", "created_date"] },
  Order: { label: "Online Orders", dateField: "order_date", fields: ["order_number", "customer_name", "marketplace", "total_amount", "payment_status", "fulfillment_status", "channel", "order_date"] },
  Product: { label: "Products", dateField: "created_date", fields: ["sku", "name", "category", "selling_price", "cost_price", "mrp", "weight", "status", "created_date"] },
};

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function CustomReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [viewReport, setViewReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const [form, setForm] = useState({
    name: "", entity_type: "Sale", selected_fields: [], group_by: "",
    date_from: "", date_to: "", chart_type: "table", aggregation: "count", aggregation_field: ""
  });

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      const data = await base44.entities.CustomReport.list('-created_date', 100);
      setReports(data || []);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (field) => {
    setForm(f => ({
      ...f,
      selected_fields: f.selected_fields.includes(field)
        ? f.selected_fields.filter(f2 => f2 !== field)
        : [...f.selected_fields, field]
    }));
  };

  const generateReport = async (config) => {
    setReportLoading(true);
    try {
      const entityApi = base44.entities[config.entity_type];
      const entityConf = ENTITY_CONFIG[config.entity_type];
      const query = {};
      if (config.date_from && config.date_to && entityConf.dateField) {
        query[entityConf.dateField] = { $gte: config.date_from, $lte: config.date_to };
      }

      let result;
      if (config.group_by && config.aggregation !== "none") {
        const aggConfig = { query, groupBy: config.group_by };
        if (config.aggregation === "count") aggConfig.count = true;
        if (config.aggregation === "sum" && config.aggregation_field) aggConfig.sum = config.aggregation_field;
        if (config.aggregation === "avg" && config.aggregation_field) aggConfig.avg = config.aggregation_field;
        result = await entityApi.aggregate(aggConfig);
        setReportData({ type: "aggregate", rows: result.rows || [], config });
      } else {
        const items = await entityApi.filter(query, { sort: `-${entityConf.dateField || "created_date"}`, limit: 100, fields: config.selected_fields.length > 0 ? config.selected_fields : undefined });
        setReportData({ type: "list", items: items.items || items || [], config });
      }
    } catch (err) {
      toast({ title: "Report generation failed", description: err.message, variant: "destructive" });
    } finally {
      setReportLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await base44.entities.CustomReport.create({
        ...form,
        owner_id: user?.id,
        owner_name: user?.full_name || user?.email
      });
      toast({ title: "Report template saved" });
      setBuilderOpen(false);
      setForm({ name: "", entity_type: "Sale", selected_fields: [], group_by: "", date_from: "", date_to: "", chart_type: "table", aggregation: "count", aggregation_field: "" });
      loadReports();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRun = (report) => {
    setViewReport(report);
    generateReport(report);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this report template?")) return;
    try {
      await base44.entities.CustomReport.delete(id);
      toast({ title: "Report deleted" });
      loadReports();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const exportCSV = () => {
    if (!reportData) return;
    let rows = [];
    let headers = [];
    if (reportData.type === "aggregate") {
      headers = reportData.config.group_by ? [reportData.config.group_by, "count"] : ["Group", "Count"];
      rows = reportData.rows.map(r => [r[reportData.config.group_by] || r._id, r.count]);
    } else {
      headers = reportData.config.selected_fields.length > 0 ? reportData.config.selected_fields : (reportData.items[0] ? Object.keys(reportData.items[0]) : []);
      rows = reportData.items.map(item => headers.map(h => item[h] ?? ""));
    }
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportData.config.name || "report"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6"><div className="h-64 rounded-xl bg-muted animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("cr.title")} description={t("cr.desc")}>
        <Button onClick={() => setBuilderOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Report
        </Button>
      </PageHeader>

      {reports.length === 0 ? (
        <EmptyState icon={FileBarChart} title={t("cr.no_reports")} description={t("cr.desc")} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => (
            <div key={r.id} className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold">{r.name}</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{ENTITY_CONFIG[r.entity_type]?.label || r.entity_type} · {r.chart_type} · {r.aggregation}</p>
              <Button size="sm" className="w-full" onClick={() => handleRun(r)}>
                <Eye className="mr-2 h-3.5 w-3.5" /> Run Report
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Build Custom Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Report Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly Sales by Store" /></div>
              <div>
                <Label>Entity</Label>
                <Select value={form.entity_type} onValueChange={v => setForm({ ...form, entity_type: v, selected_fields: [], group_by: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENTITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Fields to Include</Label>
              <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 max-h-40 overflow-y-auto">
                {(ENTITY_CONFIG[form.entity_type]?.fields || []).map(f => (
                  <label key={f} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.selected_fields.includes(f)} onChange={() => toggleField(f)} className="rounded" />
                    {f}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Group By</Label>
                <Select value={form.group_by} onValueChange={v => setForm({ ...form, group_by: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {(ENTITY_CONFIG[form.entity_type]?.fields || []).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aggregation</Label>
                <Select value={form.aggregation} onValueChange={v => setForm({ ...form, aggregation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                    <SelectItem value="none">None (list records)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.aggregation === "sum" || form.aggregation === "avg") && (
              <div>
                <Label>Aggregation Field</Label>
                <Select value={form.aggregation_field} onValueChange={v => setForm({ ...form, aggregation_field: v })}>
                  <SelectTrigger><SelectValue placeholder="Select numeric field" /></SelectTrigger>
                  <SelectContent>
                    {(ENTITY_CONFIG[form.entity_type]?.fields || []).filter(f => ["amount", "total_amount", "tax_amount", "selling_price", "cost_price", "mrp", "weight", "total_rental_charge", "security_deposit", "total_charge", "gst_amount"].includes(f)).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date From</Label><Input type="date" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} /></div>
              <div><Label>Date To</Label><Input type="date" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} /></div>
            </div>

            <div>
              <Label>Chart Type</Label>
              <Select value={form.chart_type} onValueChange={v => setForm({ ...form, chart_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Table</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm({ ...form, name: "" }); generateReport(form); }}>Preview</Button>
            <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name}><Save className="mr-2 h-4 w-4" /> Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewReport} onOpenChange={(open) => { if (!open) { setViewReport(null); setReportData(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{viewReport?.name}</span>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!reportData}>
                <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
              </Button>
            </DialogTitle>
          </DialogHeader>
          {reportLoading ? (
            <div className="h-64 rounded-xl bg-muted animate-pulse" />
          ) : reportData ? (
            <ReportRenderer data={reportData} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportRenderer({ data }) {
  const { config, type, items, rows } = data;

  if (type === "aggregate" && rows.length > 0 && config.chart_type !== "table") {
    const chartData = rows.map(r => ({
      name: String(r[config.group_by] || r._id || "—"),
      value: r.count || r[`sum_${config.aggregation_field}`] || r[`avg_${config.aggregation_field}`] || 0
    }));

    if (config.chart_type === "bar") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill={CHART_COLORS[0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (config.chart_type === "line") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    if (config.chart_type === "area") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area dataKey="value" fill={CHART_COLORS[0]} stroke={CHART_COLORS[0]} />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    if (config.chart_type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
              {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
  }

  const displayItems = type === "aggregate" ? rows : items;
  const headers = type === "aggregate"
    ? (rows[0] ? Object.keys(rows[0]).filter(k => k !== "_id") : [config.group_by, "count"])
    : (config.selected_fields.length > 0 ? config.selected_fields : (displayItems[0] ? Object.keys(displayItems[0]).slice(0, 8) : []));

  if (!displayItems || displayItems.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No data found for the selected filters</p>;

  return (
    <div className="rounded-lg border overflow-x-auto max-h-[500px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map(h => <TableHead key={h} className="capitalize">{h.replace(/_/g, " ")}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayItems.slice(0, 100).map((item, i) => (
            <TableRow key={i}>
              {headers.map(h => <TableCell key={h} className="text-sm">{String(item[h] ?? "—")}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}