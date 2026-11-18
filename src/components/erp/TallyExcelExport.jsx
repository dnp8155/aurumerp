import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, FileSpreadsheet, Loader2, Calendar, Settings2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import TallyMappingConfig from "./TallyMappingConfig";
import TallyExportPreview from "./TallyExportPreview";
import {
  buildSalesSheet, buildPurchaseOrderSheet, buildInventorySheet,
  buildExpenseSheet, buildTransactionSheet, generateWorkbook, getEmptyMapping
} from "@/lib/tallyExport";

const RECORD_TYPES = [
  { key: "sales", label: "Sales Vouchers" },
  { key: "purchases", label: "Purchase Orders" },
  { key: "inventory", label: "Stock / Inventory" },
  { key: "expenses", label: "Expenses" },
  { key: "transactions", label: "Payments / Transactions" },
];

export default function TallyExcelExport() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selected, setSelected] = useState(["sales", "purchases", "inventory", "expenses", "transactions"]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [templateMode, setTemplateMode] = useState("standard");
  const [mapping, setMapping] = useState(getEmptyMapping());
  const [mappingOpen, setMappingOpen] = useState(false);

  const toggleCategory = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const loadRecords = async () => {
    setLoading(true);
    setPreview(null);
    try {
      let activeMapping = getEmptyMapping();
      if (templateMode === "company") {
        const { items } = await base44.entities.TallyMapping.filter({}, { sort: "-created_date", limit: 1 });
        if (items?.length > 0) activeMapping = { ...getEmptyMapping(), ...items[0] };
        else {
          toast({ title: "No company mapping found", description: "Configure your company mapping first, or use Standard Template", variant: "destructive" });
          setMappingOpen(true);
          setLoading(false);
          return;
        }
      }
      setMapping(activeMapping);

      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom).toISOString();
      if (dateTo) dateFilter.$lte = new Date(dateTo + "T23:59:59").toISOString();

      const results = {};
      if (selected.includes("sales")) {
        const query = {};
        if (dateFrom || dateTo) query.sale_date = dateFilter;
        const { items } = await base44.entities.Sale.filter(query, { sort: "-sale_date", limit: 500 });
        results.sales = buildSalesSheet(items, activeMapping);
      }
      if (selected.includes("purchases")) {
        const query = { status: { $in: ["approved", "partially_received", "received"] } };
        if (dateFrom || dateTo) query.approved_date = dateFilter;
        const { items } = await base44.entities.PurchaseOrder.filter(query, { sort: "-approved_date", limit: 500 });
        results.purchases = buildPurchaseOrderSheet(items, activeMapping);
      }
      if (selected.includes("inventory")) {
        const { items: inv } = await base44.entities.Inventory.filter({}, { sort: "-created_date", limit: 1000 });
        const { items: prods } = await base44.entities.Product.filter({}, { sort: "-created_date", limit: 1000 });
        results.inventory = buildInventorySheet(inv, prods, activeMapping);
      }
      if (selected.includes("expenses")) {
        const query = { status: { $in: ["approved", "paid"] } };
        if (dateFrom || dateTo) query.expense_date = dateFilter;
        const { items } = await base44.entities.Expense.filter(query, { sort: "-expense_date", limit: 500 });
        results.expenses = buildExpenseSheet(items, activeMapping);
      }
      if (selected.includes("transactions")) {
        const query = { status: "success" };
        if (dateFrom || dateTo) query.transaction_date = dateFilter;
        const { items } = await base44.entities.Transaction.filter(query, { sort: "-transaction_date", limit: 500 });
        results.transactions = buildTransactionSheet(items, activeMapping);
      }
      setPreview(results);
    } catch (err) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!preview) return;
    const stamp = new Date().toISOString().split("T")[0];
    const sheetsData = Object.entries(preview).map(([key, data]) => data);
    generateWorkbook(sheetsData, `tally_export_${stamp}.xlsx`);
    const sheetCount = sheetsData.filter(s => s.rows.length > 0).length;
    toast({ title: `${sheetCount} sheet(s) exported`, description: "XLSX file downloaded — import into Tally Prime via Gateway of Tally → Import Data → Excel" });
  };

  const totalReady = preview ? Object.values(preview).reduce((sum, d) => sum + d.rows.length, 0) : 0;
  const totalSkipped = preview ? Object.values(preview).reduce((sum, d) => sum + d.skipped.length, 0) : 0;

  return (
    <div className="rounded-xl border p-5 mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Tally Excel Export (XLSX)</h3>
          <p className="text-xs text-muted-foreground">Export to TallyPrime-compatible Excel workbooks with proper voucher & master formats</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMappingOpen(true)}>
          <Settings2 className="mr-2 h-4 w-4" /> Configure Mapping
        </Button>
      </div>

      {/* Template mode */}
      <div className="mb-4">
        <Label className="mb-2 block">Template Mode</Label>
        <div className="flex gap-2">
          <label className={`flex-1 flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${templateMode === "standard" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
            <input type="radio" checked={templateMode === "standard"} onChange={() => setTemplateMode("standard")} className="accent-primary" />
            <div><p className="text-sm font-medium">Standard Tally Template</p><p className="text-xs text-muted-foreground">Uses default ledger names</p></div>
          </label>
          <label className={`flex-1 flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${templateMode === "company" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
            <input type="radio" checked={templateMode === "company"} onChange={() => setTemplateMode("company")} className="accent-primary" />
            <div><p className="text-sm font-medium">Company-Specific Mapping</p><p className="text-xs text-muted-foreground">Uses your configured Tally ledgers</p></div>
          </label>
        </div>
      </div>

      {/* Category selection */}
      <div className="mb-4">
        <Label className="mb-2 block">Select Record Categories</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RECORD_TYPES.map((rt) => (
            <label key={rt.key} className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent transition-colors">
              <Checkbox checked={selected.includes(rt.key)} onCheckedChange={() => toggleCategory(rt.key)} />
              <span className="text-sm font-medium">{rt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><Label className="mb-1 block"><Calendar className="inline h-3.5 w-3.5 mr-1" />From Date</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div><Label className="mb-1 block"><Calendar className="inline h-3.5 w-3.5 mr-1" />To Date</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button onClick={loadRecords} disabled={loading || selected.length === 0} variant="outline">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : <><FileSpreadsheet className="mr-2 h-4 w-4" /> Preview Records</>}
        </Button>
        {preview && totalReady > 0 && (
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Download XLSX ({totalReady} rows)</Button>
        )}
      </div>

      {/* Summary bar */}
      {preview && (
        <div className="flex gap-4 rounded-lg bg-muted/50 p-3 text-sm mb-3">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600" /> {totalReady} Ready</span>
          {totalSkipped > 0 && <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-500" /> {totalSkipped} Skipped</span>}
          {templateMode === "company" && <span className="text-muted-foreground">Mapping: {mapping.name}</span>}
        </div>
      )}

      {/* Per-category preview */}
      {preview && (
        <div className="space-y-3">
          {Object.entries(preview).map(([key, data]) => {
            const rt = RECORD_TYPES.find(r => r.key === key);
            return <TallyExportPreview key={key} label={rt?.label || key} data={data} />;
          })}
        </div>
      )}

      {/* Help text */}
      <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
        <p className="font-medium mb-1">How to import XLSX into Tally Prime:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Download the XLSX file using the button above</li>
          <li>Tally Prime → Gateway of Tally → Import Data → Excel</li>
          <li>Select the file and map columns using Tally's import wizard</li>
          <li>Each sheet is a separate voucher/master type — import one at a time</li>
        </ol>
      </div>

      <TallyMappingConfig open={mappingOpen} onOpenChange={setMappingOpen} onSaved={setMapping} />
    </div>
  );
}