import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Wrench, Plus, Search, Eye, Trash2, CheckCircle, Clock, AlertTriangle, MessageCircle, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import StatCard from "@/components/erp/StatCard";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import CustomerSearchInput from "@/components/erp/CustomerSearchInput";
import VoiceTextInput from "@/components/erp/VoiceTextInput";
import RepairDeliveryReceiptPrint from "@/components/erp/RepairDeliveryReceiptPrint";
import RepairJobReceiptPrint from "@/components/erp/RepairJobReceiptPrint";

const STATUS_FLOW = ["received", "diagnosing", "in_progress", "awaiting_parts", "ready_for_delivery", "delivered"];

const INITIAL_REPAIR_FORM = {
  customer_id: "", customer_name: "", customer_phone: "",
  is_other_product: false,
  product_id: "", product_name: "", product_sku: "", product_barcode: "", product_image: "",
  store_id: "", store_name: "",
  issue_description: "", customer_notes: "",
  estimated_cost: 0, advance_paid: 0, payment_method: "cash",
  warranty_claim: false, warranty_reference: "",
  technician_name: "", technician_phone: "", technicians: [{ name: "", phone: "" }], received_date: "",
  estimated_completion: "", priority: "medium", notes: ""
};

export default function Repairs() {
  const navigate = useNavigate();
  const [repairs, setRepairs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateStatusRepair, setUpdateStatusRepair] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const { toast } = useToast();
  const { t } = useI18n();

  // Form state
  const [form, setForm] = useState({ ...INITIAL_REPAIR_FORM, received_date: format(new Date(), "yyyy-MM-dd") });
  const [createSnapshot, setCreateSnapshot] = useState(null);

  // Status update form
  const [statusForm, setStatusForm] = useState({
    status: "", technician_notes: "", actual_cost: 0, labor_charge: 0, parts_cost: 0, advance_paid: 0,
    refund_method: "cash", refund_cheque_name: "", refund_cheque_number: "",
    actual_completion: "", delivered_date: ""
  });
  const [statusSnapshot, setStatusSnapshot] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [createdRepair, setCreatedRepair] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [deliveredRepair, setDeliveredRepair] = useState(null);

  const createDirty = createSnapshot ? JSON.stringify(form) !== JSON.stringify(createSnapshot) : false;
  const statusDirty = statusSnapshot ? JSON.stringify(statusForm) !== JSON.stringify(statusSnapshot) : false;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [repairData, custData, storeData, prodData] = await Promise.all([
        base44.entities.Repair.list("-created_date", 200),
        base44.entities.Customer.list("-created_date", 200),
        base44.entities.Store.list("-created_date", 100),
        base44.entities.Product.list("-created_date", 200),
      ]);
      setRepairs(repairData || []);
      setCustomers(custData || []);
      setStores(storeData || []);
      setProducts((prodData || []).filter(p => p.status === "active" || p.status === "cataloged"));
    } catch (err) {
      console.error("Failed to load repairs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (c) => {
    setForm(f => ({ ...f, customer_id: c?.id || "", customer_name: c?.name || "", customer_phone: c?.phone || "" }));
  };

  const handleProductSelect = (id) => {
    const p = products.find(p => p.id === id);
    setForm(f => ({ ...f, product_id: id, product_name: p?.name || "", product_sku: p?.sku || "", product_barcode: p?.barcode || "" }));
  };

  const handleStoreSelect = (id) => {
    const s = stores.find(s => s.id === id);
    setForm(f => ({ ...f, store_id: id, store_name: s?.name || "" }));
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setForm(f => ({ ...f, product_image: file_url }));
      toast({ title: "Image uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setImageUploading(false);
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

  const handleCreate = async () => {
    if (!form.customer_name || !form.product_name || !form.issue_description) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    try {
      const user = await base44.auth.me().catch(() => null);
      const repairNumber = `REP-${Date.now().toString().slice(-8)}`;
      const balance = Math.max(0, (form.estimated_cost || 0) - (form.advance_paid || 0));
      const paymentStatus = form.advance_paid >= form.estimated_cost && form.estimated_cost > 0 ? "paid" : form.advance_paid > 0 ? "advance" : "unpaid";

      const cleanTechs = (form.technicians || []).filter(t => t.name?.trim());
      const primaryTech = cleanTechs[0] || {};

      const created = await base44.entities.Repair.create({
        ...form,
        technicians: cleanTechs,
        technician_name: primaryTech.name || "",
        technician_phone: primaryTech.phone || "",
        repair_number: repairNumber,
        balance_due: balance,
        payment_status: paymentStatus,
        status: "received",
        processed_by: user?.full_name || user?.email || "Unknown"
      });
      toast({ title: "Repair job created", description: `${repairNumber} — Est. ₹${(form.estimated_cost || 0).toLocaleString()}` });
      setNextStep({ key: "repair", path: `/repairs/${created.id}` });
      setCreateOpen(false);
      setCreatedRepair({ ...form, technicians: cleanTechs, technician_name: primaryTech.name || "", technician_phone: primaryTech.phone || "", repair_number: repairNumber, balance_due: balance, payment_status: paymentStatus, id: created.id });
      setForm({
        customer_id: "", customer_name: "", customer_phone: "",
        is_other_product: false,
        product_id: "", product_name: "", product_sku: "", product_barcode: "", product_image: "",
        store_id: "", store_name: "",
        issue_description: "", customer_notes: "",
        estimated_cost: 0, advance_paid: 0, payment_method: "cash",
        warranty_claim: false, warranty_reference: "",
        technician_name: "", technician_phone: "", technicians: [{ name: "", phone: "" }], received_date: format(new Date(), "yyyy-MM-dd"),
        estimated_completion: "", priority: "medium", notes: ""
      });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openStatusUpdate = (r) => {
    setUpdateStatusRepair(r);
    const today = format(new Date(), "yyyy-MM-dd");
    const init = {
      status: r.status, technician_notes: r.technician_notes || "",
      actual_cost: r.actual_cost || 0, labor_charge: r.labor_charge || 0,
      parts_cost: r.parts_cost || 0, advance_paid: r.advance_paid || 0,
      refund_method: r.payment_method || "cash", refund_cheque_name: "", refund_cheque_number: "",
      actual_completion: r.actual_completion || today,
      delivered_date: r.delivered_date || today
    };
    setStatusForm(init);
    setStatusSnapshot(init);
  };

  const handleStatusUpdate = async () => {
    if (!updateStatusRepair) return;
    try {
      const r = updateStatusRepair;
      const totalCharge = (statusForm.labor_charge || 0) + (statusForm.parts_cost || 0);
      const balance = Math.max(0, totalCharge - (statusForm.advance_paid || 0));
      const paymentStatus = statusForm.advance_paid >= totalCharge && totalCharge > 0 ? "paid" : statusForm.advance_paid > 0 ? "advance" : "unpaid";

      const isCancelled = statusForm.status === "cancelled" || statusForm.status === "rejected";
      const refundDue = isCancelled
        ? (statusForm.advance_paid || 0)
        : Math.max(0, (statusForm.advance_paid || 0) - totalCharge);

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
        refund_method: refundDue > 0 ? statusForm.refund_method : undefined,
        refund_cheque_name: refundDue > 0 && statusForm.refund_method === "cheque" ? statusForm.refund_cheque_name : undefined,
        refund_cheque_number: refundDue > 0 && statusForm.refund_method === "cheque" ? statusForm.refund_cheque_number : undefined
      };

      if (statusForm.status === "ready_for_delivery" || statusForm.status === "delivered") {
        updates.actual_completion = statusForm.actual_completion;
      }
      if (statusForm.status === "delivered") {
        updates.delivered_date = statusForm.delivered_date;
      }

      await base44.entities.Repair.update(r.id, updates);
      toast({ title: "Repair updated", description: `Status: ${statusForm.status.replace(/_/g, " ")}` });
      setUpdateStatusRepair(null);
      if (statusForm.status === "delivered") {
        setDeliveredRepair({ ...r, ...updates });
      }
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async (r) => {
    if (!confirm("Cancel this repair job?")) return;
    try {
      await base44.entities.Repair.update(r.id, { status: "cancelled" });
      toast({ title: "Repair cancelled" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this repair record?")) return;
    try {
      await base44.entities.Repair.delete(id);
      toast({ title: "Repair deleted" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = repairs.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
    if (searchQuery) {
      return fuzzyMatchAny(searchQuery, r.repair_number, r.customer_name, r.customer_phone, r.product_name);
    }
    return true;
  });

  const stats = {
    total: repairs.length,
    inProgress: repairs.filter(r => ["received", "diagnosing", "in_progress", "awaiting_parts"].includes(r.status)).length,
    ready: repairs.filter(r => r.status === "ready_for_delivery").length,
    overdue: repairs.filter(r => {
      if (["delivered", "cancelled", "rejected"].includes(r.status)) return false;
      return r.estimated_completion && new Date(r.estimated_completion) < new Date();
    }).length
  };

  const priorityColors = {
    low: "text-slate-600 bg-slate-100",
    medium: "text-blue-600 bg-blue-100",
    high: "text-amber-600 bg-amber-100",
    urgent: "text-red-600 bg-red-100"
  };

  if (loading) return <div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("rep.title")} description={t("rep.desc")}>
        <Button onClick={() => { const init = { ...INITIAL_REPAIR_FORM, received_date: format(new Date(), "yyyy-MM-dd") }; setForm(init); setCreateSnapshot(init); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Repair Job
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Jobs" value={stats.total} icon={Wrench} accent="blue" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} accent="amber" />
        <StatCard label="Ready for Delivery" value={stats.ready} icon={CheckCircle} accent="emerald" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} accent="red" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search repair #, customer, product..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="diagnosing">Diagnosing</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="awaiting_parts">Awaiting Parts</SelectItem>
            <SelectItem value="ready_for_delivery">Ready</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wrench} title={t("rep.no_repairs")} description={t("rep.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Est. Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Charge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const isOverdue = !["delivered", "cancelled", "rejected"].includes(r.status) && r.estimated_completion && new Date(r.estimated_completion) < new Date();
                return (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/repairs/${r.id}`)}>
                    <TableCell className="font-mono text-xs font-medium">{r.repair_number}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{r.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{r.customer_phone}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.product_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.issue_description}</TableCell>
                    <TableCell className="text-sm">{r.technician_name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      {r.estimated_completion ? format(new Date(r.estimated_completion), "dd MMM") : "—"}
                      {isOverdue && <span className="block text-[10px]">Overdue</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${priorityColors[r.priority] || priorityColors.medium}`}>{r.priority}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{(r.total_charge || r.estimated_cost || 0).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/repairs/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => sendWhatsAppReceipt(r)} className="text-green-600"><MessageCircle className="h-4 w-4" /></Button>
                        {!["delivered", "cancelled", "rejected"].includes(r.status) && (
                          <Button variant="ghost" size="icon" onClick={() => openStatusUpdate(r)} className="text-blue-600"><Wrench className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Repair Dialog */}
      <ConfirmCloseDialog open={createOpen} onOpenChange={setCreateOpen} isDirty={createDirty}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Repair Job</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Product Type Toggle */}
            <div className="flex gap-2 p-1 rounded-lg bg-muted/50">
              <button type="button" onClick={() => setForm(f => ({ ...f, is_other_product: false }))} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${!form.is_other_product ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Our Product</button>
              <button type="button" onClick={() => setForm(f => ({ ...f, is_other_product: true, product_id: "", product_sku: "", product_barcode: "" }))} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${form.is_other_product ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Other Product</button>
            </div>

            {form.is_other_product ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Name *</Label>
                    <Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value, customer_id: "" })} placeholder="Enter customer name" />
                  </div>
                  <div>
                    <Label>Customer Phone *</Label>
                    <Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="Enter phone number" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Product Name *</Label>
                    <Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} placeholder="What is the product?" />
                  </div>
                  <div>
                    <Label>Product Image</Label>
                    <div className="flex gap-2 h-9">
                      {form.product_image ? (
                        <div className="relative w-20 h-9">
                          <img src={form.product_image} alt="Product" className="w-full h-full object-cover rounded-md border" />
                          <button type="button" onClick={() => setForm({ ...form, product_image: "" })} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">×</button>
                        </div>
                      ) : (
                        <label className="flex-1 flex items-center justify-center gap-2 border border-dashed rounded-md cursor-pointer text-sm text-muted-foreground hover:bg-accent">
                          {imageUploading ? <span className="animate-pulse">Uploading...</span> : <><ImagePlus className="h-4 w-4" /> Upload Image</>}
                          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Search Customer (Name / Phone / Email / Invoice #) *</Label>
                  <CustomerSearchInput customers={customers} repairs={repairs} onSelect={handleCustomerSelect} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Name *</Label>
                    <Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value, customer_id: "" })} placeholder="Auto-filled or enter manually" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="Auto-filled from customer" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Product *</Label>
                    <Select value={form.product_id} onValueChange={handleProductSelect}>
                      <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Or Enter Product Name Manually</Label>
                    <Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value, product_id: "" })} placeholder="Product name" />
                  </div>
                </div>
              </>
            )}

            <div>
              <VoiceTextInput
                label="Issue Description *"
                value={form.issue_description}
                onChange={val => setForm({ ...form, issue_description: val })}
                placeholder="Describe the problem reported by customer — or tap the mic and speak"
                rows={2}
              />
            </div>

            <div>
              <Label>Customer Notes</Label>
              <Textarea rows={1} value={form.customer_notes} onChange={e => setForm({ ...form, customer_notes: e.target.value })} placeholder="Any specific requests or instructions" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Store</Label>
                <Select value={form.store_id} onValueChange={handleStoreSelect}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Technicians</Label>
                <Button size="sm" variant="outline" type="button" onClick={() => setForm(f => ({ ...f, technicians: [...f.technicians, { name: "", phone: "" }] }))}>
                  <Plus className="mr-1 h-3 w-3" /> Add Technician
                </Button>
              </div>
              <div className="space-y-2">
                {form.technicians.map((tech, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className="text-xs">Name</Label>
                      <Input value={tech.name} onChange={e => { const techs = [...form.technicians]; techs[idx] = { ...techs[idx], name: e.target.value }; setForm({ ...form, technicians: techs }); }} placeholder="Technician name" />
                    </div>
                    <div className="col-span-5">
                      <Label className="text-xs">Phone</Label>
                      <Input value={tech.phone} onChange={e => { const techs = [...form.technicians]; techs[idx] = { ...techs[idx], phone: e.target.value }; setForm({ ...form, technicians: techs }); }} placeholder="Phone number" />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {form.technicians.length > 1 && (
                        <Button size="icon" variant="ghost" type="button" onClick={() => setForm({ ...form, technicians: form.technicians.filter((_, i) => i !== idx) })}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Received Date</Label>
                <Input type="date" value={form.received_date} onChange={e => setForm({ ...form, received_date: e.target.value })} />
              </div>
              <div>
                <Label>Est. Completion</Label>
                <Input type="date" value={form.estimated_completion} onChange={e => setForm({ ...form, estimated_completion: e.target.value })} />
              </div>
              <div>
                <Label>Estimated Cost (₹)</Label>
                <Input type="number" min="0" value={form.estimated_cost} onChange={e => setForm({ ...form, estimated_cost: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Advance Paid (₹)</Label>
                <Input type="number" min="0" value={form.advance_paid} onChange={e => setForm({ ...form, advance_paid: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="net_banking">Net Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.estimated_cost > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Balance After Advance:</span>
                <span className="font-bold">₹{Math.max(0, form.estimated_cost - form.advance_paid).toLocaleString()}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}><Wrench className="mr-2 h-4 w-4" /> Create Repair Job</Button>
          </DialogFooter>
        </DialogContent>
      </ConfirmCloseDialog>

      {/* Update Status Dialog */}
      <ConfirmCloseDialog open={!!updateStatusRepair} onOpenChange={(open) => !open && setUpdateStatusRepair(null)} isDirty={statusDirty}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Update Repair — {updateStatusRepair?.repair_number}</DialogTitle></DialogHeader>
          {updateStatusRepair && (
            <div className="space-y-4">
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
                  <Label>Actual Completion Date <span className="text-xs text-muted-foreground">(auto: today)</span></Label>
                  <Input type="date" value={statusForm.actual_completion} onChange={e => setStatusForm({ ...statusForm, actual_completion: e.target.value })} />
                </div>
              )}
              {statusForm.status === "delivered" && (
                <div>
                  <Label>Delivered Date <span className="text-xs text-muted-foreground">(auto: today)</span></Label>
                  <Input type="date" value={statusForm.delivered_date} onChange={e => setStatusForm({ ...statusForm, delivered_date: e.target.value })} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Labor Charge (₹)</Label>
                  <Input type="number" min="0" value={statusForm.labor_charge} onChange={e => setStatusForm({ ...statusForm, labor_charge: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Parts Cost (₹)</Label>
                  <Input type="number" min="0" value={statusForm.parts_cost} onChange={e => setStatusForm({ ...statusForm, parts_cost: Number(e.target.value) })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Advance Paid (₹)</Label>
                  <Input type="number" min="0" value={statusForm.advance_paid} onChange={e => setStatusForm({ ...statusForm, advance_paid: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Total Charge</Label>
                  <div className="rounded-lg bg-muted/50 p-2 flex items-center h-9">
                    <span className="font-bold">₹{((statusForm.labor_charge || 0) + (statusForm.parts_cost || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {updateStatusRepair.payment_method && (updateStatusRepair.advance_paid > 0) && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  Advance paid via: <strong className="capitalize">{updateStatusRepair.payment_method.replace(/_/g, " ")}</strong> — ₹{(updateStatusRepair.advance_paid || 0).toLocaleString()}
                </div>
              )}

              <div>
                <Label>Technician Notes</Label>
                <Textarea rows={3} value={statusForm.technician_notes} onChange={e => setStatusForm({ ...statusForm, technician_notes: e.target.value })} placeholder="Diagnosis, work done, parts used..." />
              </div>

              {(() => {
                const totalCharge = (statusForm.labor_charge || 0) + (statusForm.parts_cost || 0);
                const isCancelled = statusForm.status === "cancelled" || statusForm.status === "rejected";
                const refundDue = isCancelled ? (statusForm.advance_paid || 0) : Math.max(0, (statusForm.advance_paid || 0) - totalCharge);
                if (refundDue <= 0) return null;
                return (
                  <>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex justify-between">
                      <span>Refund Due to Customer:</span>
                      <span className="font-bold">₹{refundDue.toLocaleString()}</span>
                    </div>
                    <div>
                      <Label>Refund Method {updateStatusRepair.payment_method && <span className="text-xs text-muted-foreground">(default: same as advance)</span>}</Label>
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
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Refund Cheque Name *</Label><Input value={statusForm.refund_cheque_name} onChange={e => setStatusForm({ ...statusForm, refund_cheque_name: e.target.value })} placeholder="Name on cheque" /></div>
                        <div><Label>Refund Cheque Number *</Label><Input value={statusForm.refund_cheque_number} onChange={e => setStatusForm({ ...statusForm, refund_cheque_number: e.target.value })} placeholder="Cheque no." /></div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="rounded-lg bg-muted/50 p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Balance Due:</span>
                <span className="font-bold text-red-600">₹{Math.max(0, (statusForm.labor_charge || 0) + (statusForm.parts_cost || 0) - (statusForm.advance_paid || 0)).toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusRepair(null)}>Cancel</Button>
            <Button onClick={handleStatusUpdate}><Wrench className="mr-2 h-4 w-4" /> Update Repair</Button>
          </DialogFooter>
        </DialogContent>
      </ConfirmCloseDialog>

      {/* Delivery Receipt Dialog */}
      <Dialog open={!!deliveredRepair} onOpenChange={(open) => !open && setDeliveredRepair(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print"><DialogTitle>Delivery Receipt — {deliveredRepair?.repair_number}</DialogTitle></DialogHeader>
          {deliveredRepair && (
            <RepairDeliveryReceiptPrint repair={deliveredRepair} store={stores.find(s => s.id === deliveredRepair.store_id)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Repair Job Receipt Dialog */}
      <Dialog open={!!createdRepair} onOpenChange={(open) => !open && setCreatedRepair(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="no-print"><DialogTitle>Repair Job Receipt — {createdRepair?.repair_number}</DialogTitle></DialogHeader>
          {createdRepair && (
            <RepairJobReceiptPrint repair={createdRepair} store={stores.find(s => s.id === createdRepair.store_id)} onWhatsApp={() => sendWhatsAppReceipt(createdRepair)} />
          )}
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}