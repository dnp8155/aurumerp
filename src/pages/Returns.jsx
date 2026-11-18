import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RotateCcw, Search, Eye, Check, X, Plus, RefreshCw, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PAYMENT_LABELS = {
  cash: "Cash", upi: "UPI", cheque: "Cheque", card: "Card",
  net_banking: "Net Banking", wallet: "Wallet",
  partial: "Partial", pending: "Pending", advanced: "Advance", bank_transfer: "Bank Transfer"
};

const mapSaleToRefundMethod = (pm) => ({
  cash: "cash", upi: "upi", cheque: "cheque", card: "card",
  net_banking: "bank_transfer", wallet: "upi",
  partial: "cash", pending: "cash", advanced: "cash"
}[pm] || "cash");

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [sales, setSales] = useState([]);
  const [stores, setStores] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [chequeName, setChequeName] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [nextStep, setNextStep] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [saleSearchQuery, setSaleSearchQuery] = useState("");
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [retData, saleData, storeData, invData] = await Promise.all([
        base44.entities.Return.list("-created_date", 200),
        base44.entities.Sale.list("-created_date", 200),
        base44.entities.Store.list("-created_date", 100),
        base44.entities.Inventory.list("-created_date", 200),
      ]);
      setReturns(retData || []);
      setSales((saleData || []).filter(s => s.status === "completed" || s.status === "partial_return" || s.status === "returned"));
      setStores(storeData || []);
      setInventory(invData || []);
    } catch (err) {
      console.error("Failed to load returns", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSale = (saleId) => {
    const sale = sales.find(s => s.id === saleId);
    setSelectedSale(sale);
    const init = {};
    (sale?.items || []).forEach(i => { init[i.product_id] = 0; });
    setReturnQtys(init);
    setReturnReason("");
    setRefundMethod(mapSaleToRefundMethod(sale?.payment_method));
    setChequeName(sale?.cheque_name || "");
    setChequeNumber(sale?.cheque_number || "");
  };

  const returnItems = selectedSale
    ? (selectedSale.items || []).map(item => ({
        ...item,
        return_quantity: returnQtys[item.product_id] || 0,
        refund_amount: (returnQtys[item.product_id] || 0) * (item.unit_price || 0)
      })).filter(i => i.return_quantity > 0)
    : [];

  const totalRefund = returnItems.reduce((s, i) => s + i.refund_amount, 0);
  const createDirty = !!selectedSale || !!returnReason || refundMethod !== "cash" || Object.values(returnQtys).some(v => v > 0) || !!chequeName || !!chequeNumber;

  const handleCreate = async () => {
    if (!selectedSale) { toast({ title: "Select a sale", variant: "destructive" }); return; }
    if (returnItems.length === 0) { toast({ title: "Select items to return", variant: "destructive" }); return; }
    try {
      const user = await base44.auth.me().catch(() => null);
      const returnNumber = `RET-${Date.now().toString().slice(-8)}`;
      const isFullReturn = returnItems.length === (selectedSale.items || []).length &&
        returnItems.every(ri => ri.return_quantity === ri.quantity);

      // Generate credit note number for credit_note / adjust_new_bill refund methods
      const needsCreditNote = refundMethod === "credit_note" || refundMethod === "adjust_new_bill";
      const creditNoteNumber = needsCreditNote ? `CN-${Date.now().toString().slice(-8)}` : undefined;

      const ret = await base44.entities.Return.create({
        return_number: returnNumber,
        original_sale_id: selectedSale.id,
        original_sale_number: selectedSale.sale_number,
        original_purchase_date: selectedSale.sale_date,
        store_id: selectedSale.store_id,
        store_name: selectedSale.store_name,
        customer_name: selectedSale.customer_name,
        customer_phone: selectedSale.customer_phone,
        items: returnItems.map(i => ({
          product_id: i.product_id, sku: i.sku, product_name: i.product_name,
          original_quantity: i.quantity, return_quantity: i.return_quantity,
          unit_price: i.unit_price, refund_amount: i.refund_amount
        })),
        total_refund: totalRefund,
        return_type: isFullReturn ? "full" : "partial",
        return_reason: returnReason,
        return_date: new Date().toISOString(),
        status: "completed",
        approved_by: user?.full_name || user?.email || "Auto-approved",
        approved_date: new Date().toISOString(),
        processed_by: user?.full_name || user?.email || "Unknown",
        refund_method: refundMethod,
        cheque_name: refundMethod === "cheque" ? chequeName : undefined,
        cheque_number: refundMethod === "cheque" ? chequeNumber : undefined,
        credit_note_number: creditNoteNumber,
      });

      // Create CreditNote record for future redemption tracking
      if (needsCreditNote) {
        const creditNote = await base44.entities.CreditNote.create({
          credit_note_number: creditNoteNumber,
          return_id: ret.id,
          return_number: returnNumber,
          original_sale_number: selectedSale.sale_number,
          customer_name: selectedSale.customer_name,
          customer_phone: selectedSale.customer_phone,
          store_id: selectedSale.store_id,
          store_name: selectedSale.store_name,
          original_amount: totalRefund,
          used_amount: 0,
          balance_amount: totalRefund,
          adjustment_type: refundMethod === "adjust_new_bill" ? "adjust_new_bill" : "credit_note",
          issue_date: new Date().toISOString(),
          status: "active",
        });
        // Link credit note back to return
        await base44.entities.Return.update(ret.id, { credit_note_id: creditNote.id });
      }

      // Restock inventory
      for (const item of returnItems) {
        const inv = inventory.find(i => i.product_id === item.product_id && i.store_id === selectedSale.store_id);
        if (inv) {
          await base44.entities.Inventory.update(inv.id, {
            quantity: (inv.quantity || 0) + item.return_quantity
          });
        }
      }

      // Update sale status
      await base44.entities.Sale.update(selectedSale.id, {
        status: isFullReturn ? "returned" : "partial_return",
        return_items: returnItems.map(i => ({
          product_id: i.product_id, sku: i.sku, product_name: i.product_name,
          quantity: i.return_quantity, refund_amount: i.refund_amount
        })),
        return_reason: returnReason,
        payment_status: "refunded"
      });

      await base44.entities.Return.update(ret.id, { inventory_restocked: true });

      const successMsg = needsCreditNote
        ? `${returnNumber} — Refund ₹${totalRefund.toLocaleString()} — Credit Note: ${creditNoteNumber}`
        : `${returnNumber} — Refund ₹${totalRefund.toLocaleString()}`;
      toast({ title: "Return created", description: successMsg });
      setNextStep({ key: "return" });
      setCreateOpen(false);
      setSelectedSale(null);
      setReturnQtys({});
      setReturnReason("");
      setRefundMethod("cash");
      setChequeName("");
      setChequeNumber("");
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async (ret) => {
    try {
      const user = await base44.auth.me().catch(() => null);
      await base44.entities.Return.update(ret.id, {
        status: "approved",
        approved_by: user?.full_name || user?.email || "Admin",
        approved_date: new Date().toISOString()
      });
      toast({ title: "Return approved" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleComplete = async (ret) => {
    try {
      await base44.entities.Return.update(ret.id, { status: "completed" });
      toast({ title: "Return completed", description: "Refund processed" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (ret) => {
    try {
      await base44.entities.Return.update(ret.id, { status: "rejected" });
      toast({ title: "Return rejected" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this return record?")) return;
    try {
      await base44.entities.Return.delete(id);
      toast({ title: "Return deleted" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = returns.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchQuery) {
      return fuzzyMatchAny(searchQuery, r.return_number, r.original_sale_number, r.customer_name, r.customer_phone);
    }
    return true;
  });

  const stats = {
    total: returns.length,
    completed: returns.filter(r => r.status === "completed").length,
    full: returns.filter(r => r.return_type === "full").length,
    totalRefund: returns.filter(r => r.status === "completed").reduce((s, r) => s + (r.total_refund || 0), 0)
  };

  const filteredSales = sales.filter(s => {
    if (!saleSearchQuery) return true;
    return fuzzyMatchAny(saleSearchQuery, s.sale_number, s.customer_name, s.customer_phone, s.customer_email);
  });

  if (loading) return <div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("ret.title")} description={t("ret.desc")}>
        <Button onClick={() => { setCreateOpen(true); setSelectedSale(null); }}>
          <Plus className="mr-2 h-4 w-4" /> New Return
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Returns" value={stats.total} icon={RotateCcw} accent="blue" />
        <StatCard label="Completed" value={stats.completed} icon={Check} accent="emerald" />
        <StatCard label="Full Returns" value={stats.full} icon={FileText} accent="amber" />
        <StatCard label="Total Refunded" value={`₹${stats.totalRefund.toLocaleString()}`} icon={RefreshCw} accent="red" />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, mobile, invoice #..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={RotateCcw} title={t("ret.no_returns")} description={t("ret.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Original Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-medium">{r.return_number}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs text-muted-foreground">{r.original_sale_number || "—"}</div>
                    <div className="text-[10px] text-muted-foreground/70">{r.original_purchase_date ? format(new Date(r.original_purchase_date), "dd MMM yyyy") : "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{r.customer_name || "—"}</div>
                    {r.customer_phone && <div className="text-[10px] text-muted-foreground">{r.customer_phone}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.store_name || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${r.return_type === "full" ? "text-red-600" : "text-amber-600"}`}>
                      {r.return_type === "full" ? "Full" : "Partial"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">₹{(r.total_refund || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">
                    <div className="capitalize">{(r.refund_method || "cash").replace(/_/g, " ")}</div>
                    {r.credit_note_number && <div className="font-mono text-[10px] text-indigo-600">{r.credit_note_number}</div>}
                    {r.cheque_number && <div className="font-mono text-[10px] text-muted-foreground">CHQ: {r.cheque_number}</div>}
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.return_date ? format(new Date(r.return_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewReturn(r)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Return Dialog */}
      <ConfirmCloseDialog open={createOpen} onOpenChange={setCreateOpen} isDirty={createDirty}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Completed Sale *</Label>
              {selectedSale ? (
                <div className="mt-1.5 flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
                  <div className="text-sm">
                    <span className="font-mono font-medium">{selectedSale.sale_number}</span>
                    <span className="text-muted-foreground"> — {selectedSale.customer_name || "Walk-in"} — ₹{(selectedSale.total_amount || 0).toLocaleString()}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedSale(null); setSaleSearchQuery(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search by invoice #, name, phone, email..."
                    value={saleSearchQuery}
                    onChange={e => setSaleSearchQuery(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                  {saleSearchQuery && (
                    <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover shadow-lg">
                      {filteredSales.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">No sales found</div>
                      ) : (
                        filteredSales.slice(0, 50).map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { handleSelectSale(s.id); setSaleSearchQuery(""); }}
                            className="w-full text-left p-3 hover:bg-accent border-b last:border-0"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-sm font-medium">{s.sale_number}</span>
                              <span className="text-sm font-medium">₹{(s.total_amount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                              <span>{s.customer_name || "Walk-in"}{s.customer_phone ? ` · ${s.customer_phone}` : ""}</span>
                              <span>{s.sale_date ? format(new Date(s.sale_date), "dd MMM yyyy") : ""}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedSale && (
              <>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Invoice:</span><span className="font-mono">{selectedSale.sale_number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span><span className="font-medium">{selectedSale.customer_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Store:</span><span>{selectedSale.store_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Original Total:</span><span className="font-bold">₹{(selectedSale.total_amount || 0).toLocaleString()}</span></div>
                </div>

                <div>
                  <Label>Items to Return</Label>
                  <div className="rounded-lg border mt-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Sold Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Return Qty</TableHead>
                          <TableHead className="text-right">Refund</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedSale.items || []).map(item => (
                          <TableRow key={item.product_id}>
                            <TableCell className="text-sm">{item.product_name}</TableCell>
                            <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                            <TableCell className="text-right text-sm">₹{(item.unit_price || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={returnQtys[item.product_id] || 0}
                                onChange={e => setReturnQtys({
                                  ...returnQtys,
                                  [item.product_id]: Math.min(Number(e.target.value), item.quantity)
                                })}
                                className="w-16 h-8 text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium text-red-600">
                              ₹{((returnQtys[item.product_id] || 0) * (item.unit_price || 0)).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {selectedSale.payment_method && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-center justify-between">
                    <span>Original Payment: <strong>{PAYMENT_LABELS[selectedSale.payment_method] || selectedSale.payment_method}</strong></span>
                    {selectedSale.cheque_number && <span className="font-mono text-xs">CHQ: {selectedSale.cheque_number}</span>}
                    {selectedSale.advance_amount > 0 && <span className="text-xs">Advance: ₹{selectedSale.advance_amount.toLocaleString()}</span>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Refund Method {selectedSale.payment_method && <span className="text-xs text-muted-foreground">(default: same as payment)</span>}</Label>
                    <Select value={refundMethod} onValueChange={setRefundMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="adjust_new_bill">Adjust in New Bill</SelectItem>
                        <SelectItem value="credit_note">Credit Note</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Total Refund</Label>
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex justify-between items-center h-9">
                      <span className="text-sm text-red-600">Refund Amount</span>
                      <span className="text-lg font-bold text-red-600">₹{totalRefund.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Cheque fields */}
                {refundMethod === "cheque" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Cheque Name *</Label><Input value={chequeName} onChange={e => setChequeName(e.target.value)} placeholder="Name on cheque" /></div>
                    <div><Label>Cheque Number *</Label><Input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="Cheque no." /></div>
                  </div>
                )}

                {/* Credit note info */}
                {(refundMethod === "credit_note" || refundMethod === "adjust_new_bill") && (
                  <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-700">
                    {refundMethod === "credit_note"
                      ? "A Credit Note number will be auto-generated. Customer can use it in future purchases — the balance reduces with each use."
                      : "Refund will be adjusted against the customer's next bill. A Credit Note number will be generated for tracking."}
                  </div>
                )}

                <div>
                  <Label>Return Reason *</Label>
                  <Select value={returnReason} onValueChange={setReturnReason}>
                    <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                      <SelectItem value="Wrong Product">Wrong Product</SelectItem>
                      <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                      <SelectItem value="Customer Changed Mind">Customer Changed Mind</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!selectedSale || returnItems.length === 0 || !returnReason.trim()}>
              <RotateCcw className="mr-2 h-4 w-4" /> Create Return — ₹{totalRefund.toLocaleString()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </ConfirmCloseDialog>

      {/* View Return Dialog */}
      <Dialog open={!!viewReturn} onOpenChange={(open) => !open && setViewReturn(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Return Details — {viewReturn?.return_number}</DialogTitle></DialogHeader>
          {viewReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Original Invoice:</span> <span className="font-mono font-medium">{viewReturn.original_sale_number}</span></div>
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{viewReturn.customer_name}</span></div>
                <div><span className="text-muted-foreground">Store:</span> <span className="font-medium">{viewReturn.store_name}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{viewReturn.return_date ? format(new Date(viewReturn.return_date), "dd MMM yyyy, HH:mm") : "—"}</span></div>
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{viewReturn.return_type}</span></div>
                <div><span className="text-muted-foreground">Refund Method:</span> <span className="font-medium capitalize">{(viewReturn.refund_method || "").replace(/_/g, " ")}</span></div>
                {viewReturn.credit_note_number && <div><span className="text-muted-foreground">Credit Note #:</span> <span className="font-mono font-medium text-indigo-600">{viewReturn.credit_note_number}</span></div>}
                {viewReturn.cheque_name && <div><span className="text-muted-foreground">Cheque Name:</span> <span className="font-medium">{viewReturn.cheque_name}</span></div>}
                {viewReturn.cheque_number && <div><span className="text-muted-foreground">Cheque #:</span> <span className="font-mono font-medium">{viewReturn.cheque_number}</span></div>}
                {viewReturn.original_purchase_date && <div><span className="text-muted-foreground">Purchase Date:</span> <span className="font-medium">{format(new Date(viewReturn.original_purchase_date), "dd MMM yyyy")}</span></div>}
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewReturn.status} /></div>
                <div><span className="text-muted-foreground">Inventory Restocked:</span> <span className="font-medium">{viewReturn.inventory_restocked ? "✅ Yes" : "❌ No"}</span></div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Returned Items</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Returned Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Refund</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewReturn.items || []).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-right text-sm">{item.return_quantity}</TableCell>
                          <TableCell className="text-right text-sm">₹{(item.unit_price || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-red-600">₹{(item.refund_amount || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end">
                <span className="text-base font-bold text-red-600">Total Refund: ₹{(viewReturn.total_refund || 0).toLocaleString()}</span>
              </div>

              {viewReturn.return_reason && (
                <div className="text-sm"><span className="text-muted-foreground">Reason:</span> {viewReturn.return_reason}</div>
              )}
              {viewReturn.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {viewReturn.notes}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}