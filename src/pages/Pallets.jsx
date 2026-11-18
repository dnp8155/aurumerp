import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Boxes, Plus, Eye, Truck, Check, AlertTriangle, Printer } from "lucide-react";
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
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import StatusBadge from "@/components/erp/StatusBadge";
import BarcodeDisplay from "@/components/erp/BarcodeDisplay";
import CourierRateComparison from "@/components/erp/CourierRateComparison";
import NextStepDialog from "@/components/erp/NextStepDialog";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import useFormDirty from "@/hooks/useFormDirty";
import { format } from "date-fns";

export default function Pallets() {
  const [pallets, setPallets] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [stores, setStores] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewPallet, setViewPallet] = useState(null);
  const [viewShipment, setViewShipment] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [form, setForm] = useState({
    destination_store_id: "", source_store_id: "", transporter: "", transporter_gst: "",
    tracking_number: "", weight: "", boxes: "", total_value: "", tds_rate: 1, tds_threshold: 50000,
    selectedAllocations: []
  });
  const { toast } = useToast();
  const { t } = useI18n();
  const palletDirty = useFormDirty(dialogOpen, form);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [palletData, shipmentData, storeData, allocData] = await Promise.all([
        base44.entities.Pallet.list('-created_date', 100),
        base44.entities.Shipment.list('-created_date', 100),
        base44.entities.Store.list('-created_date', 100),
        base44.entities.Allocation.filter({ status: "pending" }),
      ]);
      setPallets(palletData || []);
      setShipments(shipmentData || []);
      setStores(storeData || []);
      setAllocations(allocData || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePallet = async (e) => {
    e.preventDefault();
    if (!form.destination_store_id || !form.source_store_id || form.selectedAllocations.length === 0) {
      toast({ title: "Error", description: "Select source, destination, and at least one allocation", variant: "destructive" });
      return;
    }
    try {
      const destStore = stores.find(s => s.id === form.destination_store_id);
      const sourceStore = stores.find(s => s.id === form.source_store_id);
      const palletCode = `PLT-${Date.now().toString().slice(-8)}`;
      const barcode = `PLT${palletCode.replace(/[^A-Z0-9]/gi, '').padEnd(10, '0')}`;

      const selectedAllocs = allocations.filter(a => form.selectedAllocations.includes(a.id));
      const items = selectedAllocs.map(a => ({
        product_id: a.product_id,
        sku: a.sku,
        product_name: a.product_name,
        quantity: a.quantity
      }));
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      const totalValue = parseFloat(form.total_value) || 0;
      const tdsThreshold = parseFloat(form.tds_threshold) || 50000;
      const tdsRate = parseFloat(form.tds_rate) || 1;
      const tdsApplicable = totalValue > tdsThreshold;
      const tdsAmount = tdsApplicable ? Math.round(totalValue * tdsRate / 100) : 0;

      const pallet = await base44.entities.Pallet.create({
        pallet_code: palletCode,
        barcode,
        destination_store_id: form.destination_store_id,
        destination_store_name: destStore?.name,
        source_store_id: form.source_store_id,
        source_store_name: sourceStore?.name,
        items,
        total_items: items.length,
        total_quantity: totalQty,
        status: "created",
      });

      // Create shipment
      const shipmentNumber = `SHP-${Date.now().toString().slice(-8)}`;
      const shipment = await base44.entities.Shipment.create({
        shipment_number: shipmentNumber,
        type: "outbound",
        pallet_id: pallet.id,
        pallet_code: palletCode,
        from_store_id: form.source_store_id,
        from_store_name: sourceStore?.name,
        to_store_id: form.destination_store_id,
        to_store_name: destStore?.name,
        status: "created",
        transporter: form.transporter,
        transporter_gst: form.transporter_gst,
        tracking_number: form.tracking_number,
        weight: parseFloat(form.weight) || 0,
        boxes: parseInt(form.boxes) || 0,
        total_quantity: totalQty,
        total_value: totalValue,
        tds_applicable: tdsApplicable,
        tds_rate: tdsRate,
        tds_threshold: tdsThreshold,
        tds_amount: tdsAmount,
      });

      await base44.entities.Pallet.update(pallet.id, { shipment_id: shipment.id });

      // Update allocations to dispatched
      await Promise.all(selectedAllocs.map(a =>
        base44.entities.Allocation.update(a.id, { status: "dispatched", pallet_id: pallet.id })
      ));

      toast({ title: "Pallet & shipment created", description: `${palletCode} → ${destStore?.name}` });
      setNextStep({ key: "pallet" });
      setDialogOpen(false);
      setForm({
        destination_store_id: "", source_store_id: "", transporter: "", transporter_gst: "",
        tracking_number: "", weight: "", boxes: "", total_value: "", tds_rate: 1, tds_threshold: 50000,
        selectedAllocations: []
      });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleAllocation = (id) => {
    setForm(prev => ({
      ...prev,
      selectedAllocations: prev.selectedAllocations.includes(id)
        ? prev.selectedAllocations.filter(a => a !== id)
        : [...prev.selectedAllocations, id]
    }));
  };

  const handleDispatch = async (shipment) => {
    try {
      await base44.entities.Shipment.update(shipment.id, { status: "dispatched", dispatched_date: new Date().toISOString() });
      await base44.entities.Pallet.update(shipment.pallet_id, { status: "dispatched", dispatched_date: new Date().toISOString() });
      toast({ title: "Shipment dispatched" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReceive = async (shipment) => {
    try {
      await base44.entities.Shipment.update(shipment.id, { status: "received", received_date: new Date().toISOString(), received_by: "Store Manager" });
      await base44.entities.Pallet.update(shipment.pallet_id, { status: "received", received_date: new Date().toISOString() });

      // Add inventory at destination store
      const pallet = pallets.find(p => p.id === shipment.pallet_id);
      if (pallet) {
        for (const item of (pallet.items || [])) {
          const existingInv = await base44.entities.Inventory.filter({ product_id: item.product_id, store_id: shipment.to_store_id });
          if (existingInv && existingInv.length > 0) {
            const inv = existingInv[0];
            await base44.entities.Inventory.update(inv.id, {
              quantity: (inv.quantity || 0) + item.quantity,
              last_received_date: new Date().toISOString()
            });
          } else {
            await base44.entities.Inventory.create({
              product_id: item.product_id,
              sku: item.sku,
              product_name: item.product_name,
              store_id: shipment.to_store_id,
              store_name: shipment.to_store_name,
              quantity: item.quantity,
              allocated_quantity: 0,
              channel: "store",
              aging_status: "green",
              last_received_date: new Date().toISOString(),
              min_stock_level: 0,
            });
          }
        }
        // Update allocation status to received
        await base44.entities.Allocation.updateMany(
          { pallet_id: pallet.id },
          { $set: { status: "received" } }
        );
      }

      toast({ title: "Shipment received", description: "Inventory updated at destination" });
      setNextStep({ key: "shipment_received" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const flagDiscrepancy = async (shipment) => {
    const reason = prompt("Discrepancy reason:");
    if (!reason) return;
    try {
      await base44.entities.Shipment.update(shipment.id, { status: "discrepancy", discrepancy_notes: reason });
      await base44.entities.Pallet.update(shipment.pallet_id, { status: "discrepancy" });
      toast({ title: "Discrepancy flagged" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const pendingAllocations = allocations.filter(a => form.selectedAllocations.includes(a.id));
  const sameDestAllocs = form.destination_store_id
    ? allocations.filter(a => a.to_store_id === form.destination_store_id && a.status === "pending")
    : [];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("pal.title")} description={t("pal.desc")}>
        <ConfirmCloseDialog open={dialogOpen} onOpenChange={setDialogOpen} isDirty={palletDirty}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Pallet</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Pallet & Shipment</DialogTitle></DialogHeader>
            <form onSubmit={handleCreatePallet} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Source *</Label>
                  <Select value={form.source_store_id} onValueChange={v => setForm({ ...form, source_store_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Destination *</Label>
                  <Select value={form.destination_store_id} onValueChange={v => setForm({ ...form, destination_store_id: v, selectedAllocations: [] })}>
                    <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                    <SelectContent>
                      {stores.filter(s => s.id !== form.source_store_id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Transporter</Label><Input value={form.transporter} onChange={e => setForm({ ...form, transporter: e.target.value })} placeholder="e.g. DTDC, BlueDart" /></div>
              <div><Label>Transporter GST</Label><Input value={form.transporter_gst} onChange={e => setForm({ ...form, transporter_gst: e.target.value })} placeholder="22AAAAA0000A1Z5" /></div>
              <div><Label>Tracking Number</Label><Input value={form.tracking_number} onChange={e => setForm({ ...form, tracking_number: e.target.value })} placeholder="Courier tracking ID" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Weight (kg)</Label><Input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="0" /></div>
                <div><Label>Boxes</Label><Input type="number" value={form.boxes} onChange={e => setForm({ ...form, boxes: e.target.value })} placeholder="0" /></div>
                <div><Label>Total Value (₹)</Label><Input type="number" value={form.total_value} onChange={e => setForm({ ...form, total_value: e.target.value })} placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>TDS Rate (%)</Label><Input type="number" value={form.tds_rate} onChange={e => setForm({ ...form, tds_rate: e.target.value })} placeholder="1" /></div>
                <div><Label>TDS Threshold (₹)</Label><Input type="number" value={form.tds_threshold} onChange={e => setForm({ ...form, tds_threshold: e.target.value })} placeholder="50000" /></div>
              </div>
              {form.total_value && parseFloat(form.total_value) > (parseFloat(form.tds_threshold) || 50000) && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  TDS applicable: ₹{Math.round((parseFloat(form.total_value) || 0) * (parseFloat(form.tds_rate) || 1) / 100).toLocaleString()} ({form.tds_rate || 1}% on ₹{(parseFloat(form.total_value) || 0).toLocaleString()})
                </div>
              )}

              {form.destination_store_id && (
                <div>
                  <Label>Pending Allocations for Destination</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border p-2">
                    {sameDestAllocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">No pending allocations for this destination</p>
                    ) : (
                      sameDestAllocs.map(a => (
                        <label key={a.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.selectedAllocations.includes(a.id)}
                            onChange={() => toggleAllocation(a.id)}
                            className="rounded"
                          />
                          <div className="flex-1 text-sm">
                            <span className="font-medium">{a.product_name}</span>
                            <span className="text-muted-foreground ml-2">({a.sku})</span>
                          </div>
                          <span className="text-sm font-bold">{a.quantity} pcs</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {pendingAllocations.length > 0 && (
                <div className="rounded-lg bg-muted/50 p-2 text-sm">
                  Total: {pendingAllocations.length} items, {pendingAllocations.reduce((s, a) => s + a.quantity, 0)} units
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Create Pallet & Shipment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </ConfirmCloseDialog>
      </PageHeader>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : (
        <Tabs defaultValue="shipments">
          <TabsList>
            <TabsTrigger value="shipments">Shipments</TabsTrigger>
            <TabsTrigger value="pallets">Pallets</TabsTrigger>
          </TabsList>

          <TabsContent value="shipments" className="mt-4">
            {shipments.length === 0 ? (
              <EmptyState icon={Truck} title={t("pal.no_shipments")} description={t("pal.desc")} />
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment #</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Tracking ID</TableHead>
                      <TableHead>Transporter / GST</TableHead>
                      <TableHead className="text-right">Wt / Boxes</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs font-medium">{s.shipment_number}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            <span>{s.from_store_name}</span>
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            <span>{s.to_store_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.tracking_number || "—"}</TableCell>
                        <TableCell className="text-sm">
                          <div>{s.transporter || "—"}</div>
                          {s.transporter_gst && <div className="font-mono text-xs text-muted-foreground">{s.transporter_gst}</div>}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <div>{s.weight ? `${s.weight} kg` : "—"}</div>
                          <div className="text-xs text-muted-foreground">{s.boxes ? `${s.boxes} boxes` : ""}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {s.tds_applicable ? (
                            <span className="text-amber-600 font-medium">₹{(s.tds_amount || 0).toLocaleString()}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setViewShipment(s)}><Eye className="h-4 w-4" /></Button>
                            {s.status === "created" && (
                              <Button variant="outline" size="sm" onClick={() => handleDispatch(s)}>Dispatch</Button>
                            )}
                            {s.status === "dispatched" && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleReceive(s)} className="text-emerald-600"><Check className="mr-1 h-3 w-3" /> Receive</Button>
                                <Button variant="ghost" size="icon" onClick={() => flagDiscrepancy(s)}><AlertTriangle className="h-4 w-4 text-amber-500" /></Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pallets" className="mt-4">
            {pallets.length === 0 ? (
              <EmptyState icon={Boxes} title={t("pal.no_pallets")} description={t("pal.desc")} />
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pallet Code</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pallets.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-medium">{p.pallet_code}</TableCell>
                        <TableCell className="text-sm">{p.source_store_name} → {p.destination_store_name}</TableCell>
                        <TableCell className="text-right text-sm">{p.total_items || 0}</TableCell>
                        <TableCell className="text-right font-medium">{p.total_quantity || 0}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setViewPallet(p)}><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!viewPallet} onOpenChange={(open) => !open && setViewPallet(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pallet — {viewPallet?.pallet_code}</DialogTitle></DialogHeader>
          {viewPallet && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <BarcodeDisplay value={viewPallet.barcode} label="Pallet Barcode" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">From:</span> <span className="font-medium">{viewPallet.source_store_name}</span></div>
                <div><span className="text-muted-foreground">To:</span> <span className="font-medium">{viewPallet.destination_store_name}</span></div>
                <div><span className="text-muted-foreground">Items:</span> <span className="font-medium">{viewPallet.total_items}</span></div>
                <div><span className="text-muted-foreground">Total Qty:</span> <span className="font-medium">{viewPallet.total_quantity}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewPallet.status} /></div>
                {viewPallet.dispatched_date && <div><span className="text-muted-foreground">Dispatched:</span> <span className="font-medium">{format(new Date(viewPallet.dispatched_date), "dd MMM yyyy")}</span></div>}
                {viewPallet.received_date && <div><span className="text-muted-foreground">Received:</span> <span className="font-medium">{format(new Date(viewPallet.received_date), "dd MMM yyyy")}</span></div>}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Contents</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewPallet.items || []).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print Slip
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewShipment} onOpenChange={(open) => !open && setViewShipment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Shipment — {viewShipment?.shipment_number}</DialogTitle></DialogHeader>
          {viewShipment && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{viewShipment.type}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewShipment.status} /></div>
                <div><span className="text-muted-foreground">From:</span> <span className="font-medium">{viewShipment.from_store_name}</span></div>
                <div><span className="text-muted-foreground">To:</span> <span className="font-medium">{viewShipment.to_store_name}</span></div>
                <div><span className="text-muted-foreground">Pallet:</span> <span className="font-mono">{viewShipment.pallet_code}</span></div>
                <div><span className="text-muted-foreground">Transporter:</span> <span className="font-medium">{viewShipment.transporter || "—"}</span></div>
                <div><span className="text-muted-foreground">Transporter GST:</span> <span className="font-mono text-xs">{viewShipment.transporter_gst || "—"}</span></div>
                <div><span className="text-muted-foreground">Tracking ID:</span> <span className="font-mono text-xs">{viewShipment.tracking_number || "—"}</span></div>
                <div><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{viewShipment.weight ? `${viewShipment.weight} kg` : "—"}</span></div>
                <div><span className="text-muted-foreground">Boxes:</span> <span className="font-medium">{viewShipment.boxes || "—"}</span></div>
                <div><span className="text-muted-foreground">Total Qty:</span> <span className="font-medium">{viewShipment.total_quantity || "—"}</span></div>
                <div><span className="text-muted-foreground">Total Value:</span> <span className="font-medium">₹{(viewShipment.total_value || 0).toLocaleString()}</span></div>
                {viewShipment.dispatched_date && <div><span className="text-muted-foreground">Dispatched:</span> <span className="font-medium">{format(new Date(viewShipment.dispatched_date), "dd MMM yyyy")}</span></div>}
                {viewShipment.received_date && <div><span className="text-muted-foreground">Received:</span> <span className="font-medium">{format(new Date(viewShipment.received_date), "dd MMM yyyy")}</span></div>}
              </div>
              {viewShipment.tds_applicable && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    TDS Applicable (above ₹{(viewShipment.tds_threshold || 0).toLocaleString()})
                  </div>
                  <div className="mt-1 text-sm text-amber-700">
                    Rate: {viewShipment.tds_rate}% · TDS Amount: <span className="font-bold">₹{(viewShipment.tds_amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
              {viewShipment.discrepancy_notes && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-red-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {viewShipment.discrepancy_notes}
                </div>
              )}

              <div className="border-t pt-3">
                <CourierRateComparison
                  shipment={viewShipment}
                  pickupPincode={stores.find(s => s.id === viewShipment.from_store_id)?.pincode}
                  deliveryPincode={stores.find(s => s.id === viewShipment.to_store_id)?.pincode}
                  onBooked={async (courier) => {
                    await base44.entities.Shipment.update(viewShipment.id, {
                      transporter: courier.courier_name,
                      tracking_number: courier.awb_code,
                      courier_name: courier.courier_name,
                      courier_rate: courier.courier_rate,
                      awb_code: courier.awb_code,
                      shiprocket_order_id: courier.shiprocket_order_id,
                    });
                    toast({ title: "Courier booked & shipment updated" });
                    loadData();
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}