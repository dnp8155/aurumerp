import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShoppingBag, Eye, Package, Truck, Check, X, Plus, Filter, RefreshCw, CreditCard, Banknote, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import useFormDirty from "@/hooks/useFormDirty";
import { format } from "date-fns";

export default function Ecommerce() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewOrder, setViewOrder] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [marketplaceFilter, setMarketplaceFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [nextStep, setNextStep] = useState(null);
  const [syncPlatform, setSyncPlatform] = useState("shopify");
  const [syncResult, setSyncResult] = useState(null);
  const [form, setForm] = useState({
    customer_name: "", customer_email: "", customer_phone: "",
    shipping_address: "", shipping_city: "", shipping_state: "", shipping_pincode: "",
    items: [{ product_id: "", quantity: 1 }], channel: "website", marketplace: "manual", payment_method: "prepaid", notes: ""
  });
  const { toast } = useToast();
  const { t } = useI18n();
  const orderDirty = useFormDirty(createOpen, form);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [orderData, prodData, storeData] = await Promise.all([
        base44.entities.Order.list('-created_date', 100),
        base44.entities.Product.filter({ status: "active" }),
        base44.entities.Store.list('-created_date', 100),
      ]);
      setOrders(orderData || []);
      setProducts(prodData || []);
      setStores(storeData || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = orders
    .filter(o => statusFilter === "all" || o.fulfillment_status === statusFilter)
    .filter(o => marketplaceFilter === "all" || o.marketplace === marketplaceFilter);

  const orderStats = {
    total: orders.length,
    paid: orders.filter(o => o.payment_status === "paid").length,
    cod: orders.filter(o => o.payment_method === "cod").length,
    pending: orders.filter(o => o.fulfillment_status === "pending" || o.fulfillment_status === "confirmed" || o.fulfillment_status === "packed").length,
    revenue: orders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + (o.total_amount || 0), 0),
    codRevenue: orders.filter(o => o.payment_method === "cod" && o.payment_status === "pending").reduce((sum, o) => sum + (o.total_amount || 0), 0),
    shopify: orders.filter(o => o.marketplace === "shopify").length,
    amazon: orders.filter(o => o.marketplace === "amazon").length,
    shopifyRevenue: orders.filter(o => o.marketplace === "shopify" && o.payment_status === "paid").reduce((s, o) => s + (o.total_amount || 0), 0),
    amazonRevenue: orders.filter(o => o.marketplace === "amazon" && o.payment_status === "paid").reduce((s, o) => s + (o.total_amount || 0), 0),
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const resp = await base44.functions.invoke('syncMarketplaceOrders', {
        marketplace: syncPlatform,
        daysBack: 30
      });
      const data = resp.data || resp;
      if (data.error) {
        setSyncResult({ error: data.error });
        toast({ title: "Sync failed", description: data.error, variant: "destructive" });
      } else {
        setSyncResult(data);
        toast({ title: "Sync complete", description: `${data.created} new, ${data.updated} updated from ${syncPlatform}` });
        loadData();
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setSyncResult({ error: msg });
      toast({ title: "Sync failed", description: msg, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: "", quantity: 1 }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_name || form.items.length === 0) {
      toast({ title: "Error", description: "Customer name and items required", variant: "destructive" });
      return;
    }
    try {
      const orderItems = form.items
        .filter(i => i.product_id)
        .map(i => {
          const p = products.find(pr => pr.id === i.product_id);
          return {
            product_id: i.product_id,
            sku: p?.sku || "",
            product_name: p?.name || "",
            quantity: Number(i.quantity),
            unit_price: p?.selling_price || 0,
            total_price: (p?.selling_price || 0) * Number(i.quantity),
            image_url: p?.images?.[0] || ""
          };
        });

      const subtotal = orderItems.reduce((s, i) => s + i.total_price, 0);
      const shipping = subtotal > 2000 ? 0 : 50;
      const tax = Math.round(subtotal * 0.03);
      const total = subtotal + shipping + tax;

      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
      await base44.entities.Order.create({
        ...form,
        order_number: orderNumber,
        items: orderItems,
        subtotal, shipping_charge: shipping, tax_amount: tax, total_amount: total,
        payment_status: form.payment_method === "cod" ? "pending" : "paid",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
      });
      toast({ title: "Order created", description: orderNumber });
      setNextStep({ key: "order" });
      setCreateOpen(false);
      setForm({ customer_name: "", customer_email: "", customer_phone: "", shipping_address: "", shipping_city: "", shipping_state: "", shipping_pincode: "", items: [{ product_id: "", quantity: 1 }], channel: "website", marketplace: "manual", payment_method: "prepaid", notes: "" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateFulfillment = async (order, status, extra = {}) => {
    try {
      await base44.entities.Order.update(order.id, { fulfillment_status: status, ...extra });
      toast({ title: `Order ${status}` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const assignStore = async (order, storeId) => {
    const store = stores.find(s => s.id === storeId);
    try {
      await base44.entities.Order.update(order.id, { assigned_store_id: storeId, assigned_store_name: store?.name });
      toast({ title: `Assigned to ${store?.name}` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("eco.title")} description={t("eco.desc")}>
        <Button variant="outline" onClick={() => { setSyncResult(null); setSyncOpen(true); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync from Marketplace
        </Button>
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Order</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total Orders</p>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-heading font-bold mt-1">{orderStats.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Paid</p>
            <CreditCard className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-heading font-bold mt-1 text-emerald-600">{orderStats.paid}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">COD Pending</p>
            <Banknote className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-heading font-bold mt-1 text-amber-600">{orderStats.cod}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Fulfillment Due</p>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-heading font-bold mt-1 text-blue-600">{orderStats.pending}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Online Revenue</p>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-heading font-bold mt-1 text-emerald-600">₹{orderStats.revenue.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="shopify">Shopify</SelectItem>
              <SelectItem value="amazon">Amazon</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="packed">Packed</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
        {(marketplaceFilter !== "all" || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setMarketplaceFilter("all"); setStatusFilter("all"); }}>
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title={t("eco.no_orders")} description={t("eco.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs font-medium">{o.order_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{o.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{o.customer_phone || o.customer_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                      o.marketplace === "shopify" ? "bg-emerald-100 text-emerald-700" :
                      o.marketplace === "amazon" ? "bg-amber-100 text-amber-700" :
                      o.marketplace === "website" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {o.marketplace === "shopify" && <ShoppingBag className="h-3 w-3" />}
                      {o.marketplace === "amazon" && <Package className="h-3 w-3" />}
                      {o.marketplace ? (o.marketplace.charAt(0).toUpperCase() + o.marketplace.slice(1)) : "Manual"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">{(o.items || []).length}</TableCell>
                  <TableCell className="text-right font-medium">₹{(o.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={o.payment_status === "paid" ? "approved" : o.payment_status === "pending" ? "pending_approval" : "rejected"} label={o.payment_status} /></TableCell>
                  <TableCell><StatusBadge status={o.fulfillment_status} /></TableCell>
                  <TableCell className="text-xs">{o.assigned_store_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.order_date ? format(new Date(o.order_date), "dd MMM") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setViewOrder(o)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Order Dialog */}
      <ConfirmCloseDialog open={createOpen} onOpenChange={setCreateOpen} isDirty={orderDirty}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Online Order</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Customer Name *</Label><Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required /></div>
              <div><Label>Phone</Label><Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
            <div><Label>Shipping Address</Label><Textarea value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>City</Label><Input value={form.shipping_city} onChange={e => setForm({ ...form, shipping_city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.shipping_state} onChange={e => setForm({ ...form, shipping_state: e.target.value })} /></div>
              <div><Label>Pincode</Label><Input value={form.shipping_pincode} onChange={e => setForm({ ...form, shipping_pincode: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Platform</Label>
                <Select value={form.marketplace} onValueChange={v => setForm({ ...form, marketplace: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="shopify">Shopify</SelectItem>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={v => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="app">App</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">Prepaid</SelectItem>
                    <SelectItem value="cod">COD</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Add</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Select value={item.product_id} onValueChange={v => updateItem(idx, "product_id", v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — ₹{(p.selling_price || 0).toLocaleString()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="w-20" />
                    {form.items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}><X className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit">Create Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </ConfirmCloseDialog>

      {/* Order Detail Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order — {viewOrder?.order_number}</DialogTitle></DialogHeader>
          {viewOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{viewOrder.customer_name}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{viewOrder.customer_phone || "—"}</span></div>
                <div><span className="text-muted-foreground">Platform:</span> <span className="font-medium capitalize">{viewOrder.marketplace || "manual"}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{viewOrder.order_date ? format(new Date(viewOrder.order_date), "dd MMM yyyy") : "—"}</span></div>
                <div><span className="text-muted-foreground">Payment:</span> <StatusBadge status={viewOrder.payment_status === "paid" ? "approved" : "pending_approval"} label={viewOrder.payment_status} /></div>
                <div><span className="text-muted-foreground">Fulfillment:</span> <StatusBadge status={viewOrder.fulfillment_status} /></div>
                {viewOrder.marketplace_order_id && (
                  <div><span className="text-muted-foreground">Marketplace ID:</span> <span className="font-mono text-xs">{viewOrder.marketplace_order_id}</span></div>
                )}
                {viewOrder.last_synced_date && (
                  <div><span className="text-muted-foreground">Last Synced:</span> <span className="font-medium text-xs">{format(new Date(viewOrder.last_synced_date), "dd MMM yyyy, HH:mm")}</span></div>
                )}
              </div>
              {viewOrder.shipping_address && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="font-medium mb-1">Shipping Address</p>
                  <p>{viewOrder.shipping_address}</p>
                  <p>{viewOrder.shipping_city}, {viewOrder.shipping_state} {viewOrder.shipping_pincode}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Items</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewOrder.items || []).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm">₹{(item.unit_price || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm font-medium">₹{(item.total_price || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex justify-end">
                <span className="text-base font-bold">Total: ₹{(viewOrder.total_amount || 0).toLocaleString()}</span>
              </div>

              {viewOrder.fulfillment_status !== "delivered" && viewOrder.fulfillment_status !== "cancelled" && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <Label>Assign to Store</Label>
                    <Select value={viewOrder.assigned_store_id} onValueChange={v => assignStore(viewOrder, v)}>
                      <SelectTrigger><SelectValue placeholder="Select store for fulfillment" /></SelectTrigger>
                      <SelectContent>
                        {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewOrder.fulfillment_status === "pending" && <Button size="sm" onClick={() => updateFulfillment(viewOrder, "confirmed")}><Check className="mr-1 h-3 w-3" /> Confirm</Button>}
                    {viewOrder.fulfillment_status === "confirmed" && <Button size="sm" onClick={() => updateFulfillment(viewOrder, "packed")}><Package className="mr-1 h-3 w-3" /> Pack</Button>}
                    {viewOrder.fulfillment_status === "packed" && <Button size="sm" onClick={() => updateFulfillment(viewOrder, "dispatched")}><Truck className="mr-1 h-3 w-3" /> Dispatch</Button>}
                    {viewOrder.fulfillment_status === "dispatched" && <Button size="sm" onClick={() => updateFulfillment(viewOrder, "delivered", { delivery_date: new Date().toISOString() })}><Check className="mr-1 h-3 w-3" /> Deliver</Button>}
                    <Button size="sm" variant="outline" onClick={() => updateFulfillment(viewOrder, "cancelled")}><X className="mr-1 h-3 w-3" /> Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sync from Marketplace Dialog */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sync Orders from Marketplace</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Platform</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSyncPlatform("shopify")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                    syncPlatform === "shopify" ? "border-emerald-500 bg-emerald-50" : "border-border hover:border-emerald-300"
                  }`}
                >
                  <ShoppingBag className="h-6 w-6 text-emerald-600" />
                  <span className="text-sm font-medium">Shopify</span>
                  <span className="text-xs text-muted-foreground">{orderStats.shopify} orders</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSyncPlatform("amazon")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                    syncPlatform === "amazon" ? "border-amber-500 bg-amber-50" : "border-border hover:border-amber-300"
                  }`}
                >
                  <Package className="h-6 w-6 text-amber-600" />
                  <span className="text-sm font-medium">Amazon</span>
                  <span className="text-xs text-muted-foreground">{orderStats.amazon} orders</span>
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How it works</p>
              <p>Fetches orders from the last 30 days. New orders are created; existing ones are updated with latest status. API credentials must be configured in Settings → Environment Variables.</p>
            </div>
            {syncResult?.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                <p className="font-medium mb-1">Sync Error</p>
                <p className="text-xs">{syncResult.error}</p>
              </div>
            )}
            {syncResult?.success && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                <p className="font-medium text-emerald-700 mb-1">Sync Successful</p>
                <p className="text-xs text-emerald-600">{syncResult.created} new orders created, {syncResult.updated} updated, {syncResult.skipped} skipped.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSyncOpen(false)}>Close</Button>
            <Button type="button" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : `Sync ${syncPlatform === "shopify" ? "Shopify" : "Amazon"} Orders`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}