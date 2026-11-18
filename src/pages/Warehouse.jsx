import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PackageCheck, Truck, AlertTriangle, TrendingDown, ArrowRight, Boxes } from "lucide-react";
import StatCard from "@/components/erp/StatCard";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { useI18n } from "@/lib/i18n";

export default function WarehouseDashboard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWh, setSelectedWh] = useState("all");
  const [inventory, setInventory] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [storeData, invData, receiptData, shipData, prodData] = await Promise.all([
        base44.entities.Store.list('-created_date', 100),
        base44.entities.Inventory.list('-created_date', 500),
        base44.entities.GoodsReceipt.list('-created_date', 100),
        base44.entities.Shipment.list('-created_date', 200),
        base44.entities.Product.list('-created_date', 200),
      ]);
      setWarehouses((storeData || []).filter(s => s.type === "warehouse"));
      setInventory(invData || []);
      setReceipts(receiptData || []);
      setShipments(shipData || []);
      setProducts(prodData || []);
    } catch (err) {
      console.error("Failed to load warehouse data", err);
    } finally {
      setLoading(false);
    }
  };

  const whInventory = selectedWh === "all"
    ? inventory.filter(i => warehouses.some(w => w.id === i.store_id))
    : inventory.filter(i => i.store_id === selectedWh);

  const whReceipts = selectedWh === "all"
    ? receipts.filter(r => warehouses.some(w => w.id === r.store_id))
    : receipts.filter(r => r.store_id === selectedWh);

  const whShipments = selectedWh === "all"
    ? shipments.filter(s => warehouses.some(w => w.id === s.from_store_id || w.id === s.to_store_id))
    : shipments.filter(s => s.from_store_id === selectedWh || s.to_store_id === selectedWh);

  // Stock aging
  const now = new Date();
  const computeAging = (inv) => {
    if (!inv.last_received_date) return "green";
    const days = differenceInDays(now, new Date(inv.last_received_date));
    if (days > 90) return "red";
    if (days > 45) return "amber";
    return "green";
  };

  const agingBuckets = { green: 0, amber: 0, red: 0 };
  const totalUnits = whInventory.reduce((s, i) => s + (i.quantity || 0), 0);
  whInventory.forEach(i => {
    const bucket = i.aging_status || computeAging(i);
    agingBuckets[bucket] = (agingBuckets[bucket] || 0) + (i.quantity || 0);
  });

  // Inbound pending
  const inboundPending = whReceipts.filter(r => r.status === "pending_qc" || r.status === "qc_in_progress");
  const inboundReceived = whReceipts.filter(r => r.status === "qc_completed" || r.status === "received");

  // Dispatch SLA
  const dispatchedShipments = whShipments.filter(s => s.status === "dispatched" || s.status === "received");
  const avgDispatchDays = dispatchedShipments.length > 0
    ? dispatchedShipments.reduce((sum, s) => {
        if (s.dispatched_date && s.received_date) return sum + differenceInDays(new Date(s.received_date), new Date(s.dispatched_date));
        if (s.dispatched_date) return sum + differenceInDays(now, new Date(s.dispatched_date));
        return sum;
      }, 0) / dispatchedShipments.length
    : 0;

  // Transit loss / discrepancy
  const discrepancies = whShipments.filter(s => s.status === "discrepancy");

  // Low stock
  const lowStock = whInventory.filter(i => i.min_stock_level > 0 && (i.quantity || 0) <= i.min_stock_level);

  // Slow movers (Red >90 days)
  const slowMovers = whInventory
    .map(i => ({ ...i, computedAging: i.aging_status || computeAging(i), daysInStock: i.last_received_date ? differenceInDays(now, new Date(i.last_received_date)) : 0 }))
    .filter(i => i.computedAging === "red" && (i.quantity || 0) > 0)
    .sort((a, b) => b.daysInStock - a.daysInStock);

  if (loading) return <div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("wh.title")} description={t("wh.desc")}>
        <Select value={selectedWh} onValueChange={setSelectedWh}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Units in Stock" value={totalUnits.toLocaleString()} icon={Boxes} accent="blue" />
        <StatCard label="Inbound Pending QC" value={inboundPending.length} icon={PackageCheck} accent="amber" />
        <StatCard label="Avg Dispatch Time" value={`${avgDispatchDays.toFixed(1)} days`} icon={Truck} accent="violet" />
        <StatCard label="Discrepancies" value={discrepancies.length} icon={AlertTriangle} accent="red" />
      </div>

      {/* Stock Aging */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm font-semibold">Stock Aging Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-emerald-700">Fresh (0-45 days)</span>
                <StatusBadge status="green" />
              </div>
              <p className="text-2xl font-heading font-bold text-emerald-700">{agingBuckets.green.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-1">units in stock</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-amber-700">Aging (46-90 days)</span>
                <StatusBadge status="amber" />
              </div>
              <p className="text-2xl font-heading font-bold text-amber-700">{agingBuckets.amber.toLocaleString()}</p>
              <p className="text-xs text-amber-600 mt-1">units in stock</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-700">Old Stock (90+ days)</span>
                <StatusBadge status="red" />
              </div>
              <p className="text-2xl font-heading font-bold text-red-700">{agingBuckets.red.toLocaleString()}</p>
              <p className="text-xs text-red-600 mt-1">units — consider discount/transfer</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Inbound Pending */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Inbound Pending QC</CardTitle>
            <Link to="/goods-receipt"><Button variant="ghost" size="sm" className="text-xs">View All <ArrowRight className="ml-1 h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent>
            {inboundPending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending receipts</p>
            ) : (
              <div className="space-y-2">
                {inboundPending.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium font-mono">{r.receipt_number}</p>
                      <p className="text-xs text-muted-foreground">{r.vendor_name || "—"} · {r.store_name}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Low Stock Alerts</CardTitle>
            <Link to="/inventory"><Button variant="ghost" size="sm" className="text-xs">View All <ArrowRight className="ml-1 h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No low-stock items</p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 5).map(i => (
                  <div key={i.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{i.product_name || i.sku}</p>
                      <p className="text-xs text-muted-foreground">{i.store_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{i.quantity}</p>
                      <p className="text-xs text-muted-foreground">min: {i.min_stock_level}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Slow Movers */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Slow Movers (90+ days in stock)</CardTitle></CardHeader>
        <CardContent>
          {slowMovers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No slow-moving stock — all inventory is fresh</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Last Received</TableHead>
                    <TableHead className="text-right">Days in Stock</TableHead>
                    <TableHead>Aging</TableHead>
                    <TableHead className="text-right">Suggestion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowMovers.slice(0, 15).map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                      <TableCell className="text-sm font-medium">{i.product_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.store_name}</TableCell>
                      <TableCell className="text-right font-medium">{i.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.last_received_date ? format(new Date(i.last_received_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">{i.daysInStock}</TableCell>
                      <TableCell><StatusBadge status="red" /></TableCell>
                      <TableCell className="text-right text-xs text-amber-600">Transfer or discount</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discrepancies */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Transit Loss / Discrepancies</CardTitle></CardHeader>
        <CardContent>
          {discrepancies.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No discrepancies" description="All shipments received without issues" />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment #</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Discrepancy Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.shipment_number}</TableCell>
                      <TableCell className="text-sm">{s.from_store_name} → {s.to_store_name}</TableCell>
                      <TableCell className="text-sm text-red-600">{s.discrepancy_notes || "—"}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}