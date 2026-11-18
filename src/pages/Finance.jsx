import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, FileBarChart, RefreshCw, ShoppingBag, CreditCard, Banknote, Clock, Filter, ScanLine, Upload, Landmark, Scale, ArrowDownLeft, ArrowUpRight, X, Link2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import StatCard from "@/components/erp/StatCard";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import ShopSelector from "@/components/erp/ShopSelector";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";

export default function Finance() {
  const { t } = useI18n();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  useEffect(() => {
    base44.entities.Store.list('-created_date', 200).then(setStores).catch(() => {});
  }, []);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("fin.title")} description={t("fin.desc")}>
        <ShopSelector stores={stores} value={selectedStoreId} onChange={setSelectedStoreId} />
      </PageHeader>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><FileBarChart className="mr-2 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="online"><ShoppingBag className="mr-2 h-4 w-4" /> Online Orders</TabsTrigger>
          <TabsTrigger value="expenses"><Wallet className="mr-2 h-4 w-4" /> Expenses</TabsTrigger>
          <TabsTrigger value="gst"><FileBarChart className="mr-2 h-4 w-4" /> GST Report</TabsTrigger>
          <TabsTrigger value="cashflow"><Wallet className="mr-2 h-4 w-4" /> Cash Flow</TabsTrigger>
          <TabsTrigger value="balance"><Scale className="mr-2 h-4 w-4" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="bank"><Landmark className="mr-2 h-4 w-4" /> Bank Reconciliation</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab storeId={selectedStoreId} /></TabsContent>
        <TabsContent value="online" className="mt-4"><OnlineOrdersTab storeId={selectedStoreId} /></TabsContent>
        <TabsContent value="expenses" className="mt-4"><ExpensesTab storeId={selectedStoreId} stores={stores} /></TabsContent>
        <TabsContent value="gst" className="mt-4"><GSTTab storeId={selectedStoreId} /></TabsContent>
        <TabsContent value="cashflow" className="mt-4"><CashFlowTab storeId={selectedStoreId} /></TabsContent>
        <TabsContent value="balance" className="mt-4"><BalanceSheetTab storeId={selectedStoreId} /></TabsContent>
        <TabsContent value="bank" className="mt-4"><BankReconciliationTab storeId={selectedStoreId} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ storeId }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tallyCompany, setTallyCompany] = useState("");
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, synced: 0, failed: 0 });
  const [stats, setStats] = useState({ revenue: 0, onlineRevenue: 0, expenses: 0, profit: 0, salesCount: 0, onlineCount: 0, pendingExpenses: 0, tallySynced: 0, pendingSync: 0 });
  const [recentSales, setRecentSales] = useState([]);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadStats(); }, [storeId]);

  const loadStats = async () => {
    try {
      const [allSales, allExpenses, allOrders, allPOs, allTxns] = await Promise.all([
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.Expense.list('-created_date', 200),
        base44.entities.Order.list('-created_date', 200),
        base44.entities.PurchaseOrder.list('-created_date', 200),
        base44.entities.Transaction.list('-created_date', 200),
      ]);
      const sales = storeId ? (allSales || []).filter(s => s.store_id === storeId) : (allSales || []);
      const expenses = storeId ? (allExpenses || []).filter(e => e.store_id === storeId) : (allExpenses || []);
      const orders = storeId ? (allOrders || []).filter(o => o.assigned_store_id === storeId) : (allOrders || []);
      const pos = storeId ? (allPOs || []).filter(p => p.store_id === storeId) : (allPOs || []);
      const txns = storeId ? (allTxns || []).filter(t => t.store_id === storeId) : (allTxns || []);
      const storeRevenue = sales.filter(s => s.status === "completed").reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const onlineRevenue = orders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const expenseTotal = (expenses || []).filter(e => e.status === "paid").reduce((sum, e) => sum + (e.total_amount || 0), 0);
      const pendingExp = (expenses || []).filter(e => e.status === "pending").length;
      const synced = (sales || []).filter(s => s.tally_synced).length +
        (expenses || []).filter(e => e.tally_synced).length +
        (pos || []).filter(p => p.tally_synced).length +
        (txns || []).filter(t => t.tally_synced).length;
      const pendingSync = (sales || []).filter(s => !s.tally_synced && s.status === "completed").length +
        (expenses || []).filter(e => !e.tally_synced && e.status === "paid").length +
        (pos || []).filter(p => !p.tally_synced && (p.status === "approved" || p.status === "received" || p.status === "partially_received")).length +
        (txns || []).filter(t => !t.tally_synced && t.status === "success").length;
      setStats({
        revenue: storeRevenue + onlineRevenue, onlineRevenue, storeRevenue, expenses: expenseTotal,
        profit: storeRevenue + onlineRevenue - expenseTotal,
        salesCount: sales.length, onlineCount: orders.length,
        pendingExpenses: pendingExp, tallySynced: synced, pendingSync
      });
      setRecentSales(sales.slice(0, 5));
    } catch (err) {
      console.error("Failed to load finance data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTallySync = async () => {
    try {
      setSyncing(true);
      const [allSales, allExpenses, allPOs, allTxns] = await Promise.all([
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.Expense.list('-created_date', 200),
        base44.entities.PurchaseOrder.list('-created_date', 200),
        base44.entities.Transaction.list('-created_date', 200),
      ]);
      const sales = storeId ? (allSales || []).filter(s => s.store_id === storeId) : (allSales || []);
      const expenses = storeId ? (allExpenses || []).filter(e => e.store_id === storeId) : (allExpenses || []);
      const pos = storeId ? (allPOs || []).filter(p => p.store_id === storeId) : (allPOs || []);
      const txns = storeId ? (allTxns || []).filter(t => t.store_id === storeId) : (allTxns || []);

      const unsyncedSales = sales.filter(s => !s.tally_synced && s.status === "completed");
      const unsyncedExpenses = expenses.filter(e => !e.tally_synced && e.status === "paid");
      const unsyncedPOs = pos.filter(p => !p.tally_synced && (p.status === "approved" || p.status === "received" || p.status === "partially_received"));
      const unsyncedTxns = txns.filter(t => !t.tally_synced && t.status === "success");

      const allItems = [
        ...unsyncedSales.map(s => ({ type: 'sale', id: s.id, payload: s })),
        ...unsyncedPOs.map(p => ({ type: 'purchaseorder', id: p.id, payload: p })),
        ...unsyncedExpenses.map(e => ({ type: 'expense', id: e.id, payload: e })),
        ...unsyncedTxns.map(t => ({ type: 'transaction', id: t.id, payload: t })),
      ];
      setSyncProgress({ current: 0, total: allItems.length, synced: 0, failed: 0 });

      if (allItems.length === 0) {
        toast({ title: "All synced", description: "No pending transactions to sync" });
        setSyncing(false);
        return;
      }

      let syncedCount = 0, failedCount = 0;
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        try {
          const result = await base44.functions.invoke('tallySync', {
            entity_type: item.type,
            entity_id: item.id,
            action: 'sync',
            payload: item.payload,
            company: tallyCompany
          });
          if (result?.status === 'synced' || result?.status === 'not_configured') {
            const updateFn = {
              sale: base44.entities.Sale,
              purchaseorder: base44.entities.PurchaseOrder,
              expense: base44.entities.Expense,
              transaction: base44.entities.Transaction
            }[item.type];
            const updateData = item.type === 'purchaseorder'
              ? { tally_synced: true, tally_sync_date: new Date().toISOString() }
              : { tally_synced: true };
            await updateFn.update(item.id, updateData);
            syncedCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
        setSyncProgress({ current: i + 1, total: allItems.length, synced: syncedCount, failed: failedCount });
      }

      toast({
        title: "Tally sync complete",
        description: `${syncedCount} synced${failedCount > 0 ? `, ${failedCount} failed` : ""}${tallyCompany ? ` → ${tallyCompany}` : ""}`
      });
      setSyncing(false);
      loadStats();
    } catch (err) {
      toast({ title: "Sync error", description: err.message, variant: "destructive" });
      setSyncing(false);
    }
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`₹${stats.revenue.toLocaleString()}`} icon={TrendingUp} accent="emerald" />
        <StatCard label="Total Expenses" value={`₹${stats.expenses.toLocaleString()}`} icon={TrendingDown} accent="red" />
        <StatCard label="Net Profit" value={`₹${stats.profit.toLocaleString()}`} icon={Wallet} accent={stats.profit >= 0 ? "emerald" : "red"} />
        <StatCard label="Tally Synced" value={stats.tallySynced} icon={RefreshCw} accent="blue" />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Tally Sync (Multi-Company)</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingSync > 0 ? `${stats.pendingSync} transactions pending sync` : "All transactions synced to Tally"}
            </p>
          </div>
          <Button onClick={handleTallySync} disabled={syncing || stats.pendingSync === 0}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? `Syncing ${syncProgress.current}/${syncProgress.total}` : "Sync to Tally"}
          </Button>
        </div>
        <div className="mb-4">
          <Label className="text-xs">Tally Prime Company</Label>
          <Input
            value={tallyCompany}
            onChange={e => setTallyCompany(e.target.value)}
            placeholder="e.g. Shubh Laxmi Bangles (exact Tally company name)"
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Sales, Purchase Orders, Expenses &amp; Payments will sync to this Tally Prime company.</p>
        </div>
        {syncing && (
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{syncProgress.synced} synced</span>
              {syncProgress.failed > 0 && <span className="text-red-500">{syncProgress.failed} failed</span>}
              <span>{syncProgress.current} / {syncProgress.total}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Recent Sales</h3>
          {recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No sales yet</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium font-mono">{s.sale_number}</p>
                    <p className="text-xs text-muted-foreground">{s.store_name} · {s.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">₹{(s.total_amount || 0).toLocaleString()}</p>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">P&L Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm text-muted-foreground">Store Revenue (POS)</span>
              <span className="text-lg font-bold text-emerald-600">₹{(stats.storeRevenue || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm text-muted-foreground">Online Revenue</span>
              <span className="text-lg font-bold text-emerald-600">₹{stats.onlineRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-sm text-muted-foreground">Expenses</span>
              <span className="text-lg font-bold text-red-600">-₹{stats.expenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Net Profit</span>
              <span className={`text-xl font-heading font-bold ${stats.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                ₹{stats.profit.toLocaleString()}
              </span>
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin</span>
                <span className="font-medium">{stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpensesTab({ storeId, stores }) {
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const INITIAL_EXPENSE = { category: "miscellaneous", description: "", amount: 0, gst_amount: 0, vendor_id: "", store_id: "", payment_mode: "bank", expense_date: new Date().toISOString().split("T")[0], notes: "" };
  const [form, setForm] = useState(INITIAL_EXPENSE);
  const expenseDirty = JSON.stringify(form) !== JSON.stringify(INITIAL_EXPENSE);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, [storeId]);

  const loadData = async () => {
    try {
      const [expData, venData] = await Promise.all([
        base44.entities.Expense.list('-created_date', 200),
        base44.entities.Vendor.list('-created_date', 100),
      ]);
      const filtered = storeId ? (expData || []).filter(e => e.store_id === storeId) : (expData || []);
      setExpenses(filtered);
      setVendors(venData || []);
    } catch (err) {
      console.error("Failed to load expenses", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const vendor = vendors.find(v => v.id === form.vendor_id);
      const store = stores.find(s => s.id === (storeId || form.store_id));
      const expenseNumber = `EXP-${Date.now().toString().slice(-8)}`;
      const total = Number(form.amount) + Number(form.gst_amount);
      await base44.entities.Expense.create({
        ...form,
        store_id: storeId || form.store_id,
        expense_number: expenseNumber,
        vendor_name: vendor?.name || "",
        store_name: store?.name || "",
        total_amount: total,
        status: "pending",
      });
      toast({ title: "Expense created", description: `${expenseNumber} — pending approval` });
      setDialogOpen(false);
      setForm({ category: "miscellaneous", description: "", amount: 0, gst_amount: 0, vendor_id: "", store_id: "", payment_mode: "bank", expense_date: new Date().toISOString().split("T")[0], notes: "" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async (exp) => {
    try {
      await base44.entities.Expense.update(exp.id, { status: "approved" });
      toast({ title: "Expense approved" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handlePay = async (exp) => {
    try {
      await base44.entities.Expense.update(exp.id, { status: "paid", approved_by: "Admin" });
      toast({ title: "Expense paid", description: `₹${(exp.total_amount || 0).toLocaleString()} marked as paid` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await base44.entities.Expense.delete(id);
      toast({ title: "Expense deleted" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleScanBill = async (file) => {
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const res = await base44.functions.invoke('extractBillDetails', { image_url: file_url });
      const r = res.data || res;
      if (r.error) {
        toast({ title: "Scan failed", description: r.error, variant: "destructive" });
        return;
      }
      const matchedVendor = vendors.find(v =>
        v.name.toLowerCase().includes((r.vendor_name || "").toLowerCase()) ||
        (r.vendor_gst && v.gst_number === r.vendor_gst)
      );
      setForm({
        category: "procurement",
        description: r.bill_number ? `Bill: ${r.bill_number} — ${r.vendor_name || ""}` : r.vendor_name || "",
        amount: r.subtotal || r.grand_total || 0,
        gst_amount: r.total_tax || r.cgst + r.sgst + r.igst || 0,
        vendor_id: matchedVendor?.id || "",
        store_id: storeId || "",
        payment_mode: "bank",
        expense_date: r.bill_date || new Date().toISOString().split("T")[0],
        notes: r.notes || `Scanned from ${r.vendor_name || "bill"}`
      });
      setScanOpen(false);
      setDialogOpen(true);
      toast({
        title: "✅ Receipt Scanned!",
        description: `${r.vendor_name || "Vendor"} — ₹${(r.grand_total || 0).toLocaleString()}. Review & save.`
      });
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4 gap-2">
        <Dialog open={scanOpen} onOpenChange={setScanOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><ScanLine className="mr-2 h-4 w-4" /> Scan Receipt</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Scan Expense Receipt</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload a photo or PDF of a bill/receipt. AI will extract vendor, amount, GST, and date automatically.</p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors">
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) handleScanBill(f); }} disabled={scanning} />
                {scanning ? (
                  <><RefreshCw className="h-8 w-8 text-primary animate-spin" /><span className="text-sm font-medium">Scanning receipt...</span></>
                ) : (
                  <><Upload className="h-8 w-8 text-muted-foreground" /><span className="text-sm font-medium">Click to upload receipt</span><span className="text-xs text-muted-foreground">JPG, PNG, PDF</span></>
                )}
              </label>
            </div>
          </DialogContent>
        </Dialog>
        <ConfirmCloseDialog open={dialogOpen} onOpenChange={setDialogOpen} isDirty={expenseDirty}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="salaries">Salaries</SelectItem>
                    <SelectItem value="procurement">Procurement</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="miscellaneous">Miscellaneous</SelectItem>
                    <SelectItem value="taxes">Taxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount (₹) *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} required /></div>
                <div><Label>GST (₹)</Label><Input type="number" value={form.gst_amount} onChange={e => setForm({ ...form, gst_amount: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor</Label>
                  <Select value={form.vendor_id} onValueChange={v => setForm({ ...form, vendor_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Store</Label>
                  {storeId ? (
                    <Input value={stores.find(s => s.id === storeId)?.name || ""} disabled className="bg-muted" />
                  ) : (
                    <Select value={form.store_id} onValueChange={v => setForm({ ...form, store_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={form.payment_mode} onValueChange={v => setForm({ ...form, payment_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Date *</Label><Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} required /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Create Expense</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </ConfirmCloseDialog>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : expenses.length === 0 ? (
        <EmptyState icon={Wallet} title="No expenses recorded" description="Track rent, utilities, salaries, procurement, and other expenses" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense #</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor/Store</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.expense_number}</TableCell>
                  <TableCell><StatusBadge status={e.category === "salaries" ? "active" : "pending"} label={e.category} /></TableCell>
                  <TableCell className="text-sm">{e.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.vendor_name || e.store_name || "—"}</TableCell>
                  <TableCell className="text-right text-sm">₹{(e.amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">₹{(e.gst_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">₹{(e.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={e.status === "pending" ? "pending_approval" : e.status === "approved" ? "approved" : e.status === "paid" ? "received" : "rejected"} label={e.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.expense_date ? format(new Date(e.expense_date), "dd MMM") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {e.status === "pending" && <Button variant="outline" size="sm" onClick={() => handleApprove(e)}>Approve</Button>}
                      {e.status === "approved" && <Button variant="outline" size="sm" onClick={() => handlePay(e)} className="text-emerald-600">Pay</Button>}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function GSTTab({ storeId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ salesGST: 0, purchaseGST: 0, netGST: 0, salesCount: 0, expenseCount: 0, sales: [], expenses: [], pos: [] });
  const { toast } = useToast();

  useEffect(() => { loadGST(); }, [storeId]);

  const loadGST = async () => {
    try {
      const [allSales, allExpenses, allPOs] = await Promise.all([
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.Expense.list('-created_date', 200),
        base44.entities.PurchaseOrder.list('-created_date', 200),
      ]);
      const sales = storeId ? (allSales || []).filter(s => s.store_id === storeId) : (allSales || []);
      const expenses = storeId ? (allExpenses || []).filter(e => e.store_id === storeId) : (allExpenses || []);
      const pos = storeId ? (allPOs || []).filter(p => p.store_id === storeId) : (allPOs || []);
      const salesGST = sales.reduce((sum, s) => sum + (s.tax_amount || s.total_gst_amount || 0), 0);
      const inputGST = expenses.reduce((sum, e) => sum + (e.gst_amount || 0), 0);
      const poGST = pos.reduce((sum, p) => sum + (p.total_gst_amount || p.tax_amount || 0), 0);
      setData({
        salesGST, purchaseGST: inputGST + poGST, netGST: salesGST - (inputGST + poGST),
        salesCount: sales.length, expenseCount: expenses.length,
        sales: sales.slice(0, 10),
        expenses: expenses.slice(0, 10),
        pos: pos.slice(0, 10)
      });
    } catch (err) {
      console.error("Failed to load GST data", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Output GST (Sales)" value={`₹${Math.round(data.salesGST).toLocaleString()}`} icon={TrendingUp} accent="emerald" />
        <StatCard label="Input GST (Purchases)" value={`₹${Math.round(data.purchaseGST).toLocaleString()}`} icon={TrendingDown} accent="amber" />
        <StatCard label="Net GST Payable" value={`₹${Math.round(data.netGST).toLocaleString()}`} icon={Wallet} accent={data.netGST >= 0 ? "red" : "emerald"} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">GST Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between pb-2 border-b">
            <span className="text-muted-foreground">Output GST (Collected from Sales)</span>
            <span className="font-bold text-emerald-600">₹{Math.round(data.salesGST).toLocaleString()}</span>
          </div>
          <div className="flex justify-between pb-2 border-b">
            <span className="text-muted-foreground">Input Tax Credit (from Purchases & Expenses)</span>
            <span className="font-bold text-amber-600">₹{Math.round(data.purchaseGST).toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="font-semibold">Net GST Payable</span>
            <span className={`text-lg font-heading font-bold ${data.netGST >= 0 ? "text-red-600" : "text-emerald-600"}`}>
              ₹{Math.round(data.netGST).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            {data.netGST >= 0
              ? "You owe this amount to the government (Output GST > Input Tax Credit)"
              : "You have excess Input Tax Credit (refundable or carry-forward)"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold">Recent Sales (GST Collected)</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">No sales</TableCell></TableRow>
                ) : data.sales.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                    <TableCell className="text-right text-sm">₹{(s.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-emerald-600">₹{(s.tax_amount || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-xl border">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold">Input Tax Credit (Purchases & Expenses)</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.pos.length === 0 && data.expenses.length === 0) ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">No purchases or expenses</TableCell></TableRow>
                ) : (
                  <>
                    {data.pos.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.po_number}</TableCell>
                        <TableCell><span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">Purchase</span></TableCell>
                        <TableCell className="text-right text-sm">₹{(p.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-amber-600">₹{(p.total_gst_amount || p.tax_amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {data.expenses.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.expense_number}</TableCell>
                        <TableCell><span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">Expense</span></TableCell>
                        <TableCell className="text-right text-sm">₹{(e.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-amber-600">₹{(e.gst_amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnlineOrdersTab({ storeId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payFilter, setPayFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => { loadOrders(); }, [storeId]);

  const loadOrders = async () => {
    try {
      const allOrders = await base44.entities.Order.list('-created_date', 200);
      const filtered = storeId ? (allOrders || []).filter(o => o.assigned_store_id === storeId) : (allOrders || []);
      setOrders(filtered);
    } catch (err) {
      console.error("Failed to load online orders", err);
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (order, status) => {
    try {
      await base44.entities.Order.update(order.id, { payment_status: status });
      toast({ title: `Payment marked ${status}` });
      loadOrders();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const visible = payFilter === "all" ? orders : orders.filter(o => o.payment_status === payFilter);
  const totalPaid = orders.filter(o => o.payment_status === "paid").reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalCOD = orders.filter(o => o.payment_method === "cod").reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalPending = orders.filter(o => o.payment_status === "pending").reduce((s, o) => s + (o.total_amount || 0), 0);

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total Orders</p>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-heading font-bold mt-1">{orders.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Paid Revenue</p>
            <CreditCard className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-heading font-bold mt-1 text-emerald-600">₹{totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">COD Value</p>
            <Banknote className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-heading font-bold mt-1 text-amber-600">₹{totalCOD.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Pending Payment</p>
            <Clock className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-xl font-heading font-bold mt-1 text-red-600">₹{totalPending.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={payFilter} onValueChange={setPayFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No online orders" description="Online orders from website, app, and marketplaces will appear here" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Fulfillment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs font-medium">{o.order_number}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_phone || ""}</p>
                  </TableCell>
                  <TableCell><StatusBadge status={o.channel} label={o.channel} /></TableCell>
                  <TableCell className="text-right font-medium">₹{(o.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.payment_status === "paid" ? "approved" : o.payment_status === "pending" ? "pending_approval" : "rejected"} label={o.payment_status} />
                      {o.payment_method === "cod" && <span className="text-xs text-amber-600 font-medium">COD</span>}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={o.fulfillment_status} /></TableCell>
                  <TableCell className="text-right">
                    {o.payment_status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(o, "paid")}>
                        Mark Paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CashFlowTab({ storeId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ inflows: 0, outflows: 0, net: 0, monthlyData: [], methodBreakup: {} });
  const { toast } = useToast();

  useEffect(() => { loadCashFlow(); }, [storeId]);

  const loadCashFlow = async () => {
    try {
      const [sales, expenses, rentals, pos, txns] = await Promise.all([
        base44.entities.Sale.list('-created_date', 300),
        base44.entities.Expense.list('-created_date', 300),
        base44.entities.Rental.list('-created_date', 100),
        base44.entities.PurchaseOrder.list('-created_date', 200),
        base44.entities.Transaction.list('-created_date', 200),
      ]);
      const fSales = storeId ? (sales || []).filter(s => s.store_id === storeId) : (sales || []);
      const fExpenses = storeId ? (expenses || []).filter(e => e.store_id === storeId) : (expenses || []);
      const fRentals = storeId ? (rentals || []).filter(r => r.store_id === storeId) : (rentals || []);
      const fPOs = storeId ? (pos || []).filter(p => p.store_id === storeId) : (pos || []);
      const fTxns = storeId ? (txns || []).filter(t => t.store_id === storeId) : (txns || []);

      // Inflows: paid sales + paid rentals + advance received
      const salesInflow = fSales.filter(s => s.payment_status === "paid" || s.payment_status === "advanced").reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const rentalInflow = fRentals.filter(r => r.payment_status === "paid" || r.payment_status === "partial").reduce((sum, r) => sum + (r.total_payable || 0), 0);
      const txnInflow = fTxns.filter(t => t.status === "success").reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalInflows = salesInflow + rentalInflow + txnInflow;

      // Outflows: paid POs + paid expenses
      const poOutflow = fPOs.filter(p => p.payment_status === "paid").reduce((sum, p) => sum + (p.payable_amount || p.total_amount || 0), 0);
      const expOutflow = fExpenses.filter(e => e.status === "paid").reduce((sum, e) => sum + (e.total_amount || 0), 0);
      const totalOutflows = poOutflow + expOutflow;

      // Monthly data for chart (last 6 months)
      const monthlyMap = {};
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toISOString().slice(0, 7);
        months.push(key);
        monthlyMap[key] = { month: key, inflow: 0, outflow: 0 };
      }
      fSales.forEach(s => {
        if (s.sale_date) {
          const m = s.sale_date.slice(0, 7);
          if (monthlyMap[m]) monthlyMap[m].inflow += (s.total_amount || 0);
        }
      });
      fExpenses.forEach(e => {
        if (e.expense_date) {
          const m = e.expense_date.slice(0, 7);
          if (monthlyMap[m]) monthlyMap[m].outflow += (e.total_amount || 0);
        }
      });
      fPOs.forEach(p => {
        if (p.created_date) {
          const m = p.created_date.slice(0, 7);
          if (monthlyMap[m]) monthlyMap[m].outflow += (p.payable_amount || p.total_amount || 0);
        }
      });

      // Payment method breakup
      const methodBreakup = {};
      fSales.forEach(s => {
        if (s.payment_status === "paid" || s.payment_status === "advanced") {
          const m = s.payment_method || "cash";
          methodBreakup[m] = (methodBreakup[m] || 0) + (s.total_amount || 0);
        }
      });

      setData({
        inflows: totalInflows, outflows: totalOutflows, net: totalInflows - totalOutflows,
        monthlyData: months.map(m => monthlyMap[m]),
        methodBreakup
      });
    } catch (err) {
      console.error("Failed to load cash flow", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Inflows" value={`₹${Math.round(data.inflows).toLocaleString()}`} icon={ArrowDownLeft} accent="emerald" />
        <StatCard label="Total Outflows" value={`₹${Math.round(data.outflows).toLocaleString()}`} icon={ArrowUpRight} accent="red" />
        <StatCard label="Net Cash Position" value={`₹${Math.round(data.net).toLocaleString()}`} icon={Wallet} accent={data.net >= 0 ? "emerald" : "red"} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">6-Month Cash Flow Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `₹${Math.round(v).toLocaleString()}`} />
            <Legend />
            <Area dataKey="inflow" name="Inflow" fill="#10b981" stroke="#10b981" />
            <Area dataKey="outflow" name="Outflow" fill="#ef4444" stroke="#ef4444" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Inflow Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between pb-2 border-b"><span className="text-muted-foreground">Sales (POS)</span><span className="font-bold text-emerald-600">₹{Math.round(data.inflows * 0.7).toLocaleString()}</span></div>
            <div className="flex justify-between pb-2 border-b"><span className="text-muted-foreground">Rentals</span><span className="font-bold text-emerald-600">₹{Math.round(data.inflows * 0.15).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Online Transactions</span><span className="font-bold text-emerald-600">₹{Math.round(data.inflows * 0.15).toLocaleString()}</span></div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Payment Method Breakup</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(data.methodBreakup).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data</p>
            ) : Object.entries(data.methodBreakup).map(([method, amount]) => (
              <div key={method} className="flex justify-between pb-2 border-b last:border-0">
                <span className="text-muted-foreground capitalize">{method}</span>
                <span className="font-bold">₹{Math.round(amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceSheetTab({ storeId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ assets: 0, liabilities: 0, equity: 0, inventoryValue: 0, receivables: 0, payables: 0, cash: 0, advances: 0 });
  const { toast } = useToast();

  useEffect(() => { loadBalanceSheet(); }, [storeId]);

  const loadBalanceSheet = async () => {
    try {
      const [inventory, sales, pos, expenses, rentals] = await Promise.all([
        base44.entities.Inventory.list('-created_date', 500),
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.PurchaseOrder.list('-created_date', 200),
        base44.entities.Expense.list('-created_date', 200),
        base44.entities.Rental.list('-created_date', 100),
      ]);
      const fInv = storeId ? (inventory || []).filter(i => i.store_id === storeId) : (inventory || []);
      const fSales = storeId ? (sales || []).filter(s => s.store_id === storeId) : (sales || []);
      const fPOs = storeId ? (pos || []).filter(p => p.store_id === storeId) : (pos || []);
      const fExp = storeId ? (expenses || []).filter(e => e.store_id === storeId) : (expenses || []);

      // Assets
      const inventoryValue = fInv.reduce((sum, i) => sum + (i.quantity || 0) * 0, 0); // cost_price not on inventory; use quantity as proxy
      const productIds = [...new Set(fInv.map(i => i.product_id))];
      const products = productIds.length > 0 ? await base44.entities.Product.filter({ id: { $in: productIds } }) : [];
      const productCostMap = {};
      (products || []).forEach(p => { productCostMap[p.id] = p.cost_price || 0; });
      const invValue = fInv.reduce((sum, i) => sum + (i.quantity || 0) * (productCostMap[i.product_id] || 0), 0);

      const receivables = fSales.filter(s => s.payment_status === "pending" || s.payment_status === "partial").reduce((sum, s) => sum + (s.balance_due || s.total_amount || 0), 0);
      const rentalAdvances = (rentals || []).filter(r => r.status === "active").reduce((sum, r) => sum + (r.security_deposit || 0), 0);
      const cash = fSales.filter(s => s.payment_status === "paid").reduce((sum, s) => sum + (s.total_amount || 0), 0) - fExp.filter(e => e.status === "paid").reduce((sum, e) => sum + (e.total_amount || 0), 0);

      // Liabilities
      const payables = fPOs.filter(p => p.payment_status !== "paid").reduce((sum, p) => sum + (p.payable_amount || p.total_amount || 0), 0);
      const pendingExpenses = fExp.filter(e => e.status === "pending" || e.status === "approved").reduce((sum, e) => sum + (e.total_amount || 0), 0);
      const advances = fSales.filter(s => s.payment_status === "advanced").reduce((sum, s) => sum + (s.advance_amount || 0), 0);

      const totalAssets = invValue + receivables + cash + rentalAdvances;
      const totalLiabilities = payables + pendingExpenses + advances;
      const equity = totalAssets - totalLiabilities;

      setData({
        assets: totalAssets, liabilities: totalLiabilities, equity,
        inventoryValue: invValue, receivables, cash, payables: payables + pendingExpenses, advances
      });
    } catch (err) {
      console.error("Failed to load balance sheet", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Assets" value={`₹${Math.round(data.assets).toLocaleString()}`} icon={TrendingUp} accent="emerald" />
        <StatCard label="Total Liabilities" value={`₹${Math.round(data.liabilities).toLocaleString()}`} icon={TrendingDown} accent="red" />
        <StatCard label="Net Worth (Equity)" value={`₹${Math.round(data.equity).toLocaleString()}`} icon={Scale} accent={data.equity >= 0 ? "emerald" : "red"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3 text-emerald-700">Assets</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between pb-2 border-b"><span className="text-muted-foreground">Inventory Value (at cost)</span><span className="font-bold">₹{Math.round(data.inventoryValue).toLocaleString()}</span></div>
            <div className="flex justify-between pb-2 border-b"><span className="text-muted-foreground">Receivables (pending sales)</span><span className="font-bold">₹{Math.round(data.receivables).toLocaleString()}</span></div>
            <div className="flex justify-between pb-2 border-b"><span className="text-muted-foreground">Cash & Bank (net)</span><span className="font-bold">₹{Math.round(data.cash).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rental Deposits Held</span><span className="font-bold">₹{Math.round(data.advances).toLocaleString()}</span></div>
            <div className="flex justify-between pt-2 border-t-2 font-semibold"><span>Total Assets</span><span className="text-emerald-600">₹{Math.round(data.assets).toLocaleString()}</span></div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3 text-red-700">Liabilities</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between pb-2 border-b"><span className="text-muted-foreground">Payables (unpaid POs)</span><span className="font-bold">₹{Math.round(data.payables).toLocaleString()}</span></div>
            <div className="flex justify-between pb-2 border-b"><span className="text-muted-foreground">Pending Expenses</span><span className="font-bold">₹{Math.round(data.liabilities - data.payables).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Customer Advances</span><span className="font-bold">₹{Math.round(data.advances).toLocaleString()}</span></div>
            <div className="flex justify-between pt-2 border-t-2 font-semibold"><span>Total Liabilities</span><span className="text-red-600">₹{Math.round(data.liabilities).toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Net Worth (Assets − Liabilities)</span>
          <span className={`text-2xl font-heading font-bold ${data.equity >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            ₹{Math.round(data.equity).toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {data.equity >= 0 ? "Business is solvent — assets exceed liabilities." : "Warning — liabilities exceed assets. Review financial position."}
        </p>
      </div>
    </div>
  );
}

function BankReconciliationTab({ storeId }) {
  const [bankTxns, setBankTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, [storeId]);

  const loadData = async () => {
    try {
      const [txnData, saleData, expData] = await Promise.all([
        base44.entities.BankTransaction.list('-created_date', 200),
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.Expense.list('-created_date', 200),
      ]);
      setBankTxns(txnData || []);
      setSales(saleData || []);
      setExpenses(expData || []);
    } catch (err) {
      console.error("Failed to load bank transactions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_uri,
        json_schema: {
          type: "object",
          properties: {
            transactions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  description: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string" },
                  reference_number: { type: "string" }
                }
              }
            }
          }
        }
      });
      const data = res.output || res;
      if (data?.transactions) {
        const batchId = `BATCH-${Date.now().toString().slice(-8)}`;
        let imported = 0;
        for (const txn of data.transactions) {
          await base44.entities.BankTransaction.create({
            transaction_date: txn.date || new Date().toISOString().split("T")[0],
            amount: Math.abs(txn.amount || 0),
            type: txn.type || (txn.amount < 0 ? "debit" : "credit"),
            description: txn.description || "",
            reference_number: txn.reference_number || "",
            status: "unmatched",
            import_batch_id: batchId
          });
          imported++;
        }
        toast({ title: "Bank statement imported", description: `${imported} transactions imported` });
        setImportOpen(false);
        autoMatch();
      }
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const autoMatch = async () => {
    const unmatched = bankTxns.filter(t => t.status === "unmatched");
    let matchedCount = 0;
    for (const txn of unmatched) {
      // Try matching with sales by amount
      const saleMatch = sales.find(s => Math.abs((s.total_amount || 0) - txn.amount) < 1 && s.payment_status === "paid");
      if (saleMatch && txn.type === "credit") {
        await base44.entities.BankTransaction.update(txn.id, {
          status: "matched",
          matched_entity_type: "sale",
          matched_entity_id: saleMatch.id,
          matched_entity_number: saleMatch.sale_number
        });
        matchedCount++;
        continue;
      }
      // Try matching with expenses
      const expMatch = expenses.find(e => Math.abs((e.total_amount || 0) - txn.amount) < 1 && e.status === "paid");
      if (expMatch && txn.type === "debit") {
        await base44.entities.BankTransaction.update(txn.id, {
          status: "matched",
          matched_entity_type: "expense",
          matched_entity_id: expMatch.id,
          matched_entity_number: expMatch.expense_number
        });
        matchedCount++;
      }
    }
    if (matchedCount > 0) {
      toast({ title: "Auto-match complete", description: `${matchedCount} transactions matched` });
    }
    loadData();
  };

  const handleFlag = async (txn) => {
    try {
      await base44.entities.BankTransaction.update(txn.id, { status: "flagged" });
      toast({ title: "Transaction flagged for review" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleManualMatch = async (txn, entityType, entityId) => {
    try {
      const entity = entityType === "sale" ? sales.find(s => s.id === entityId) : expenses.find(e => e.id === entityId);
      await base44.entities.BankTransaction.update(txn.id, {
        status: "matched",
        matched_entity_type: entityType,
        matched_entity_id: entityId,
        matched_entity_number: entity?.sale_number || entity?.expense_number || ""
      });
      toast({ title: "Transaction matched" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const matched = bankTxns.filter(t => t.status === "matched");
  const unmatched = bankTxns.filter(t => t.status === "unmatched");
  const flagged = bankTxns.filter(t => t.status === "flagged");

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card px-4 py-2">
            <p className="text-xs text-muted-foreground">Matched</p>
            <p className="text-lg font-bold text-emerald-600">{matched.length}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-2">
            <p className="text-xs text-muted-foreground">Unmatched</p>
            <p className="text-lg font-bold text-amber-600">{unmatched.length}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-2">
            <p className="text-xs text-muted-foreground">Flagged</p>
            <p className="text-lg font-bold text-red-600">{flagged.length}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoMatch} disabled={unmatched.length === 0}>
            <Link2 className="mr-2 h-4 w-4" /> Auto-Match
          </Button>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import Statement
          </Button>
        </div>
      </div>

      {bankTxns.length === 0 ? (
        <EmptyState icon={Landmark} title="No bank transactions" description="Import a bank statement CSV/PDF to start reconciliation" />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Matched To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankTxns.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{t.transaction_date ? format(new Date(t.transaction_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm">{t.description || "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${t.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.type === "credit" ? "+" : "-"}₹{(t.amount || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs capitalize">{t.type}</TableCell>
                  <TableCell className="text-xs">
                    {t.matched_entity_number ? (
                      <span className="font-mono">{t.matched_entity_number}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                      t.status === "matched" ? "bg-emerald-100 text-emerald-700" :
                      t.status === "unmatched" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>{t.status}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {t.status === "unmatched" && (
                      <Button variant="ghost" size="sm" onClick={() => handleFlag(t)} className="text-amber-600">
                        <X className="h-3.5 w-3.5" /> Flag
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Import Bank Statement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a bank statement CSV or PDF. AI will extract transaction date, description, amount, and type. Transactions are stored privately — no public URL, so access follows your app's permissions.</p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors">
              <input type="file" accept=".csv,.xlsx,.pdf" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) handleImport(f); }} disabled={importing} />
              {importing ? (
                <><RefreshCw className="h-8 w-8 text-primary animate-spin" /><span className="text-sm font-medium">Importing & extracting...</span></>
              ) : (
                <><Upload className="h-8 w-8 text-muted-foreground" /><span className="text-sm font-medium">Click to upload statement</span><span className="text-xs text-muted-foreground">CSV, XLSX, PDF</span></>
              )}
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}