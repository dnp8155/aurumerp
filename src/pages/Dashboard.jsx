import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  PackageCheck, Tag, Truck, AlertTriangle,
  ArrowRight, Clock, ShoppingCart, ShoppingBag, Wallet, IndianRupee, LayoutDashboard
} from "lucide-react";
import StatusBadge from "@/components/erp/StatusBadge";
import StockOverview from "@/components/erp/StockOverview";
import DashboardCharts from "@/components/erp/DashboardCharts";
import DashboardFilterBar from "@/components/erp/DashboardFilterBar";
import TallySyncStatusPanel from "@/components/erp/TallySyncStatusPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import HomeToday from "@/components/erp/HomeToday";
import { useI18n } from "@/lib/i18n";

function Kpi({ label, value, sub, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border/60 bg-[#F2EFEA] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [dashboardFilter, setDashboardFilter] = useState({ shopId: "", dateFrom: "", dateTo: "" });
  const [stats, setStats] = useState({
    pendingQC: 0, readyForCataloging: 0, dispatched: 0, discrepancies: 0,
    totalProducts: 0, totalStores: 0, totalInventory: 0, lowStock: 0,
    todayRevenue: 0, pendingOrders: 0, pendingExpenses: 0, totalSales: 0
  });
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentShipments, setRecentShipments] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, [dashboardFilter]);

  const loadDashboard = async () => {
    try {
      const [receipts, products, storeData, inventory, shipments, sales, orders, expenses] = await Promise.all([
        base44.entities.GoodsReceipt.list('-created_date', 50),
        base44.entities.Product.list('-created_date', 50),
        base44.entities.Store.list('-created_date', 50),
        base44.entities.Inventory.list('-created_date', 50),
        base44.entities.Shipment.list('-created_date', 20),
        base44.entities.Sale.list('-created_date', 50),
        base44.entities.Order.list('-created_date', 10),
        base44.entities.Expense.list('-created_date', 50),
      ]);

      setStores(storeData || []);

      // Apply shop filter
      const fShop = dashboardFilter.shopId;
      const byShop = (arr, field = "store_id") => fShop ? (arr || []).filter(x => x[field] === fShop) : (arr || []);
      const fSales = byShop(sales);
      const fExpenses = byShop(expenses);
      const fOrders = byShop(orders);
      const fReceipts = byShop(receipts);
      const fInventory = byShop(inventory);
      const fShipments = fShop
        ? (shipments || []).filter(s => s.from_store_id === fShop || s.to_store_id === fShop)
        : (shipments || []);

      // Apply date filter to sales
      const inDateRange = (arr, field) => {
        if (!dashboardFilter.dateFrom && !dashboardFilter.dateTo) return arr;
        return (arr || []).filter(x => {
          if (!x[field]) return false;
          const d = String(x[field]).split("T")[0];
          if (dashboardFilter.dateFrom && d < dashboardFilter.dateFrom) return false;
          if (dashboardFilter.dateTo && d > dashboardFilter.dateTo) return false;
          return true;
        });
      };
      const dSales = inDateRange(fSales, "sale_date");

      const today = new Date().toISOString().split("T")[0];
      const todayRevenue = (dashboardFilter.dateFrom || dashboardFilter.dateTo)
        ? dSales.filter(s => s.status === "completed").reduce((sum, s) => sum + (s.total_amount || 0), 0)
        : fSales.filter(s => s.status === "completed" && s.sale_date && s.sale_date.split("T")[0] === today).reduce((sum, s) => sum + (s.total_amount || 0), 0);

      setStats({
        pendingQC: fReceipts.filter(r => r.status === "pending_qc" || r.status === "qc_in_progress").length,
        readyForCataloging: (products || []).filter(p => p.status === "draft").length,
        dispatched: fShipments.filter(s => s.status === "dispatched" || s.status === "in_transit").length,
        discrepancies: fReceipts.filter(r => r.status === "discrepancy").length +
          fShipments.filter(s => s.status === "discrepancy").length,
        totalProducts: (products || []).length,
        totalStores: (storeData || []).length,
        totalInventory: fInventory.reduce((sum, i) => sum + (i.quantity || 0), 0),
        lowStock: fInventory.filter(i => (i.quantity || 0) <= (i.min_stock_level || 0) && i.min_stock_level > 0).length,
        todayRevenue,
        pendingOrders: fOrders.filter(o => o.fulfillment_status === "pending" || o.fulfillment_status === "confirmed").length,
        pendingExpenses: fExpenses.filter(e => e.status === "pending").length,
        totalSales: dSales.length,
      });

      setRecentReceipts(fReceipts.slice(0, 5));
      setRecentProducts((products || []).slice(0, 5));
      setRecentShipments(fShipments.slice(0, 5));
      setRecentSales(dSales.slice(0, 5));
      setRecentOrders(fOrders.slice(0, 5));
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#faf9f6]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#faf9f6] max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white"><LayoutDashboard className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-heading font-bold tracking-tight">{t("dash.title")}</h1><p className="text-xs text-muted-foreground">{t("dash.desc")}</p></div>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="today"><HomeToday /></TabsContent>
        <TabsContent value="overview">
      <DashboardFilterBar
        stores={stores}
        filter={dashboardFilter}
        onFilterChange={setDashboardFilter}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label={t("dash.today_revenue")} value={`₹${stats.todayRevenue.toLocaleString()}`} sub="Customers paid you today" icon={IndianRupee} />
        <Kpi label={t("dash.pending_orders")} value={stats.pendingOrders} sub="Waiting to be fulfilled" icon={ShoppingBag} />
        <Kpi label={t("dash.pending_expenses")} value={stats.pendingExpenses} sub="Waiting for approval" icon={Wallet} />
        <Kpi label={t("dash.total_sales")} value={stats.totalSales} sub="In the selected period" icon={ShoppingCart} />
        <Kpi label={t("dash.pending_qc")} value={stats.pendingQC} sub="Goods receipts to check" icon={PackageCheck} />
        <Kpi label={t("dash.ready_cataloging")} value={stats.readyForCataloging} sub="Draft products to catalog" icon={Tag} />
        <Kpi label={t("dash.in_transit")} value={stats.dispatched} sub="Shipments on the move" icon={Truck} />
        <Kpi label={t("dash.discrepancies")} value={stats.discrepancies} sub="Receipts or shipments off" icon={AlertTriangle} />
      </div>

      <TallySyncStatusPanel />

      <DashboardCharts shopId={dashboardFilter.shopId} dateFrom={dashboardFilter.dateFrom} dateTo={dashboardFilter.dateTo} />

      <div className="mb-6">
        <StockOverview />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">{t("dash.recent_receipts")}</CardTitle>
            <Link to="/goods-receipt">
              <Button variant="ghost" size="sm" className="text-xs">{t("action.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {recentReceipts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("dash.no_receipts")}</p>
            ) : (
              <div className="space-y-3">
                {recentReceipts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.receipt_number}</p>
                      <p className="text-xs text-muted-foreground">{r.vendor_name || "—"} · {r.store_name || "—"}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">{t("dash.recent_skus")}</CardTitle>
            <Link to="/cataloging">
              <Button variant="ghost" size="sm" className="text-xs">{t("action.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {recentProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("dash.no_skus")}</p>
            ) : (
              <div className="space-y-3">
                {recentProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.sku}</p>
                        <p className="text-xs text-muted-foreground">{p.name}</p>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">{t("dash.recent_sales")}</CardTitle>
            <Link to="/pos">
              <Button variant="ghost" size="sm" className="text-xs">{t("action.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("dash.no_sales")}</p>
            ) : (
              <div className="space-y-3">
                {recentSales.map((s) => (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">{t("dash.recent_orders")}</CardTitle>
            <Link to="/ecommerce">
              <Button variant="ghost" size="sm" className="text-xs">{t("action.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("dash.no_orders")}</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium font-mono">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{o.customer_name} · {o.channel}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold">₹{(o.total_amount || 0).toLocaleString()}</p>
                      <StatusBadge status={o.fulfillment_status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">{t("dash.active_shipments")}</CardTitle>
          <Link to="/pallets">
            <Button variant="ghost" size="sm" className="text-xs">{t("action.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {recentShipments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("dash.no_shipments")}</p>
          ) : (
            <div className="space-y-3">
              {recentShipments.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                      <Truck className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.shipment_number}</p>
                      <p className="text-xs text-muted-foreground">{s.from_store_name} → {s.to_store_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.status === "in_transit" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}