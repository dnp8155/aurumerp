import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Warehouse, RefreshCw, AlertTriangle, Filter, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("all");
  const [agingFilter, setAgingFilter] = useState("all");
  const [writeOffItem, setWriteOffItem] = useState(null);
  const [writeOffQty, setWriteOffQty] = useState("");
  const [writeOffReason, setWriteOffReason] = useState("damaged");
  const [writeOffNotes, setWriteOffNotes] = useState("");
  const [writeOffSaving, setWriteOffSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [invData, storeData] = await Promise.all([
        base44.entities.Inventory.list('-created_date', 200),
        base44.entities.Store.list('-created_date', 100),
      ]);
      setInventory(invData || []);
      setStores(storeData || []);
    } catch (err) {
      console.error("Failed to load inventory", err);
    } finally {
      setLoading(false);
    }
  };

  const handleWriteOff = async () => {
    if (!writeOffItem) return;
    const qty = parseInt(writeOffQty, 10);
    if (!qty || qty <= 0 || qty > (writeOffItem.quantity || 0)) {
      toast({ title: "Enter a valid quantity", description: `Max available: ${writeOffItem.quantity || 0}`, variant: "destructive" });
      return;
    }
    setWriteOffSaving(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const writeoffNumber = `WO-${Date.now().toString().slice(-8)}`;
      await base44.entities.StockWriteOff.create({
        writeoff_number: writeoffNumber,
        inventory_id: writeOffItem.id,
        product_id: writeOffItem.product_id,
        sku: writeOffItem.sku,
        product_name: writeOffItem.product_name,
        store_id: writeOffItem.store_id,
        store_name: writeOffItem.store_name,
        quantity: qty,
        reason: writeOffReason,
        status: "approved",
        approved_by: user?.full_name || user?.email || "Manager",
        writeoff_date: new Date().toISOString().split("T")[0],
        notes: writeOffNotes,
      });
      await base44.entities.Inventory.update(writeOffItem.id, {
        quantity: (writeOffItem.quantity || 0) - qty,
        damaged_quantity: (writeOffItem.damaged_quantity || 0) + qty,
      });
      toast({ title: "Stock written off", description: `${writeoffNumber} — ${qty} unit(s) removed` });
      setWriteOffItem(null);
      setWriteOffQty("");
      setWriteOffReason("damaged");
      setWriteOffNotes("");
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setWriteOffSaving(false);
    }
  };

  const filtered = inventory.filter(item => {
    if (storeFilter !== "all" && item.store_id !== storeFilter) return false;
    if (agingFilter !== "all" && item.aging_status !== agingFilter) return false;
    return true;
  });

  const totalStock = filtered.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalAllocated = filtered.reduce((s, i) => s + (i.allocated_quantity || 0), 0);
  const lowStockCount = filtered.filter(i => i.min_stock_level > 0 && (i.quantity || 0) <= i.min_stock_level).length;
  const redCount = filtered.filter(i => i.aging_status === "red").length;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("stock.overview_title")} description={t("inv.desc")}>
        <Button variant="outline" onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" /> {t("action.refresh")}</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("stock.total")}</p>
          <p className="text-xl font-heading font-bold mt-1">{totalStock.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("stock.allocated")}</p>
          <p className="text-xl font-heading font-bold mt-1 text-violet-600">{totalAllocated.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("inv.low_stock")}</p>
          <p className="text-xl font-heading font-bold mt-1 text-amber-600">{lowStockCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Old Stock (Red)</p>
          <p className="text-xl font-heading font-bold mt-1 text-red-600">{redCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Select value={agingFilter} onValueChange={setAgingFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All aging" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Aging</SelectItem>
            <SelectItem value="green">Fresh (Green)</SelectItem>
            <SelectItem value="amber">Aging (Amber)</SelectItem>
            <SelectItem value="red">Old Stock (Red)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Warehouse} title={t("inv.no_inventory")} description={t("inv.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Min Level</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const isLow = item.min_stock_level > 0 && (item.quantity || 0) <= item.min_stock_level;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-medium">{item.sku}</TableCell>
                    <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-sm">{item.store_name || "—"}</TableCell>
                    <TableCell><StatusBadge status={item.channel} /></TableCell>
                    <TableCell className={`text-right font-medium ${isLow ? "text-amber-600" : ""}`}>
                      {item.quantity || 0}
                      {isLow && <AlertTriangle className="inline ml-1 h-3 w-3" />}
                    </TableCell>
                    <TableCell className="text-right text-violet-600">{item.allocated_quantity || 0}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{item.min_stock_level || 0}</TableCell>
                    <TableCell><StatusBadge status={item.aging_status} /></TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        disabled={(item.quantity || 0) <= 0}
                        onClick={() => { setWriteOffItem(item); setWriteOffQty(""); setWriteOffReason("damaged"); setWriteOffNotes(""); }}
                      >
                        <Scissors className="mr-1 h-3.5 w-3.5" /> Write Off
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!writeOffItem} onOpenChange={(open) => !open && setWriteOffItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Stock Write-off</DialogTitle></DialogHeader>
          {writeOffItem && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Product:</span><span className="font-medium">{writeOffItem.product_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SKU:</span><span className="font-mono text-xs">{writeOffItem.sku}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Store:</span><span>{writeOffItem.store_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Available:</span><span className="font-bold">{writeOffItem.quantity || 0}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity to write off *</Label>
                  <Input
                    type="number"
                    min="1"
                    max={writeOffItem.quantity || 0}
                    value={writeOffQty}
                    onChange={(e) => setWriteOffQty(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Reason *</Label>
                  <Select value={writeOffReason} onValueChange={setWriteOffReason}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="theft">Theft</SelectItem>
                      <SelectItem value="quality_reject">Quality Reject</SelectItem>
                      <SelectItem value="obsolete">Obsolete</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={writeOffNotes}
                  onChange={(e) => setWriteOffNotes(e.target.value)}
                  placeholder="Add any detail about this write-off..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOffItem(null)}>Cancel</Button>
            <Button onClick={handleWriteOff} disabled={writeOffSaving}>
              {writeOffSaving ? "Saving..." : "Confirm Write-off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}