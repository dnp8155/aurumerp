import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Wrench, ArrowLeft, Printer, MessageCircle, Trash2, CheckCircle, AlertTriangle, Phone, ShieldCheck, Clock, Database, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import RepairStatusStepper from "@/components/erp/RepairStatusStepper";
import RepairActionsEditor from "@/components/erp/RepairActionsEditor";
import RepairTechnicianEditor from "@/components/erp/RepairTechnicianEditor";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { format, differenceInCalendarDays } from "date-fns";
import RepairJobReceiptPrint from "@/components/erp/RepairJobReceiptPrint";
import RepairDeliveryReceiptPrint from "@/components/erp/RepairDeliveryReceiptPrint";
import RepairActivityLog from "@/components/erp/RepairActivityLog";

const STATUS_FLOW = ["received", "diagnosing", "in_progress", "awaiting_parts", "ready_for_delivery", "delivered"];

export default function RepairDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [repair, setRepair] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [printType, setPrintType] = useState("job");
  const [statusForm, setStatusForm] = useState({
    status: "", technician_notes: "", actual_cost: 0, labor_charge: 0, parts_cost: 0, advance_paid: 0,
    refund_method: "cash", refund_cheque_name: "", refund_cheque_number: "",
    actual_completion: "", delivered_date: "",
    repair_actions: [], technicians: [],
    payment_method: "cash", payment_cheque_name: "", payment_cheque_number: "",
    warranty_claim: false, warranty_reference: "",
    notes: "", priority: "medium", estimated_cost: 0
  });
  const [saving, setSaving] = useState(false);
  const [syncingTally, setSyncingTally] = useState(false);

  const loadRepair = async () => {
    try {
      const r = await base44.entities.Repair.get(id);
      setRepair(r);
      if (r.store_id) {
        try { const s = await base44.entities.Store.get(r.store_id); setStore(s); } catch { setStore(null); }
      }
      const today = format(new Date(), "yyyy-MM-dd");
      setStatusForm({
        status: r.status, technician_notes: r.technician_notes || "",
        actual_cost: r.actual_cost || 0, labor_charge: r.labor_charge || 0,
        parts_cost: r.parts_cost || 0, advance_paid: r.advance_paid || 0,
        refund_method: r.payment_method || "cash", refund_cheque_name: "", refund_cheque_number: "",
        actual_completion: r.actual_completion || today,
        delivered_date: r.delivered_date || today,
        repair_actions: r.repair_actions || [],
        technicians: r.technicians || [],
        payment_method: r.payment_method || "cash", payment_cheque_name: "", payment_cheque_number: "",
        warranty_claim: r.warranty_claim || false, warranty_reference: r.warranty_reference || "",
        notes: r.notes || "", priority: r.priority || "medium", estimated_cost: r.estimated_cost || 0
      });
    } catch (err) {
      toast({ title: "Failed to load repair", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRepair(); }, [id]);

  const handleStatusUpdate = async () => {
    setSaving(true);
    try {
      const totalCharge = (statusForm.labor_charge || 0) + (statusForm.parts_cost || 0);
      const balance = Math.max(0, totalCharge - (statusForm.advance_paid || 0));
      const paymentStatus = statusForm.advance_paid >= totalCharge && totalCharge > 0 ? "paid" : statusForm.advance_paid > 0 ? "advance" : "unpaid";
      const isCancelled = statusForm.status === "cancelled" || statusForm.status === "rejected";
      const refundDue = isCancelled ? (statusForm.advance_paid || 0) : Math.max(0, (statusForm.advance_paid || 0) - totalCharge);

      const updates = {
        status: statusForm.status,
        technician_notes: statusForm.technician_notes,
        actual_cost: statusForm.actual_cost || totalCharge,
        labor_charge: statusForm.labor_charge || 0,
        parts_cost: statusForm.parts_cost || 0,
        total_charge: totalCharge,
        advance_paid: statusForm.advance_paid,
        balance_due: balance,
        payment_status: refundDue > 0 ? "refunded" : paymentStatus,
        repair_actions: statusForm.repair_actions,
        technicians: statusForm.technicians,
        warranty_claim: statusForm.warranty_claim,
        warranty_reference: statusForm.warranty_reference,
        notes: statusForm.notes,
        priority: statusForm.priority,
        estimated_cost: statusForm.estimated_cost
      };
      if (statusForm.status === "delivered") {
        updates.payment_method = statusForm.payment_method;
        if (statusForm.payment_method === "cheque") {
          updates.payment_cheque_name = statusForm.payment_cheque_name;
          updates.payment_cheque_number = statusForm.payment_cheque_number;
        }
      }
      if (refundDue > 0) {
        updates.refund_method = statusForm.refund_method;
        if (statusForm.refund_method === "cheque") {
          updates.refund_cheque_name = statusForm.refund_cheque_name;
          updates.refund_cheque_number = statusForm.refund_cheque_number;
        }
      }
      if (statusForm.status === "ready_for_delivery" || statusForm.status === "delivered") {
        updates.actual_completion = statusForm.actual_completion;
      }
      if (statusForm.status === "delivered") {
        updates.delivered_date = statusForm.delivered_date;
      }

      const oldValues = { status: repair.status, priority: repair.priority, estimated_cost: repair.estimated_cost, total_charge: repair.total_charge, payment_status: repair.payment_status };
      await base44.entities.Repair.update(repair.id, updates);
      try {
        let me = null;
        try { me = await base44.auth.me(); } catch {}
        await base44.entities.AuditTrail.create({
          action: "update",
          entity_type: "Repair",
          entity_id: repair.id,
          entity_name: repair.repair_number,
          user_id: me?.id || "",
          user_name: me?.full_name || me?.email || "",
          details: `Status changed to ${statusForm.status.replace(/_/g, " ")}`,
          old_values: oldValues,
          new_values: { status: updates.status, priority: updates.priority, estimated_cost: updates.estimated_cost, total_charge: updates.total_charge, payment_status: updates.payment_status }
        });
      } catch {}
      toast({ title: "Repair updated", description: `Status: ${statusForm.status.replace(/_/g, " ")}` });
      loadRepair();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this repair job?")) return;
    try {
      await base44.entities.Repair.update(repair.id, { status: "cancelled" });
      toast({ title: "Repair cancelled" });
      loadRepair();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this repair record?")) return;
    try {
      await base44.entities.Repair.delete(repair.id);
      toast({ title: "Repair deleted" });
      navigate("/repairs");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleTallySync = async () => {
    setSyncingTally(true);
    try {
      await base44.entities.Repair.update(repair.id, { tally_synced: true });
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      try {
        await base44.entities.AuditTrail.create({
          action: "sync",
          entity_type: "Repair",
          entity_id: repair.id,
          entity_name: repair.repair_number,
          user_id: me?.id || "",
          user_name: me?.full_name || me?.email || "",
          details: "Synced to Tally"
        });
      } catch {}
      toast({ title: "Synced to Tally", description: repair.repair_number });
      loadRepair();
    } catch (err) {
      toast({ title: "Tally sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncingTally(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const count = await base44.entities.Repair.count({});
      const newNumber = `RPR-${String(count + 1).padStart(5, "0")}`;
      const newRepair = await base44.entities.Repair.create({
        repair_number: newNumber,
        customer_id: repair.customer_id,
        customer_name: repair.customer_name,
        customer_phone: repair.customer_phone,
        customer_email: repair.customer_email,
        customer_address: repair.customer_address,
        is_other_product: repair.is_other_product,
        product_id: repair.product_id,
        product_name: repair.product_name,
        product_sku: repair.product_sku,
        product_barcode: repair.product_barcode,
        product_image: repair.product_image,
        store_id: repair.store_id,
        store_name: repair.store_name,
        issue_description: repair.issue_description,
        estimated_cost: 0,
        status: "received",
        priority: repair.priority || "medium",
        received_date: today,
        processed_by: repair.processed_by
      });
      toast({ title: "Similar repair created", description: newNumber });
      navigate(`/repairs/${newRepair.id}`);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const sendWhatsAppReceipt = (r) => {
    if (!r) return;
    if (!r.customer_phone) { toast({ title: "No customer phone number", variant: "destructive" }); return; }
    const techStr = r.technicians?.length > 0 ? r.technicians.map(t => `${t.name}${t.phone ? " (" + t.phone + ")" : ""}`).join(", ") : `${r.technician_name || "—"}${r.technician_phone ? " (" + r.technician_phone + ")" : ""}`;
    const msg = `*REPAIR RECEIPT*\nJob #: ${r.repair_number}\n\nCustomer: ${r.customer_name}\nProduct: ${r.product_name}\nIssue: ${r.issue_description || "—"}\n\nStore: ${r.store_name || "—"}\nTechnician: ${techStr}\n\nReceived: ${r.received_date ? format(new Date(r.received_date), "dd MMM yyyy") : "—"}\nEst. Completion: ${r.estimated_completion ? format(new Date(r.estimated_completion), "dd MMM yyyy") : "—"}\n\nEstimated Cost: ₹${(r.estimated_cost || 0).toLocaleString()}\nAdvance Paid: ₹${(r.advance_paid || 0).toLocaleString()}\nBalance Due: ₹${(r.balance_due || 0).toLocaleString()}\nPayment Method: ${(r.payment_method || "cash").toUpperCase()}\n\nThank you for choosing Subhlakshmi!`;
    const phone = r.customer_phone.replace(/[^0-9]/g, "");
    const waNumber = phone.length === 10 ? "91" + phone : phone;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loading) return <div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;
  if (!repair) return <div className="p-6"><p className="text-muted-foreground">Repair not found. <Link to="/repairs" className="text-primary underline">Back to Repairs</Link></p></div>;

  const isClosed = ["delivered", "cancelled", "rejected"].includes(repair.status);
  const totalCharge = (statusForm.labor_charge || 0) + (statusForm.parts_cost || 0);
  const isCancelled = statusForm.status === "cancelled" || statusForm.status === "rejected";
  const refundDue = isCancelled ? (statusForm.advance_paid || 0) : Math.max(0, (statusForm.advance_paid || 0) - totalCharge);

  const daysSinceReceived = repair.received_date ? differenceInCalendarDays(new Date(), new Date(repair.received_date)) : null;
  const isOverdue = !isClosed && repair.estimated_completion && differenceInCalendarDays(new Date(), new Date(repair.estimated_completion)) > 0;
  const overdueDays = isOverdue ? differenceInCalendarDays(new Date(), new Date(repair.estimated_completion)) : 0;
  const actualTotal = repair.total_charge || repair.actual_cost || 0;
  const costVariance = actualTotal - (repair.estimated_cost || 0);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link to="/repairs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Repairs
        </Link>
      </div>

      <PageHeader title={`Repair — ${repair.repair_number}`} description="View and manage this repair job">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setPrintType(repair.status === "delivered" ? "delivery" : "job"); setShowPrint(true); }}><Printer className="mr-2 h-4 w-4" /> Print Receipt</Button>
          <Button variant="outline" size="sm" onClick={() => sendWhatsAppReceipt(repair)} className="text-green-600"><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp</Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="mr-2 h-4 w-4" /> Create Similar</Button>
          <Button variant="outline" size="sm" onClick={handleTallySync} disabled={syncingTally} className={repair.tally_synced ? "text-emerald-600" : ""}>
            <Database className="mr-2 h-4 w-4" /> {repair.tally_synced ? "Tally Synced" : "Sync to Tally"}
          </Button>
          {!isClosed && <Button variant="outline" size="sm" onClick={handleCancel} className="text-amber-600"><AlertTriangle className="mr-2 h-4 w-4" /> Cancel Job</Button>}
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
        </div>
      </PageHeader>

      {/* Status Stepper */}
      <div className="mb-6">
        <RepairStatusStepper status={repair.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status banner with days/overdue */}
          <div className="rounded-xl border p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current Status</p>
              <StatusBadge status={repair.status} />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Payment Status</p>
              <StatusBadge status={repair.payment_status} />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Tally</p>
              {repair.tally_synced
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><Database className="h-3 w-3" /> Synced</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">Not Synced</span>}
            </div>
            {daysSinceReceived !== null && (
              <div className={`flex items-center gap-1.5 text-sm ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                <Clock className="h-4 w-4" />
                {isOverdue
                  ? <span className="font-medium">Overdue by {overdueDays} day{overdueDays !== 1 ? "s" : ""}</span>
                  : <span>{daysSinceReceived} day{daysSinceReceived !== 1 ? "s" : ""} since received</span>}
              </div>
            )}
          </div>

          {/* Customer & Product */}
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Customer & Product</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{repair.customer_name}</span></div>
              <div className="flex items-center gap-2">
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{repair.customer_phone}</span></div>
                {repair.customer_phone && (
                  <div className="flex gap-1">
                    <a href={`tel:${repair.customer_phone}`}><Button size="sm" variant="outline" className="h-7 px-2"><Phone className="h-3 w-3" /></Button></a>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-green-600" onClick={() => sendWhatsAppReceipt(repair)}><MessageCircle className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
              {repair.customer_email && <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{repair.customer_email}</span></div>}
              {repair.customer_address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium">{repair.customer_address}</span></div>}
              <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{repair.product_name}</span> {repair.is_other_product && <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Other Product</span>}</div>
              <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono text-xs">{repair.product_sku || "—"}</span></div>
              {repair.product_barcode && <div><span className="text-muted-foreground">Barcode:</span> <span className="font-mono text-xs">{repair.product_barcode}</span></div>}
              <div><span className="text-muted-foreground">Store:</span> <span>{repair.store_name || "—"}</span></div>
              <div><span className="text-muted-foreground">Priority:</span> <span className="capitalize">{repair.priority}</span></div>
              {repair.processed_by && <div><span className="text-muted-foreground">Received By:</span> <span>{repair.processed_by}</span></div>}
            </div>
            {repair.product_image && (
              <div className="flex justify-center pt-2"><img src={repair.product_image} alt="Product" className="w-32 h-32 object-cover rounded-md border" /></div>
            )}
          </div>

          {/* Issue & Notes */}
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Issue & Notes</h3>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-medium text-amber-900 mb-1">Issue Description</p>
              <p className="text-sm">{repair.issue_description}</p>
            </div>
            {repair.customer_notes && (
              <div className="text-sm"><span className="text-muted-foreground">Customer Notes:</span> {repair.customer_notes}</div>
            )}
            {repair.technician_notes && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-medium text-blue-900 mb-1">Technician Notes</p>
                <p className="text-sm">{repair.technician_notes}</p>
              </div>
            )}
            {repair.notes && <div className="text-sm"><span className="text-muted-foreground">Internal Notes:</span> {repair.notes}</div>}
          </div>

          {/* Warranty */}
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Warranty</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="warranty"
                checked={statusForm.warranty_claim}
                onCheckedChange={(v) => setStatusForm({ ...statusForm, warranty_claim: !!v })}
                disabled={isClosed}
              />
              <Label htmlFor="warranty" className="text-sm">Warranty claim</Label>
              {repair.warranty_claim && <StatusBadge status="warranty" label="Warranty" />}
            </div>
            <div>
              <Label>Warranty Reference / Original Invoice #</Label>
              <Input
                value={statusForm.warranty_reference}
                onChange={e => setStatusForm({ ...statusForm, warranty_reference: e.target.value })}
                placeholder="Original sale invoice number"
                disabled={isClosed}
              />
            </div>
          </div>

          {/* Repair Actions */}
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Repair Actions / Parts Used</h3>
            <RepairActionsEditor
              actions={statusForm.repair_actions}
              onChange={(a) => setStatusForm({ ...statusForm, repair_actions: a })}
              readOnly={isClosed}
            />
          </div>

          {/* Timeline & Technician */}
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Timeline & Technician</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Received:</span> <span>{repair.received_date ? format(new Date(repair.received_date), "dd MMM yyyy") : "—"}</span></div>
              <div><span className="text-muted-foreground">Est. Completion:</span> <span>{repair.estimated_completion ? format(new Date(repair.estimated_completion), "dd MMM yyyy") : "—"}</span></div>
              <div><span className="text-muted-foreground">Actual Completion:</span> <span>{repair.actual_completion ? format(new Date(repair.actual_completion), "dd MMM yyyy") : "—"}</span></div>
              <div><span className="text-muted-foreground">Delivered:</span> <span>{repair.delivered_date ? format(new Date(repair.delivered_date), "dd MMM yyyy") : "—"}</span></div>
            </div>
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Assigned Technician(s)</Label>
              <div className="mt-2">
                <RepairTechnicianEditor
                  technicians={statusForm.technicians}
                  onChange={(t) => setStatusForm({ ...statusForm, technicians: t })}
                  readOnly={isClosed}
                />
              </div>
            </div>
          </div>

          {/* Charges & Payment */}
          <div className="rounded-xl border p-4 space-y-2">
            <h3 className="text-sm font-semibold mb-2">Charges & Payment</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated Cost:</span><span>₹{(repair.estimated_cost || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Labor Charge:</span><span>₹{(repair.labor_charge || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Parts Cost:</span><span>₹{(repair.parts_cost || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Charge (Actual):</span><span className="font-bold">₹{actualTotal.toLocaleString()}</span></div>
              {repair.estimated_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variance (Actual − Est.):</span>
                  <span className={costVariance > 0 ? "font-medium text-red-600" : costVariance < 0 ? "font-medium text-emerald-600" : "font-medium"}>
                    {costVariance > 0 ? "+" : ""}₹{costVariance.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Advance Paid:</span><span className="text-emerald-600">₹{(repair.advance_paid || 0).toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-semibold">Balance Due:</span><span className="font-bold text-red-600">₹{(repair.balance_due || 0).toLocaleString()}</span></div>
              {repair.payment_method && <div className="flex justify-between"><span className="text-muted-foreground">Payment Method:</span><span className="font-medium capitalize">{repair.payment_method.replace(/_/g, " ")}</span></div>}
              {repair.payment_cheque_number && <div className="flex justify-between"><span className="text-muted-foreground">Payment Cheque #:</span><span className="font-mono text-xs">{repair.payment_cheque_number}</span></div>}
              {repair.refund_method && <div className="flex justify-between"><span className="text-muted-foreground">Refund Method:</span><span className="font-medium capitalize">{repair.refund_method.replace(/_/g, " ")}</span></div>}
              {repair.refund_cheque_number && <div className="flex justify-between"><span className="text-muted-foreground">Refund Cheque #:</span><span className="font-mono text-xs">{repair.refund_cheque_number}</span></div>}
            </div>
          </div>
        </div>

        {/* Right: Manage Status */}
        <div className="space-y-4">
          {!isClosed ? (
            <div className="rounded-xl border p-4 space-y-4 sticky top-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Wrench className="h-4 w-4" /> Manage Status</h3>
              <div>
                <Label>Status</Label>
                <Select value={statusForm.status} onValueChange={v => {
                  const today = format(new Date(), "yyyy-MM-dd");
                  setStatusForm(prev => ({
                    ...prev, status: v,
                    actual_completion: (v === "ready_for_delivery" || v === "delivered") && !prev.actual_completion ? today : prev.actual_completion,
                    delivered_date: v === "delivered" && !prev.delivered_date ? today : prev.delivered_date
                  }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FLOW.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(statusForm.status === "ready_for_delivery" || statusForm.status === "delivered") && (
                <div>
                  <Label>Actual Completion Date</Label>
                  <Input type="date" value={statusForm.actual_completion} onChange={e => setStatusForm({ ...statusForm, actual_completion: e.target.value })} />
                </div>
              )}
              {statusForm.status === "delivered" && (
                <div>
                  <Label>Delivered Date</Label>
                  <Input type="date" value={statusForm.delivered_date} onChange={e => setStatusForm({ ...statusForm, delivered_date: e.target.value })} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Labor (₹)</Label>
                  <Input type="number" min="0" value={statusForm.labor_charge} onChange={e => setStatusForm({ ...statusForm, labor_charge: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Parts (₹)</Label>
                  <Input type="number" min="0" value={statusForm.parts_cost} onChange={e => setStatusForm({ ...statusForm, parts_cost: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Advance (₹)</Label>
                  <Input type="number" min="0" value={statusForm.advance_paid} onChange={e => setStatusForm({ ...statusForm, advance_paid: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Total Charge</Label>
                  <div className="rounded-lg bg-muted/50 p-2 flex items-center h-9">
                    <span className="font-bold">₹{totalCharge.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment method at delivery */}
              {statusForm.status === "delivered" && (
                <div className="space-y-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-xs font-medium text-emerald-900">Collect Balance Payment</p>
                  <div>
                    <Label>Payment Method</Label>
                    <Select value={statusForm.payment_method} onValueChange={v => setStatusForm({ ...statusForm, payment_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="net_banking">Net Banking</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="wallet">Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {statusForm.payment_method === "cheque" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Cheque Name *</Label><Input value={statusForm.payment_cheque_name} onChange={e => setStatusForm({ ...statusForm, payment_cheque_name: e.target.value })} placeholder="Name on cheque" /></div>
                      <div><Label className="text-xs">Cheque # *</Label><Input value={statusForm.payment_cheque_number} onChange={e => setStatusForm({ ...statusForm, payment_cheque_number: e.target.value })} placeholder="Cheque no." /></div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={statusForm.priority} onValueChange={v => setStatusForm({ ...statusForm, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estimated Cost (₹)</Label>
                  <Input type="number" min="0" value={statusForm.estimated_cost} onChange={e => setStatusForm({ ...statusForm, estimated_cost: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label>Technician Notes</Label>
                <Textarea rows={3} value={statusForm.technician_notes} onChange={e => setStatusForm({ ...statusForm, technician_notes: e.target.value })} placeholder="Diagnosis, work done, parts used..." />
              </div>

              <div>
                <Label>Internal Notes</Label>
                <Textarea rows={2} value={statusForm.notes} onChange={e => setStatusForm({ ...statusForm, notes: e.target.value })} placeholder="Internal notes (not shown to customer)..." />
              </div>

              {refundDue > 0 && (
                <>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex justify-between">
                    <span>Refund Due:</span>
                    <span className="font-bold">₹{refundDue.toLocaleString()}</span>
                  </div>
                  <div>
                    <Label>Refund Method</Label>
                    <Select value={statusForm.refund_method} onValueChange={v => setStatusForm({ ...statusForm, refund_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="net_banking">Net Banking</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="wallet">Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {statusForm.refund_method === "cheque" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Cheque Name *</Label><Input value={statusForm.refund_cheque_name} onChange={e => setStatusForm({ ...statusForm, refund_cheque_name: e.target.value })} placeholder="Name on cheque" /></div>
                      <div><Label>Cheque # *</Label><Input value={statusForm.refund_cheque_number} onChange={e => setStatusForm({ ...statusForm, refund_cheque_number: e.target.value })} placeholder="Cheque no." /></div>
                    </div>
                  )}
                </>
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Balance Due:</span>
                <span className="font-bold text-red-600">₹{Math.max(0, totalCharge - (statusForm.advance_paid || 0)).toLocaleString()}</span>
              </div>

              <Button className="w-full" onClick={handleStatusUpdate} disabled={saving}>
                <Wrench className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Update Repair"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border p-4 text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">This repair is <span className="capitalize font-medium">{repair.status}</span>. No further status changes.</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="mt-6">
        <RepairActivityLog repairId={repair.id} />
      </div>

      {/* Audit Info */}
      <div className="mt-4 text-xs text-muted-foreground flex justify-between border-t pt-3">
        <span>Created: {repair.created_date ? format(new Date(repair.created_date), "dd MMM yyyy, HH:mm") : "—"}</span>
        <span>Last Updated: {repair.updated_date ? format(new Date(repair.updated_date), "dd MMM yyyy, HH:mm") : "—"}</span>
      </div>

      {/* Print Receipt */}
      {showPrint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPrint(false)}>
          <div className="bg-background rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-3 no-print">
              <div className="flex gap-1">
                <Button variant={printType === "job" ? "default" : "outline"} size="sm" onClick={() => setPrintType("job")}>Job Receipt</Button>
                <Button variant={printType === "delivery" ? "default" : "outline"} size="sm" onClick={() => setPrintType("delivery")}>Delivery Receipt</Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPrint(false)}><ArrowLeft className="mr-2 h-4 w-4" /> Close</Button>
            </div>
            {printType === "delivery" ? (
              <RepairDeliveryReceiptPrint repair={repair} store={store} />
            ) : (
              <RepairJobReceiptPrint repair={repair} store={store} onWhatsApp={() => sendWhatsAppReceipt(repair)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}