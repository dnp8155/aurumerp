import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarClock, Plus, Search, Eye, X, Trash2, RotateCcw, Clock, AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import StatCard from "@/components/erp/StatCard";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import useFormDirty from "@/hooks/useFormDirty";
import { format } from "date-fns";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";
import RentalReceiptPrint from "@/components/erp/RentalReceiptPrint";
import RentalImageUpload from "@/components/erp/RentalImageUpload";
import RentalImageViewer from "@/components/erp/RentalImageViewer";

const RATE_UNITS = [
  { value: "per_day", label: "Per Day" },
  { value: "per_week", label: "Per Week" },
  { value: "per_month", label: "Per Month" },
  { value: "fixed", label: "Fixed" }
];

const toDatetimeLocal = (d) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd MMM yyyy, HH:mm"); } catch { return "—"; }
};

export default function Rentals() {
  const [rentals, setRentals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [nextStep, setNextStep] = useState(null);
  const [viewRental, setViewRental] = useState(null);
  const [printRental, setPrintRental] = useState(null);
  const [returnRental, setReturnRental] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const { t } = useI18n();

  // Form state
  const [form, setForm] = useState({
    customer_id: "", customer_name: "", customer_phone: "", customer_email: "", customer_address: "",
    store_id: "", store_name: "", rental_start_date: "", rental_end_date: "",
    notes: "", payment_method: "cash", payment_cheque_name: "", payment_cheque_number: "", handover_images: []
  });
  const [lineItems, setLineItems] = useState([]);
  const [returnForm, setReturnForm] = useState({ actual_return_date: "", late_fee: 0, damage_charge: 0, refund_method: "cash", refund_cheque_name: "", refund_cheque_number: "", notes: "", return_images: [] });
  const rentalDirty = useFormDirty(createOpen, { form, lineItems });
  const returnDirty = useFormDirty(!!returnRental, returnForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [rentalData, custData, storeData, prodData] = await Promise.all([
        base44.entities.Rental.list("-created_date", 200),
        base44.entities.Customer.list("-created_date", 200),
        base44.entities.Store.list("-created_date", 100),
        base44.entities.Product.list("-created_date", 200),
      ]);
      setRentals(rentalData || []);
      setCustomers(custData || []);
      setStores(storeData || []);
      setProducts((prodData || []).filter(p => p.status === "active" || p.status === "cataloged"));
    } catch (err) {
      console.error("Failed to load rentals", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (id) => {
    const c = customers.find(c => c.id === id);
    setForm(f => ({
      ...f,
      customer_id: id,
      customer_name: c?.name || "",
      customer_phone: c?.phone || "",
      customer_address: c?.address_line1 ? `${c.address_line1} ${c.address_area || ""} ${c.city || ""}`.trim() : ""
    }));
  };

  const handleStoreSelect = (id) => {
    const s = stores.find(s => s.id === id);
    setForm(f => ({ ...f, store_id: id, store_name: s?.name || "" }));
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { product_id: "", sku: "", product_name: "", quantity: 1, rental_rate: 0, rate_unit: "per_day", security_deposit: 0 }]);
  };

  const updateLineItem = (idx, field, value) => {
    setLineItems(items => items.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === "product_id") {
        const p = products.find(p => p.id === value);
        updated.product_name = p?.name || "";
        updated.sku = p?.sku || "";
      }
      return updated;
    }));
  };

  const removeLineItem = (idx) => setLineItems(items => items.filter((_, i) => i !== idx));

  const duration = form.rental_start_date && form.rental_end_date
    ? Math.max(1, Math.ceil((new Date(form.rental_end_date) - new Date(form.rental_start_date)) / (1000 * 60 * 60 * 24)))
    : 0;

  const lineCharge = (it) => {
    if (it.rate_unit === "fixed") return it.rental_rate * it.quantity;
    if (it.rate_unit === "per_day") return it.rental_rate * duration * it.quantity;
    if (it.rate_unit === "per_week") return it.rental_rate * (duration / 7) * it.quantity;
    if (it.rate_unit === "per_month") return it.rental_rate * (duration / 30) * it.quantity;
    return 0;
  };

  const totalRental = lineItems.reduce((s, it) => s + lineCharge(it), 0);
  const totalDeposit = lineItems.reduce((s, it) => s + (it.security_deposit || 0) * it.quantity, 0);

  const handleCreate = async () => {
    if (!form.customer_name || !form.customer_phone || !form.store_id || !form.rental_start_date || !form.rental_end_date) {
      toast({ title: "Customer name, phone and all required fields are mandatory", variant: "destructive" }); return;
    }
    if (lineItems.length === 0 || lineItems.some(i => !i.product_id)) {
      toast({ title: "Add at least one rental item", variant: "destructive" }); return;
    }
    if (form.payment_method === "cheque" && (!form.payment_cheque_name || !form.payment_cheque_number)) {
      toast({ title: "Enter cheque name and number", variant: "destructive" }); return;
    }
    try {
      const user = await base44.auth.me().catch(() => null);
      const rentalNumber = `RNT-${Date.now().toString().slice(-8)}`;
      await base44.entities.Rental.create({
        ...form,
        rental_number: rentalNumber,
        items: lineItems.map(it => ({
          ...it,
          rental_charge: lineCharge(it)
        })),
        rental_duration: duration,
        total_rental_charge: totalRental,
        security_deposit: totalDeposit,
        total_payable: totalRental + totalDeposit,
        status: "active",
        payment_status: "pending",
        processed_by: user?.full_name || user?.email || "Unknown"
      });
      toast({ title: "Rental created", description: `${rentalNumber} — ₹${(totalRental + totalDeposit).toLocaleString()}` });
      setNextStep({ key: "rental" });
      setCreateOpen(false);
      setForm({ customer_id: "", customer_name: "", customer_phone: "", customer_email: "", customer_address: "", store_id: "", store_name: "", rental_start_date: "", rental_end_date: "", notes: "", payment_method: "cash", payment_cheque_name: "", payment_cheque_number: "", handover_images: [] });
      setLineItems([]);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReturn = async () => {
    if (!returnRental || !returnForm.actual_return_date) { toast({ title: "Select return date", variant: "destructive" }); return; }
    try {
      const plannedEnd = new Date(returnRental.rental_end_date);
      const actualReturn = new Date(returnForm.actual_return_date);
      const isLate = actualReturn > plannedEnd;
      const lateDays = isLate ? Math.ceil((actualReturn - plannedEnd) / (1000 * 60 * 60 * 24)) : 0;

      const totalPayable = (returnRental.total_rental_charge || 0) + (returnForm.late_fee || 0) + (returnForm.damage_charge || 0);
      const refundAmount = (returnRental.security_deposit || 0) - (returnForm.damage_charge || 0);

      await base44.entities.Rental.update(returnRental.id, {
        actual_return_date: returnForm.actual_return_date,
        late_fee: returnForm.late_fee || 0,
        damage_charge: returnForm.damage_charge || 0,
        total_payable: totalPayable,
        status: "returned",
        payment_status: refundAmount > 0 ? "refunded" : "paid",
        refund_method: returnForm.refund_method,
        refund_cheque_name: returnForm.refund_method === "cheque" ? returnForm.refund_cheque_name : undefined,
        refund_cheque_number: returnForm.refund_method === "cheque" ? returnForm.refund_cheque_number : undefined,
        return_images: returnForm.return_images,
        notes: returnForm.notes ? `${returnRental.notes || ""}\n[Return] ${returnForm.notes}`.trim() : returnRental.notes
      });

      toast({
        title: "Rental returned",
        description: isLate ? `Late by ${lateDays} days — Late fee ₹${returnForm.late_fee}` : "Returned on time"
      });
      setReturnRental(null);
      setReturnForm({ actual_return_date: "", late_fee: 0, damage_charge: 0, refund_method: "cash", refund_cheque_name: "", refund_cheque_number: "", notes: "", return_images: [] });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async (r) => {
    if (!confirm("Cancel this rental?")) return;
    try {
      await base44.entities.Rental.update(r.id, { status: "cancelled" });
      toast({ title: "Rental cancelled" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this rental record?")) return;
    try {
      await base44.entities.Rental.delete(id);
      toast({ title: "Rental deleted" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Check overdue
  const today = new Date();
  const updatedRentals = rentals.map(r => {
    if (r.status === "active" && r.rental_end_date && new Date(r.rental_end_date) < today) {
      return { ...r, status: "overdue" };
    }
    return r;
  });

  const filtered = updatedRentals.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchQuery) {
      return fuzzyMatchAny(searchQuery, r.rental_number, r.customer_name, r.customer_phone);
    }
    return true;
  });

  const stats = {
    total: rentals.length,
    active: updatedRentals.filter(r => r.status === "active").length,
    overdue: updatedRentals.filter(r => r.status === "overdue").length,
    returned: updatedRentals.filter(r => r.status === "returned").length
  };

  if (loading) return <div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("rent.title")} description={t("rent.desc")}>
        <Button onClick={() => {
          const now = new Date();
          const endDefault = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          setForm(f => ({ ...f, rental_start_date: toDatetimeLocal(now), rental_end_date: toDatetimeLocal(endDefault) }));
          setCreateOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> New Rental
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Rentals" value={stats.total} icon={CalendarClock} accent="blue" />
        <StatCard label="Active" value={stats.active} icon={Clock} accent="emerald" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} accent="amber" />
        <StatCard label="Returned" value={stats.returned} icon={RotateCcw} accent="violet" />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search rental #, customer, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("rent.no_rentals")} description={t("rent.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rental #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Rental</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-medium">{r.rental_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{r.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer_phone}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.store_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{r.rental_start_date ? formatDateTime(r.rental_start_date) : "—"}</div>
                    <div className="text-[10px]">→ {r.rental_end_date ? formatDateTime(r.rental_end_date) : "—"}</div>
                  </TableCell>
                  <TableCell className="text-right text-sm">{r.rental_duration || 0}</TableCell>
                  <TableCell className="text-right text-sm font-medium">₹{(r.total_rental_charge || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{(r.security_deposit || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewRental(r)}><Eye className="h-4 w-4" /></Button>
                      {(r.status === "active" || r.status === "overdue") && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => { setReturnRental(r); setReturnForm({ actual_return_date: toDatetimeLocal(new Date()), late_fee: 0, damage_charge: 0, refund_method: r.payment_method || "cash", refund_cheque_name: "", refund_cheque_number: "", notes: "", return_images: [] }); }} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"><RotateCcw className="mr-1 h-3.5 w-3.5" /> Return</Button>
                          <Button variant="ghost" size="icon" onClick={() => handleCancel(r)} className="text-red-600"><X className="h-4 w-4" /></Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Rental Dialog */}
      <ConfirmCloseDialog open={createOpen} onOpenChange={setCreateOpen} isDirty={rentalDirty}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Rental Agreement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name *</Label>
                <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Enter customer name" />
              </div>
              <div>
                <Label>Phone Number *</Label>
                <Input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="Enter phone number" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="Enter email (optional)" />
              </div>
              <div>
                <Label>Store *</Label>
                <Select value={form.store_id} onValueChange={handleStoreSelect}>
                  <SelectTrigger><SelectValue placeholder="Select store..." /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={form.customer_address} onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))} placeholder="Enter address (optional)" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date & Time *</Label>
                <Input type="datetime-local" value={form.rental_start_date} onChange={e => setForm({ ...form, rental_start_date: e.target.value })} />
              </div>
              <div>
                <Label>End Date & Time *</Label>
                <Input type="datetime-local" value={form.rental_end_date} onChange={e => setForm({ ...form, rental_end_date: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Rental Duration:</span>
              <span className="font-bold text-primary text-base">{duration} {duration === 1 ? "day" : "days"}</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Rental Items</Label>
                <Button size="sm" variant="outline" onClick={addLineItem}><Plus className="mr-1 h-3 w-3" /> Add Item</Button>
              </div>
              {lineItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No items added</div>
              ) : (
                <div className="space-y-2">
                  {lineItems.map((it, idx) => (
                    <div key={idx} className="rounded-lg border p-3 grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Label className="text-xs">Product</Label>
                        <Select value={it.product_id} onValueChange={v => updateLineItem(idx, "product_id", v)}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min="1" value={it.quantity} onChange={e => updateLineItem(idx, "quantity", Number(e.target.value))} className="h-8" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Rate</Label>
                        <Input type="number" min="0" value={it.rental_rate} onChange={e => updateLineItem(idx, "rental_rate", Number(e.target.value))} className="h-8" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Unit</Label>
                        <Select value={it.rate_unit} onValueChange={v => updateLineItem(idx, "rate_unit", v)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RATE_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Deposit</Label>
                        <Input type="number" min="0" value={it.security_deposit} onChange={e => updateLineItem(idx, "security_deposit", Number(e.target.value))} className="h-8" />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">₹{lineCharge(it).toLocaleString()}</Label>
                        <Button size="icon" variant="ghost" onClick={() => removeLineItem(idx)}><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <RentalImageUpload
              images={form.handover_images}
              onChange={(imgs) => setForm(f => ({ ...f, handover_images: imgs }))}
              label="Product Condition Photos (At Handover)"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Method (Advance/Deposit)</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
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
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>
            </div>

            {form.payment_method === "cheque" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cheque Name *</Label>
                  <Input value={form.payment_cheque_name} onChange={e => setForm({ ...form, payment_cheque_name: e.target.value })} placeholder="Name on cheque" />
                </div>
                <div>
                  <Label>Cheque Number *</Label>
                  <Input value={form.payment_cheque_number} onChange={e => setForm({ ...form, payment_cheque_number: e.target.value })} placeholder="Cheque number" />
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Rental Charge:</span><span className="font-medium">₹{totalRental.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Security Deposit:</span><span className="font-medium">₹{totalDeposit.toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-semibold">Total Payable:</span><span className="font-bold text-lg">₹{(totalRental + totalDeposit).toLocaleString()}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}><CalendarClock className="mr-2 h-4 w-4" /> Create Rental</Button>
          </DialogFooter>
        </DialogContent>
      </ConfirmCloseDialog>

      {/* View Rental Dialog */}
      <Dialog open={!!viewRental} onOpenChange={(open) => !open && setViewRental(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Rental Details — {viewRental?.rental_number}</DialogTitle></DialogHeader>
          {viewRental && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setPrintRental(viewRental)}><Printer className="mr-2 h-4 w-4" /> Print Receipt</Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{viewRental.customer_name}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{viewRental.customer_phone}</span></div>
                <div><span className="text-muted-foreground">Store:</span> <span className="font-medium">{viewRental.store_name}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewRental.status} /></div>
                <div><span className="text-muted-foreground">Start:</span> <span className="font-medium">{formatDateTime(viewRental.rental_start_date)}</span></div>
                <div><span className="text-muted-foreground">End:</span> <span className="font-medium">{formatDateTime(viewRental.rental_end_date)}</span></div>
                <div><span className="text-muted-foreground">Duration:</span> <span className="font-medium">{viewRental.rental_duration} days</span></div>
                <div><span className="text-muted-foreground">Actual Return:</span> <span className="font-medium">{formatDateTime(viewRental.actual_return_date)}</span></div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Rental Items</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Charge</TableHead>
                        <TableHead className="text-right">Deposit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewRental.items || []).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm">₹{(item.rental_rate || 0).toLocaleString()} <span className="text-xs text-muted-foreground">{item.rate_unit?.replace("_", " ")}</span></TableCell>
                          <TableCell className="text-right text-sm font-medium">₹{(item.rental_charge || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm">₹{(item.security_deposit || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                {viewRental.payment_method && <div className="flex justify-between"><span className="text-muted-foreground">Deposit Paid Via:</span><span className="font-medium capitalize">{viewRental.payment_method.replace(/_/g, " ")}</span></div>}
                {viewRental.payment_cheque_name && <div className="flex justify-between"><span className="text-muted-foreground">Cheque Name:</span><span className="font-medium">{viewRental.payment_cheque_name}</span></div>}
                {viewRental.payment_cheque_number && <div className="flex justify-between"><span className="text-muted-foreground">Cheque #:</span><span className="font-mono text-xs">{viewRental.payment_cheque_number}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Rental Charge:</span><span>₹{(viewRental.total_rental_charge || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Security Deposit:</span><span>₹{(viewRental.security_deposit || 0).toLocaleString()}</span></div>
                {viewRental.late_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Late Fee:</span><span className="text-amber-600">₹{viewRental.late_fee.toLocaleString()}</span></div>}
                {viewRental.damage_charge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Damage Charge:</span><span className="text-red-600">₹{viewRental.damage_charge.toLocaleString()}</span></div>}
                {viewRental.refund_method && <div className="flex justify-between"><span className="text-muted-foreground">Deposit Refund Method:</span><span className="font-medium capitalize">{viewRental.refund_method.replace(/_/g, " ")}</span></div>}
                {viewRental.refund_cheque_number && <div className="flex justify-between"><span className="text-muted-foreground">Refund Cheque #:</span><span className="font-mono text-xs">{viewRental.refund_cheque_number}</span></div>}
                <div className="flex justify-between border-t pt-1"><span className="font-semibold">Total Payable:</span><span className="font-bold text-lg">₹{(viewRental.total_payable || 0).toLocaleString()}</span></div>
              </div>

              {viewRental.handover_images?.length > 0 && (
                <RentalImageViewer images={viewRental.handover_images} label="📋 Handover Photos (Original Condition)" />
              )}
              {viewRental.return_images?.length > 0 && (
                <RentalImageViewer images={viewRental.return_images} label="↩ Return Photos (Condition at Return)" />
              )}

              {viewRental.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {viewRental.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Rental Receipt Dialog */}
      <Dialog open={!!printRental} onOpenChange={(open) => !open && setPrintRental(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-4 no-print">
            <DialogTitle>Rental Receipt — {printRental?.rental_number}</DialogTitle>
          </DialogHeader>
          {printRental && (
            <RentalReceiptPrint rental={printRental} store={stores.find(s => s.id === printRental.store_id)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Return Rental Dialog */}
      <ConfirmCloseDialog open={!!returnRental} onOpenChange={(open) => !open && setReturnRental(null)} isDirty={returnDirty}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Process Return — {returnRental?.rental_number}</DialogTitle></DialogHeader>
          {returnRental && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span><span className="font-medium">{returnRental.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Planned End:</span><span>{formatDateTime(returnRental.rental_end_date)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rental Charge:</span><span>₹{(returnRental.total_rental_charge || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deposit:</span><span>₹{(returnRental.security_deposit || 0).toLocaleString()}</span></div>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm">
                <div className="font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Advance / Deposit Payment Details</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-amber-800">
                  <div><span className="text-muted-foreground">Amount:</span> <strong>₹{(returnRental.security_deposit || 0).toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Method:</span> <strong className="capitalize">{returnRental.payment_method ? returnRental.payment_method.replace(/_/g, " ") : "—"}</strong></div>
                  {returnRental.payment_cheque_name && <div><span className="text-muted-foreground">Cheque Name:</span> {returnRental.payment_cheque_name}</div>}
                  {returnRental.payment_cheque_number && <div><span className="text-muted-foreground">Cheque #:</span> <span className="font-mono text-xs">{returnRental.payment_cheque_number}</span></div>}
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200 text-xs text-amber-700">
                  Refund will be processed via: <strong className="capitalize">{returnForm.refund_method?.replace(/_/g, " ")}</strong> (change below if needed)
                </div>
              </div>

              <div>
                <Label>Actual Return Date & Time *</Label>
                <Input type="datetime-local" value={returnForm.actual_return_date} onChange={e => setReturnForm({ ...returnForm, actual_return_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Late Fee (₹)</Label>
                  <Input type="number" min="0" value={returnForm.late_fee} onChange={e => setReturnForm({ ...returnForm, late_fee: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Damage Charge (₹)</Label>
                  <Input type="number" min="0" value={returnForm.damage_charge} onChange={e => setReturnForm({ ...returnForm, damage_charge: Number(e.target.value) })} />
                </div>
              </div>
              {returnRental.handover_images?.length > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <RentalImageViewer images={returnRental.handover_images} label="📋 Handover Photos (Original Condition)" />
                </div>
              )}

              <RentalImageUpload
                images={returnForm.return_images}
                onChange={(imgs) => setReturnForm(f => ({ ...returnForm, return_images: imgs }))}
                label="Return Condition Photos"
              />

              <div>
                <Label>Return Notes</Label>
                <Textarea rows={2} value={returnForm.notes} onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })} placeholder="Condition notes, missing items, etc." />
              </div>

              <div>
                <Label>Deposit Refund Method {returnRental.payment_method && <span className="text-xs text-muted-foreground">(default: same as deposit)</span>}</Label>
                <Select value={returnForm.refund_method} onValueChange={v => setReturnForm({ ...returnForm, refund_method: v })}>
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

              {returnForm.refund_method === "cheque" && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Refund Cheque Name *</Label><Input value={returnForm.refund_cheque_name} onChange={e => setReturnForm({ ...returnForm, refund_cheque_name: e.target.value })} placeholder="Name on cheque" /></div>
                  <div><Label>Refund Cheque Number *</Label><Input value={returnForm.refund_cheque_number} onChange={e => setReturnForm({ ...returnForm, refund_cheque_number: e.target.value })} placeholder="Cheque no." /></div>
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Rental + Late + Damage:</span><span>₹{((returnRental.total_rental_charge || 0) + (returnForm.late_fee || 0) + (returnForm.damage_charge || 0)).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deposit Refund:</span><span className="text-emerald-600">₹{Math.max(0, (returnRental.security_deposit || 0) - (returnForm.damage_charge || 0)).toLocaleString()}</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnRental(null)}>Cancel</Button>
            <Button onClick={handleReturn}><RotateCcw className="mr-2 h-4 w-4" /> Process Return</Button>
          </DialogFooter>
        </DialogContent>
      </ConfirmCloseDialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}