import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { generateBarcode, scanBarcode } from "@/lib/barcodeEngine";
import { Barcode, Search, Eye, Printer, Package, Building2, Store as StoreIcon, Save, RefreshCw, AlertCircle } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import BarcodeLabel from "@/components/erp/BarcodeLabel";
import BarcodeDisplay from "@/components/erp/BarcodeDisplay";
import BarcodeScanInfo from "@/components/erp/BarcodeScanInfo";
import NextStepDialog from "@/components/erp/NextStepDialog";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

export default function BarcodeEngine() {
  const [products, setProducts] = useState([]);
  const [parties, setParties] = useState([]);
  const [stores, setStores] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [genError, setGenError] = useState(null);
  const [labelRecord, setLabelRecord] = useState(null);
  const [labelQty, setLabelQty] = useState(1);
  const [viewRecord, setViewRecord] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    product_code: "", price: "", collection_code: "", store_code: "", purchase_date: ""
  });
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [prodData, partyData, storeData, recData] = await Promise.all([
        base44.entities.BarcodeProductMaster.filter({ status: "active" }),
        base44.entities.BarcodePartyMaster.filter({ status: "active" }),
        base44.entities.BarcodeStoreMaster.filter({ status: "active" }),
        base44.entities.BarcodeRecord.list('-created_date', 100),
      ]);
      setProducts(prodData || []);
      setParties(partyData || []);
      setStores(storeData || []);
      setRecords(recData || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!form.product_code || !form.price || !form.collection_code) {
      toast({ title: "Missing fields", description: "Product, Price, and Collection are required", variant: "destructive" });
      return;
    }
    setCalculating(true);
    setPreview(null);
    setGenError(null);
    try {
      const result = await generateBarcode({
        product_code: form.product_code,
        price: Number(form.price),
        collection_code: form.collection_code,
        store_code: form.store_code || undefined,
        purchase_date: form.purchase_date || undefined,
        persist: false
      });
      if (result.success) {
        setPreview({ calculated: result.calculated, record: result.records?.[0] });
        toast({ title: "Calculation successful", description: result.calculated.barcode });
      } else {
        const msg = result.error || "Unknown error";
        setGenError(msg);
        toast({ title: "Calculation failed", description: msg, variant: "destructive" });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setGenError(msg);
      toast({ title: "Calculation failed", description: msg, variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const result = await generateBarcode({
        product_code: form.product_code,
        price: Number(form.price),
        collection_code: form.collection_code,
        store_code: form.store_code || undefined,
        purchase_date: form.purchase_date || undefined,
        persist: true
      });
      if (result.success) {
        toast({ title: "Barcode saved", description: result.records?.[0]?.barcode });
        setNextStep({ key: "barcode" });
        setPreview(null);
        setForm({ product_code: "", price: "", collection_code: "", store_code: "", calculation_rule_id: "", purchase_date: "" });
        loadData();
      } else {
        toast({ title: "Save failed", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleScan = async () => {
    if (!searchTerm.trim()) return;
    try {
      const result = await scanBarcode(searchTerm.trim());
      if (result.record) {
        setViewRecord(result.record);
        toast({ title: "Barcode found", description: result.record.product_name });
      }
    } catch (err) {
      toast({ title: "Barcode not found", description: searchTerm, variant: "destructive" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredRecords = records.filter(r => {
    if (!searchTerm) return true;
    return fuzzyMatchAny(searchTerm, r.barcode, r.sku, r.product_name, r.alias, r.stock_item_name);
  });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("be.title")} description={t("be.desc")}>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </PageHeader>

      {/* Master counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MasterCard icon={Package} label="Products" count={products.length} />
        <MasterCard icon={Building2} label="Parties/Collections" count={parties.length} />
        <MasterCard icon={StoreIcon} label="Stores" count={stores.length} />
      </div>

      {/* Generation form + preview */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Barcode className="h-4 w-4" /> Generate Barcode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Product *</Label>
              <Select value={form.product_code} onValueChange={v => setForm({ ...form, product_code: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.product_code}>{p.product_code} — {p.product_name} ({p.short_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g. 249 or 237.5" />
            </div>
            <div>
              <Label>Collection / Party *</Label>
              <Select value={form.collection_code} onValueChange={v => setForm({ ...form, collection_code: v })}>
                <SelectTrigger><SelectValue placeholder="Select collection" /></SelectTrigger>
                <SelectContent>
                  {parties.map(p => <SelectItem key={p.id} value={p.collection_code}>{p.collection_code} — {p.party_name} (C1: {p.c1_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Store</Label>
              <Select value={form.store_code} onValueChange={v => setForm({ ...form, store_code: v })}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {stores.map(s => <SelectItem key={s.id} value={s.store_code}>{s.store_code} — {s.store_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <Button onClick={handleCalculate} disabled={calculating} className="w-full">
              {calculating ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Calculating...</> : <><Barcode className="mr-2 h-4 w-4" /> Calculate Preview</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {preview ? (
              <div className="space-y-3">
                <div className="flex justify-center py-2 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Barcode</p>
                    <p className="text-2xl font-mono font-bold tracking-wider">{preview.calculated.barcode}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <PreviewField label="SKU" value={preview.calculated.desPartNo} mono />
                  <PreviewField label="Stock Item" value={preview.calculated.stockItemName} mono />
                  <PreviewField label="Alias" value={preview.calculated.alias} mono />
                  <PreviewField label="Stock Group" value={preview.calculated.stockGroup} mono />
                  <PreviewField label="Part No" value={preview.calculated.partNo} />
                  <PreviewField label="Value" value={`₹${preview.calculated.value}`} />
                  <PreviewField label="P-Value" value={preview.calculated.pValue} />
                  <PreviewField label="Description" value={preview.calculated.description} mono />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save & Generate</>}
                  </Button>
                  <Button variant="outline" onClick={() => { setLabelRecord(preview.record); setLabelQty(1); }}>
                    <Printer className="mr-2 h-4 w-4" /> Preview Label
                  </Button>
                </div>
              </div>
            ) : genError ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-destructive">Barcode generation failed</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">{genError}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCalculate} disabled={calculating}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${calculating ? "animate-spin" : ""}`} /> Regenerate
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Barcode className="h-12 w-12 mb-2 opacity-30" />
                <p className="text-sm">Fill the form and click Calculate Preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick scan info */}
      <div className="mb-6">
        <BarcodeScanInfo />
      </div>

      {/* Records table */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Scan or search barcode, SKU, product, alias..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
          />
        </div>
        <Button variant="outline" onClick={handleScan}><Search className="mr-2 h-4 w-4" /> Scan</Button>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : filteredRecords.length === 0 ? (
        <EmptyState icon={Barcode} title="No barcode records yet" description="Generate your first barcode using the form above" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barcode</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Part No</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><BarcodeDisplay value={r.barcode} /></TableCell>
                  <TableCell className="font-mono text-xs font-medium">{r.sku}</TableCell>
                  <TableCell className="text-sm font-medium">{r.product_name}</TableCell>
                  <TableCell className="text-sm">{r.part_no}</TableCell>
                  <TableCell className="text-sm">₹{r.price}</TableCell>
                  <TableCell className="text-sm">₹{r.value}</TableCell>
                  <TableCell className="text-sm">{r.collection_code}</TableCell>
                  <TableCell className="text-sm">{r.store_code || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewRecord(r)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setLabelRecord(r); setLabelQty(1); }}><Printer className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Label printing dialog */}
      <Dialog open={!!labelRecord} onOpenChange={(open) => !open && setLabelRecord(null)}>
        <DialogContent className="max-w-md no-print">
          <DialogHeader>
            <DialogTitle>Print Barcode Label</DialogTitle>
          </DialogHeader>
          {labelRecord && (
            <div className="space-y-4">
              <div className="border rounded-lg bg-gray-50 p-4 flex justify-center">
                <BarcodeLabel record={labelRecord} quantity={labelQty} />
              </div>
              <div>
                <Label>Label Quantity</Label>
                <Input type="number" min="1" max="100" value={labelQty} onChange={e => setLabelQty(Number(e.target.value) || 1)} />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Product: <span className="font-medium">{labelRecord.product_name}</span></p>
                <p>Barcode: <span className="font-mono font-medium">{labelRecord.barcode}</span></p>
                <p>SKU: <span className="font-mono font-medium">{labelRecord.sku}</span></p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelRecord(null)}>Close</Button>
            <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record details dialog */}
      <Dialog open={!!viewRecord} onOpenChange={(open) => !open && setViewRecord(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Barcode Details — {viewRecord?.barcode}</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-4">
              <div className="flex justify-center py-2 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Barcode</p>
                  <p className="text-xl font-mono font-bold tracking-wider">{viewRecord.barcode}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailField label="SKU" value={viewRecord.sku} />
                <DetailField label="Product Code" value={viewRecord.product_code} />
                <DetailField label="Product Name" value={viewRecord.product_name} />
                <DetailField label="Short Code" value={viewRecord.short_code} />
                <DetailField label="Part No" value={viewRecord.part_no} />
                <DetailField label="Price" value={`₹${viewRecord.price}`} />
                <DetailField label="Value" value={`₹${viewRecord.value}`} />
                <DetailField label="P-Value" value={viewRecord.p_value} />
                <DetailField label="Collection" value={viewRecord.collection_code} />
                <DetailField label="Party" value={viewRecord.party_name} />
                <DetailField label="Store" value={viewRecord.store_name || "—"} />
                <DetailField label="Stock Item" value={viewRecord.stock_item_name} />
                <DetailField label="Alias" value={viewRecord.alias} />
                <DetailField label="Stock Group" value={viewRecord.stock_group} />
                <DetailField label="Description" value={viewRecord.description} />
                <DetailField label="C1 / C2" value={`${viewRecord.c1_code} / ${viewRecord.c2_code}`} />
                <DetailField label="Name Code" value={viewRecord.name_code} />
                <DetailField label="Unit" value={viewRecord.unit} />
                <DetailField label="Barcode Format" value={viewRecord.calculation_rule_name} />
                <DetailField label="Status" value={viewRecord.status} />
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setLabelRecord(viewRecord); setLabelQty(1); }}>
                <Printer className="mr-2 h-4 w-4" /> Print Label
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}

function MasterCard({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function PreviewField({ label, value, mono }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}