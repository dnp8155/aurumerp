import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PackageCheck, Plus, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import StatusBadge from "@/components/erp/StatusBadge";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";

export default function GoodsReceipt() {
  const [receipts, setReceipts] = useState([]);
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qcDialog, setQcDialog] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [form, setForm] = useState({ po_id: "" });
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [receiptData, poData] = await Promise.all([
        base44.entities.GoodsReceipt.list('-created_date', 100),
        base44.entities.PurchaseOrder.filter({ status: "approved" }),
      ]);
      setReceipts(receiptData || []);
      setPOs(poData || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.po_id) {
      toast({ title: "Error", description: "Select a PO", variant: "destructive" });
      return;
    }
    try {
      const po = pos.find(p => p.id === form.po_id);
      const receiptNumber = `GR-${Date.now().toString().slice(-8)}`;
      const items = (po.items || []).map(item => ({
        product_name: item.product_name,
        ordered_quantity: item.quantity,
        received_quantity: item.quantity,
        accepted_quantity: 0,
        rejected_quantity: 0,
        qc_status: "pending",
        discrepancy_reason: ""
      }));
      await base44.entities.GoodsReceipt.create({
        receipt_number: receiptNumber,
        po_id: po.id,
        po_number: po.po_number,
        vendor_id: po.vendor_id,
        vendor_name: po.vendor_name,
        store_id: po.store_id,
        store_name: po.store_name,
        received_date: new Date().toISOString(),
        received_by: "Current User",
        status: "pending_qc",
        items,
        total_received: items.reduce((s, i) => s + (i.received_quantity || 0), 0),
        total_accepted: 0,
        total_rejected: 0,
      });
      await base44.entities.PurchaseOrder.update(po.id, { status: "partially_received" });
      toast({ title: "Goods receipt created", description: "Ready for QC" });
      setDialogOpen(false);
      setForm({ po_id: "" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleQC = async (receipt, itemIdx, qcStatus, acceptedQty, rejectedQty, reason, description) => {
    try {
      const items = [...(receipt.items || [])];
      items[itemIdx] = {
        ...items[itemIdx],
        qc_status: qcStatus,
        accepted_quantity: acceptedQty,
        rejected_quantity: rejectedQty,
        discrepancy_reason: reason || "",
        description: description || ""
      };

      const allDone = items.every(i => i.qc_status !== "pending");
      const totalAccepted = items.reduce((s, i) => s + (i.accepted_quantity || 0), 0);
      const totalRejected = items.reduce((s, i) => s + (i.rejected_quantity || 0), 0);
      const hasDiscrepancy = items.some(i => i.qc_status === "rejected" || i.qc_status === "partial" || (i.discrepancy_reason && i.discrepancy_reason.trim()));

      let status = receipt.status;
      if (allDone) {
        status = hasDiscrepancy ? "discrepancy" : "qc_completed";
      } else if (receipt.status === "pending_qc") {
        status = "qc_in_progress";
      }

      await base44.entities.GoodsReceipt.update(receipt.id, {
        items, total_accepted: totalAccepted, total_rejected: totalRejected, status
      });
      toast({ title: "QC updated" });
      setQcDialog(null);
      loadData();
      if (allDone) setNextStep({ key: "goods_receipt" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("gr.title")} description={t("gr.desc")}>
        <ConfirmCloseDialog open={dialogOpen} onOpenChange={setDialogOpen} isDirty={!!form.po_id}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Goods Receipt</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Goods Receipt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Select Approved PO *</Label>
                <Select value={form.po_id} onValueChange={v => setForm({ ...form, po_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>
                    {pos.length === 0 ? <SelectItem value={null} disabled>No approved POs</SelectItem> :
                      pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} — {p.vendor_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Create & Start QC</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </ConfirmCloseDialog>
      </PageHeader>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : receipts.length === 0 ? (
        <EmptyState icon={PackageCheck} title={t("gr.no_receipts")} description={t("gr.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-medium">{r.receipt_number}</TableCell>
                  <TableCell className="text-xs">{r.po_number}</TableCell>
                  <TableCell className="text-sm font-medium">{r.vendor_name}</TableCell>
                  <TableCell className="text-sm">{r.total_received || 0}</TableCell>
                  <TableCell className="text-sm text-emerald-600 font-medium">{r.total_accepted || 0}</TableCell>
                  <TableCell className="text-sm text-red-600 font-medium">{r.total_rejected || 0}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.status !== "qc_completed" && (
                        <Button variant="outline" size="sm" onClick={() => setQcDialog(r)}>QC</Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setViewReceipt(r)}><Eye className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <QCDialog receipt={qcDialog} onClose={() => setQcDialog(null)} onSubmit={handleQC} />

      <Dialog open={!!viewReceipt} onOpenChange={(open) => !open && setViewReceipt(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Details — {viewReceipt?.receipt_number}</DialogTitle>
          </DialogHeader>
          {viewReceipt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">PO:</span> <span className="font-medium">{viewReceipt.po_number}</span></div>
                <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{viewReceipt.vendor_name}</span></div>
                <div><span className="text-muted-foreground">Store:</span> <span className="font-medium">{viewReceipt.store_name}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{viewReceipt.received_date ? format(new Date(viewReceipt.received_date), "dd MMM yyyy") : "—"}</span></div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Items</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Ord</TableHead>
                        <TableHead className="text-right">Recv</TableHead>
                        <TableHead className="text-right">Acc</TableHead>
                        <TableHead className="text-right">Rej</TableHead>
                        <TableHead>QC</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewReceipt.items || []).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-right text-sm">{item.ordered_quantity}</TableCell>
                          <TableCell className="text-right text-sm">{item.received_quantity}</TableCell>
                          <TableCell className="text-right text-sm text-emerald-600">{item.accepted_quantity}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{item.rejected_quantity}</TableCell>
                          <TableCell><StatusBadge status={item.qc_status === "pending" ? "pending_qc" : item.qc_status === "accepted" ? "qc_completed" : item.qc_status === "rejected" ? "discrepancy" : "qc_in_progress"} label={item.qc_status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.description || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {viewReceipt.discrepancy_notes && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {viewReceipt.discrepancy_notes}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}

function QCDialog({ receipt, onClose, onSubmit }) {
  const [itemIdx, setItemIdx] = useState(0);
  const [qcStatus, setQcStatus] = useState("accepted");
  const [acceptedQty, setAcceptedQty] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [descMode, setDescMode] = useState("select");
  const [rejectedEdited, setRejectedEdited] = useState(false);
  const [touched, setTouched] = useState(false);

  const QC_DESCRIPTIONS = [
    "Damaged in transit",
    "Wrong product received",
    "Quantity shortage",
    "Quality issue",
    "Wrong color/size",
    "Missing pieces",
    "Expired product",
    "Packaging damaged",
  ];

  useEffect(() => {
    setTouched(false);
    setRejectedEdited(false);
    if (receipt && receipt.items?.[0]) {
      setItemIdx(0);
      const item = receipt.items[0];
      setQcStatus(item.qc_status === "pending" ? "accepted" : item.qc_status);
      setAcceptedQty(item.accepted_quantity || item.received_quantity || 0);
      setRejectedQty(item.rejected_quantity || 0);
      setReason(item.discrepancy_reason || "");
      setDescription(item.description || "");
      setDescMode(item.description && !QC_DESCRIPTIONS.includes(item.description) ? "manual" : "select");
    }
  }, [receipt]);

  if (!receipt) return null;

  const item = receipt.items?.[itemIdx];

  const selectItem = (idx) => {
    setItemIdx(idx);
    setTouched(true);
    setRejectedEdited(false);
    const it = receipt.items[idx];
    setQcStatus(it.qc_status === "pending" ? "accepted" : it.qc_status);
    setAcceptedQty(it.accepted_quantity || it.received_quantity || 0);
    setRejectedQty(it.rejected_quantity || 0);
    setReason(it.discrepancy_reason || "");
    setDescription(it.description || "");
    setDescMode(it.description && !QC_DESCRIPTIONS.includes(it.description) ? "manual" : "select");
  };

  return (
    <ConfirmCloseDialog open={!!receipt} onOpenChange={(open) => !open && onClose()} isDirty={touched}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quality Check — {receipt.receipt_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Item</Label>
            <Select value={String(itemIdx)} onValueChange={v => selectItem(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {receipt.items.map((it, i) => (
                  <SelectItem key={i} value={String(i)}>{it.product_name} ({it.received_quantity} pcs)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {item && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Ordered:</span><span className="font-medium">{item.ordered_quantity}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Received:</span><span className="font-medium">{item.received_quantity}</span></div>
            </div>
          )}
          <div>
            <Label>QC Result</Label>
            <Select value={qcStatus} onValueChange={(v) => { setQcStatus(v); setTouched(true); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="partial">Partial Accept</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Accepted Qty</Label>
              <Input type="number" value={acceptedQty} onChange={e => {
                const newAccepted = Number(e.target.value);
                setAcceptedQty(newAccepted);
                setTouched(true);
                if (!rejectedEdited && item) {
                  setRejectedQty(Math.max(0, (item.received_quantity || 0) - newAccepted));
                }
              }} />
            </div>
            <div>
              <Label>Rejected Qty</Label>
              <Input type="number" value={rejectedQty} onChange={e => { setRejectedQty(Number(e.target.value)); setTouched(true); setRejectedEdited(true); }} />
            </div>
          </div>
          {(qcStatus === "rejected" || qcStatus === "partial") && (
            <div>
              <Label>Discrepancy Reason</Label>
              <Textarea value={reason} onChange={e => { setReason(e.target.value); setTouched(true); }} rows={2} placeholder="e.g. Damaged, wrong color, missing pieces" />
            </div>
          )}
          <div>
            <Label>QC Description</Label>
            <div className="flex gap-2 mb-2">
              <Button type="button" size="sm" variant={descMode === "select" ? "default" : "outline"} onClick={() => setDescMode("select")}>Dropdown</Button>
              <Button type="button" size="sm" variant={descMode === "manual" ? "default" : "outline"} onClick={() => { setDescMode("manual"); setTouched(true); }}>Manual</Button>
            </div>
            {descMode === "select" ? (
              <Select value={QC_DESCRIPTIONS.includes(description) ? description : ""} onValueChange={v => { setDescription(v); setTouched(true); }}>
                <SelectTrigger><SelectValue placeholder="Select description" /></SelectTrigger>
                <SelectContent>
                  {QC_DESCRIPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={description} onChange={e => { setDescription(e.target.value); setTouched(true); }} placeholder="Enter description manually" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSubmit(receipt, itemIdx, qcStatus, acceptedQty, rejectedQty, reason, description)}>Save QC</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </ConfirmCloseDialog>
  );
}