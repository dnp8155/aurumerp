import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Share2, Plus, Eye, Trash2, MapPin, History, X, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import useFormDirty from "@/hooks/useFormDirty";

const ECOMMERCE_CHANNELS = ["Shopify", "Amazon", "Website", "Instagram", "WhatsApp", "Flipkart", "Myntra", "Other"];

const buildStoreLocation = (s) => {
  if (!s) return "—";
  return [s.address, s.city, s.state].filter(Boolean).join(", ") || "—";
};

export default function Allocations() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewAlloc, setViewAlloc] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [activeTab, setActiveTab] = useState("allocations");
  const { toast } = useToast();
  const { t } = useI18n();

  const isAdmin = user?.role === "admin" || user?.role === "ho";
  const userStoreId = user?.store_id || "";

  const [form, setForm] = useState({
    channel: "store",
    from_store_id: "",
    product_id: "",
    lines: [{ destination: "", quantity: 1 }],
    transfer_type: "stock_transfer",
    gst_pass_on: false,
    gst_rate: 3,
    transport_mode: "road",
    bilty_number: "",
    notes: "",
  });
  const allocDirty = useFormDirty(dialogOpen, form);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (userStoreId && !form.from_store_id) {
      setForm(f => ({ ...f, from_store_id: userStoreId }));
    }
  }, [userStoreId]);

  const loadData = async () => {
    try {
      const [allocData, prodData, storeData, invData, moveData] = await Promise.all([
        base44.entities.Allocation.list('-created_date', 200),
        base44.entities.Product.filter({ status: "active" }),
        base44.entities.Store.list('-created_date', 100),
        base44.entities.Inventory.list('-created_date', 300),
        base44.entities.InventoryMovement.filter({ movement_type: "transfer" }),
      ]);
      setAllocations(allocData || []);
      setProducts(prodData || []);
      setStores(storeData || []);
      setInventory(invData || []);
      setMovements(moveData || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const sourceInventory = useMemo(() => {
    if (!form.product_id || !form.from_store_id) return null;
    return inventory.find(i => i.product_id === form.product_id && i.store_id === form.from_store_id) || null;
  }, [inventory, form.product_id, form.from_store_id]);

  const availableStock = sourceInventory ? (sourceInventory.quantity || 0) : 0;
  const alreadyAllocated = sourceInventory ? (sourceInventory.allocated_quantity || 0) : 0;
  const remainingStock = availableStock - alreadyAllocated;
  const newAllocTotal = form.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const overStock = newAllocTotal > remainingStock;

  const destinationStores = useMemo(() => {
    if (form.channel === "warehouse") return stores.filter(s => s.type === "warehouse" && s.id !== form.from_store_id);
    if (form.channel === "store") return stores.filter(s => s.type === "store" && s.id !== form.from_store_id);
    return [];
  }, [stores, form.channel, form.from_store_id]);

  const selectedProduct = products.find(p => p.id === form.product_id);

  const resetForm = () => {
    setForm({
      channel: "store",
      from_store_id: userStoreId || "",
      product_id: "",
      lines: [{ destination: "", quantity: 1 }],
      transfer_type: "stock_transfer",
      gst_pass_on: false,
      gst_rate: 3,
      transport_mode: "road",
      bilty_number: "",
      notes: "",
    });
  };

  const updateLine = (idx, field, value) => {
    setForm(f => ({
      ...f,
      lines: f.lines.map((l, i) => i === idx ? { ...l, [field]: value } : l)
    }));
  };

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { destination: "", quantity: 1 }] }));
  const removeLine = (idx) => setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const handleChannelChange = (ch) => {
    setForm(f => ({ ...f, channel: ch, lines: [{ destination: "", quantity: 1 }] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id || !form.from_store_id) {
      toast({ title: "Error", description: "Select product and source store", variant: "destructive" });
      return;
    }
    const validLines = form.lines.filter(l => l.destination && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      toast({ title: "Error", description: "Add at least one destination", variant: "destructive" });
      return;
    }
    if (overStock) {
      toast({ title: "Stock exceeded", description: `Only ${remainingStock} units available to allocate`, variant: "destructive" });
      return;
    }

    try {
      const fromStore = stores.find(s => s.id === form.from_store_id);
      const product = products.find(p => p.id === form.product_id);
      const baseAlloc = Date.now().toString().slice(-8);

      const createdAllocations = [];
      for (let i = 0; i < validLines.length; i++) {
        const line = validLines[i];
        const allocNumber = `ALLOC-${baseAlloc}-${i + 1}`;
        let toStoreId, toStoreName, destLocation, ecomChannel;

        if (form.channel === "ecommerce") {
          ecomChannel = line.destination;
          toStoreId = `ECOM-${ecomChannel}`;
          toStoreName = ecomChannel;
          destLocation = "E-commerce";
        } else {
          const destStore = stores.find(s => s.id === line.destination);
          toStoreId = destStore.id;
          toStoreName = destStore.name;
          destLocation = buildStoreLocation(destStore);
        }

        const gstAmount = form.gst_pass_on ? Number(((product?.cost_price || 0) * Number(line.quantity) * (form.gst_rate || 0) / 100).toFixed(2)) : 0;
        const alloc = await base44.entities.Allocation.create({
          allocation_number: allocNumber,
          product_id: form.product_id,
          sku: product?.sku || "",
          product_name: product?.name || "",
          from_store_id: form.from_store_id,
          from_store_name: fromStore?.name || "",
          to_store_id: toStoreId,
          to_store_name: toStoreName,
          destination_location: destLocation,
          ecommerce_channel: form.channel === "ecommerce" ? ecomChannel : undefined,
          quantity: Number(line.quantity),
          channel: form.channel,
          transfer_type: form.transfer_type,
          gst_pass_on: form.gst_pass_on,
          gst_rate: form.gst_pass_on ? form.gst_rate : 0,
          gst_amount: gstAmount,
          transport_mode: form.channel !== "ecommerce" ? form.transport_mode : undefined,
          bilty_number: form.channel !== "ecommerce" ? form.bilty_number : undefined,
          status: "pending",
          processed_by: user?.full_name || user?.email || "",
          notes: form.notes,
        });
        createdAllocations.push(alloc);

        // Reverse purchase: create a PO in destination store (store-to-store transfer treated as purchase by receiver)
        if (form.transfer_type === "reverse_purchase" && form.channel !== "ecommerce") {
          const poNumber = `RP-${Date.now().toString().slice(-8)}-${i + 1}`;
          const baseAmount = (product?.cost_price || 0) * Number(line.quantity);
          await base44.entities.PurchaseOrder.create({
            po_number: poNumber,
            vendor_id: form.from_store_id,
            vendor_name: fromStore?.name || "Stock Transfer",
            store_id: toStoreId,
            store_name: toStoreName,
            status: "approved",
            items: [{
              product_name: product?.name || "",
              sku: product?.sku || "",
              quantity: Number(line.quantity),
              unit_price: product?.cost_price || 0,
              total_price: baseAmount,
              gst_rate: form.gst_pass_on ? form.gst_rate : 0,
              gst_amount: gstAmount,
              gst_pricing_type: "exclusive",
            }],
            subtotal: baseAmount,
            subtotal_before_gst: baseAmount,
            gst_type: "intra",
            total_gst_amount: gstAmount,
            tax_amount: gstAmount,
            total_amount: baseAmount,
            total_with_gst: baseAmount + gstAmount,
            notes: `Reverse purchase from allocation ${allocNumber}`,
            payment_status: "unpaid",
            payable_amount: baseAmount + gstAmount,
          });
        }

        // History: InventoryMovement (transfer out of source)
        await base44.entities.InventoryMovement.create({
          product_id: form.product_id,
          sku: product?.sku || "",
          product_name: product?.name || "",
          movement_type: "transfer",
          quantity_change: -Number(line.quantity),
          reference_type: "allocation",
          reference_id: alloc.id,
          store_id: form.from_store_id,
          store_name: fromStore?.name || "",
          from_store_id: form.from_store_id,
          from_store_name: fromStore?.name || "",
          to_store_id: toStoreId,
          to_store_name: toStoreName,
          reason: `Allocation ${allocNumber} → ${toStoreName}`,
          notes: form.notes,
        });
      }

      // Update source inventory allocated quantity (single batch)
      if (sourceInventory) {
        await base44.entities.Inventory.update(sourceInventory.id, {
          allocated_quantity: alreadyAllocated + newAllocTotal
        });
      }

      toast({
        title: "Allocation created",
        description: `${createdAllocations.length} allocation(s) — ${newAllocTotal} units total`
      });
      setNextStep({ key: "allocation" });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (alloc) => {
    if (!confirm("Delete this allocation? Stock will be released back.")) return;
    try {
      await base44.entities.Allocation.delete(alloc.id);
      // Release allocated quantity back to source inventory
      const sourceInv = inventory.find(i => i.product_id === alloc.product_id && i.store_id === alloc.from_store_id);
      if (sourceInv) {
        await base44.entities.Inventory.update(sourceInv.id, {
          allocated_quantity: Math.max(0, (sourceInv.allocated_quantity || 0) - (alloc.quantity || 0))
        });
      }
      // History: reverse movement
      const fromStore = stores.find(s => s.id === alloc.from_store_id);
      await base44.entities.InventoryMovement.create({
        product_id: alloc.product_id,
        sku: alloc.sku || "",
        product_name: alloc.product_name || "",
        movement_type: "transfer",
        quantity_change: Number(alloc.quantity || 0),
        reference_type: "allocation_cancel",
        reference_id: alloc.id,
        store_id: alloc.from_store_id,
        store_name: fromStore?.name || alloc.from_store_name || "",
        from_store_id: alloc.to_store_id,
        from_store_name: alloc.to_store_name || "",
        to_store_id: alloc.from_store_id,
        to_store_name: fromStore?.name || alloc.from_store_name || "",
        reason: `Allocation cancelled — ${alloc.allocation_number}`,
      });
      toast({ title: "Allocation deleted", description: "Stock released back to source" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const selectedDestStore = (destId) => stores.find(s => s.id === destId);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("alloc.title")} description={t("alloc.desc")}>
        <ConfirmCloseDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }} isDirty={allocDirty}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Allocation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Allocation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Channel at top */}
              <div>
                <Label>Channel *</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {["store", "warehouse", "ecommerce"].map(ch => (
                    <Button
                      key={ch}
                      type="button"
                      variant={form.channel === ch ? "default" : "outline"}
                      onClick={() => handleChannelChange(ch)}
                      className="capitalize"
                    >
                      {ch === "ecommerce" ? "E-commerce" : ch}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Source store — role based */}
              <div>
                <Label>From (Source Store) *</Label>
                <Select
                  value={form.from_store_id}
                  onValueChange={v => setForm({ ...form, from_store_id: v })}
                  disabled={!isAdmin && !!userStoreId}
                >
                  <SelectTrigger><SelectValue placeholder="Select source store" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>)}
                  </SelectContent>
                </Select>
                {!isAdmin && userStoreId && (
                  <p className="text-xs text-muted-foreground mt-1">Your assigned store is pre-selected</p>
                )}
              </div>

              {/* Product */}
              <div>
                <Label>Product *</Label>
                <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* SKU autofill */}
              <div>
                <Label>SKU (autofilled)</Label>
                <Input
                  value={selectedProduct?.sku || ""}
                  readOnly
                  placeholder="Select a product to autofill SKU"
                  className="bg-muted/50 font-mono"
                />
              </div>

              {/* Stock summary */}
              {form.product_id && form.from_store_id && (
                <div className="rounded-lg border bg-slate-50 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Stock:</span><span className="font-bold">{availableStock}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Already Allocated:</span><span className="font-bold text-violet-600">{alreadyAllocated}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Available to Allocate:</span><span className={`font-bold ${remainingStock <= 0 ? "text-red-600" : "text-green-600"}`}>{remainingStock}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">This Allocation Total:</span><span className={`font-bold ${overStock ? "text-red-600" : "text-blue-600"}`}>{newAllocTotal}</span></div>
                  {overStock && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-medium pt-1">
                      <AlertTriangle className="h-3 w-3" /> Exceeds available stock by {newAllocTotal - remainingStock}
                    </div>
                  )}
                </div>
              )}

              {/* Destination lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>
                    {form.channel === "ecommerce" ? "E-commerce Channels" : "Destination Stores"}
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        {form.channel === "ecommerce" ? (
                          <Select value={line.destination} onValueChange={v => updateLine(idx, "destination", v)}>
                            <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                            <SelectContent>
                              {ECOMMERCE_CHANNELS.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select value={line.destination} onValueChange={v => updateLine(idx, "destination", v)}>
                            <SelectTrigger><SelectValue placeholder="Select destination store" /></SelectTrigger>
                            <SelectContent>
                              {destinationStores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {form.channel !== "ecommerce" && line.destination && selectedDestStore(line.destination) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" /> {buildStoreLocation(selectedDestStore(line.destination))}
                          </div>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={e => updateLine(idx, "quantity", Number(e.target.value))}
                        className="w-24"
                        placeholder="Qty"
                      />
                      {form.lines.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Transfer Type */}
              <div>
                <Label>Transfer Type *</Label>
                <Select value={form.transfer_type} onValueChange={v => setForm({ ...form, transfer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock_transfer">Stock Transfer</SelectItem>
                    <SelectItem value="reverse_purchase">Reverse Purchase (Opposite Purchase)</SelectItem>
                  </SelectContent>
                </Select>
                {form.transfer_type === "reverse_purchase" && (
                  <p className="text-xs text-amber-600 mt-1">A Purchase Order will be auto-created in the destination store</p>
                )}
              </div>

              {/* GST Pass-On (Store to Store) */}
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>GST Pass-On (Store to Store)</Label>
                  <Select value={form.gst_pass_on ? "yes" : "no"} onValueChange={v => setForm({ ...form, gst_pass_on: v === "yes" })}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.gst_pass_on && (
                  <div>
                    <Label>GST Rate (%)</Label>
                    <Input type="number" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: Number(e.target.value) })} />
                  </div>
                )}
              </div>

              {/* Transport details (store/warehouse only) */}
              {form.channel !== "ecommerce" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Transport Mode</Label>
                    <Select value={form.transport_mode} onValueChange={v => setForm({ ...form, transport_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="road">Road</SelectItem>
                        <SelectItem value="rail">Rail</SelectItem>
                        <SelectItem value="air">Air</SelectItem>
                        <SelectItem value="courier">Courier</SelectItem>
                        <SelectItem value="hand">Hand Delivery</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bilty Number</Label>
                    <Input value={form.bilty_number} onChange={e => setForm({ ...form, bilty_number: e.target.value })} placeholder="Bilty / LR number" />
                  </div>
                </div>
              )}

              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={overStock || newAllocTotal <= 0}>Create Allocation{form.lines.length > 1 ? "s" : ""}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </ConfirmCloseDialog>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="allocations"><Share2 className="h-4 w-4 mr-1" /> Allocations</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="allocations">
          {loading ? (
            <div className="h-64 rounded-xl bg-muted animate-pulse" />
          ) : allocations.length === 0 ? (
            <EmptyState icon={Share2} title={t("alloc.no_allocations")} description={t("alloc.desc")} />
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alloc #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Transfer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.allocation_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{a.product_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{a.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{a.from_store_name}</TableCell>
                      <TableCell className="text-sm font-medium">{a.to_store_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.channel === "ecommerce" ? "E-commerce" : (a.destination_location || "—")}
                      </TableCell>
                      <TableCell className="text-right font-medium">{a.quantity}</TableCell>
                      <TableCell><StatusBadge status={a.channel} /></TableCell>
                      <TableCell className="text-xs">
                        {a.transfer_type === "reverse_purchase" ? <span className="text-amber-600 font-medium">Rev. Purchase</span> : <span className="text-muted-foreground">Transfer</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewAlloc(a)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {loading ? (
            <div className="h-64 rounded-xl bg-muted animate-pulse" />
          ) : movements.length === 0 ? (
            <EmptyState icon={History} title="No transfer history yet" description="Stock movements from allocations appear here" />
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Qty Change</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">{m.created_date ? new Date(m.created_date).toLocaleString("en-IN") : "—"}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{m.product_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.sku}</p>
                      </TableCell>
                      <TableCell className="text-sm">{m.from_store_name || "—"}</TableCell>
                      <TableCell className="text-sm">{m.to_store_name || "—"}</TableCell>
                      <TableCell className={`text-right font-bold ${(m.quantity_change || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                        {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View dialog */}
      <Dialog open={!!viewAlloc} onOpenChange={(open) => !open && setViewAlloc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Allocation Details</DialogTitle></DialogHeader>
          {viewAlloc && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Number:</span> <span className="font-mono font-medium">{viewAlloc.allocation_number}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewAlloc.status} /></div>
                <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{viewAlloc.product_name}</span></div>
                <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{viewAlloc.sku}</span></div>
                <div><span className="text-muted-foreground">From:</span> <span className="font-medium">{viewAlloc.from_store_name}</span></div>
                <div><span className="text-muted-foreground">To:</span> <span className="font-medium">{viewAlloc.to_store_name}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Location:</span> <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {viewAlloc.channel === "ecommerce" ? "E-commerce" : (viewAlloc.destination_location || "—")}</span></div>
                {viewAlloc.ecommerce_channel && <div><span className="text-muted-foreground">E-com Channel:</span> <span className="font-medium">{viewAlloc.ecommerce_channel}</span></div>}
                <div><span className="text-muted-foreground">Quantity:</span> <span className="font-bold">{viewAlloc.quantity}</span></div>
                <div><span className="text-muted-foreground">Channel:</span> <StatusBadge status={viewAlloc.channel} /></div>
                {viewAlloc.processed_by && <div><span className="text-muted-foreground">By:</span> <span>{viewAlloc.processed_by}</span></div>}
                <div><span className="text-muted-foreground">Transfer:</span> <span className="font-medium">{viewAlloc.transfer_type === "reverse_purchase" ? "Reverse Purchase" : "Stock Transfer"}</span></div>
                {viewAlloc.gst_pass_on && <div><span className="text-muted-foreground">GST:</span> <span className="font-medium">{viewAlloc.gst_rate || 0}% — ₹{(viewAlloc.gst_amount || 0).toLocaleString()}</span></div>}
                {viewAlloc.transport_mode && <div><span className="text-muted-foreground">Transport:</span> <span className="font-medium capitalize">{viewAlloc.transport_mode}</span></div>}
                {viewAlloc.bilty_number && <div><span className="text-muted-foreground">Bilty #:</span> <span className="font-mono">{viewAlloc.bilty_number}</span></div>}
              </div>
              {viewAlloc.notes && <div><span className="text-muted-foreground">Notes:</span> {viewAlloc.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}