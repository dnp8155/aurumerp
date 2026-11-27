import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { BarChart3, Table as TableIcon } from "lucide-react";

const PAYMENT_COLORS = {
  cash: "#10b981", upi: "#3b82f6", card: "#8b5cf6", cheque: "#f59e0b",
  net_banking: "#06b6d4", wallet: "#ec4899", partial: "#f97316",
  pending: "#ef4444", advanced: "#6366f1",
};

const STATUS_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

const PERIOD_LABELS = { day: "Day", month: "Month", year: "Year" };

// Aggregate keys differ by source — PO returns an ISO datetime, Sale a plain
// period — so both are normalized to the selected bucket.
const normalizePeriodKey = (rawKey, period) => {
  const s = String(rawKey || "");
  if (period === "year") return s.substring(0, 4);
  if (period === "month") return s.substring(0, 7);
  return s.split("T")[0];
};

export default function DashboardCharts({ shopId, dateFrom, dateTo }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("day");
  const [viewMode, setViewMode] = useState("graph");
  const [chartDateFrom, setChartDateFrom] = useState("");
  const [chartDateTo, setChartDateTo] = useState("");
  const [salesTrend, setSalesTrend] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [orderStatus, setOrderStatus] = useState([]);
  const [inventoryByStore, setInventoryByStore] = useState([]);

  // The three loaders below are split by what actually changes their data:
  // switching the period re-reads only the trend, changing the date range reads
  // the trend plus the payment split, and the store/order/stock breakdowns load
  // once. That keeps a burst of filter clicks from exhausting the grouped-scan
  // request budget.
  const pendingLoads = useRef(3);
  const markLoaded = useCallback(() => {
    pendingLoads.current = Math.max(0, pendingLoads.current - 1);
    if (pendingLoads.current === 0) setLoading(false);
  }, []);

  // Sales/Purchase trend uses local chart date range if set, else global
  const trendFrom = chartDateFrom || dateFrom || "";
  const trendTo = chartDateTo || dateTo || "";

  const saleQuery = () => {
    const query = {};
    if (shopId) query.store_id = shopId;
    if (trendFrom) query.sale_date = { $gte: trendFrom };
    if (trendTo) query.sale_date = { ...query.sale_date, $lte: trendTo };
    return query;
  };

  // Trend
  useEffect(() => {
    (async () => {
      try {
        const poQuery = {};
        if (shopId) poQuery.store_id = shopId;
        if (trendFrom) poQuery.created_date = { $gte: trendFrom };
        if (trendTo) poQuery.created_date = { ...poQuery.created_date, $lte: trendTo };

        const [trendRes, poRes] = await Promise.all([
          base44.entities.Sale.aggregate({
            dateBucket: { field: "sale_date", unit: period },
            query: saleQuery(),
            sum: "total_amount",
          }),
          base44.entities.PurchaseOrder.aggregate({
            dateBucket: { field: "created_date", unit: period },
            query: poQuery,
            sum: "total_amount",
          }),
        ]);

        const saleMap = {};
        (trendRes?.rows || []).forEach((r) => {
          const key = normalizePeriodKey(r.sale_date || r._id || r.date, period);
          if (key) saleMap[key] = r.sum_total_amount || 0;
        });
        const poMap = {};
        (poRes?.rows || []).forEach((r) => {
          const key = normalizePeriodKey(r.created_date || r._id || r.date || r.sale_date, period);
          if (key) poMap[key] = r.sum_total_amount || 0;
        });

        // Build trend from actual data — last N periods that have any data
        const allKeys = [...new Set([...Object.keys(saleMap), ...Object.keys(poMap)])].sort();
        const maxItems = period === "day" ? 15 : period === "month" ? 12 : 5;
        const recentKeys = allKeys.slice(-maxItems);

        setSalesTrend(recentKeys.map((key) => {
          let label = key;
          if (period === "day") {
            const d = new Date(key);
            label = d.toLocaleDateString("en", { weekday: "short", day: "numeric" });
          } else if (period === "month") {
            const [y, m] = key.split("-");
            const d = new Date(parseInt(y), parseInt(m) - 1, 1);
            label = d.toLocaleDateString("en", { month: "short", year: "2-digit" });
          }
          return { date: key, label, revenue: saleMap[key] || 0, purchase: poMap[key] || 0 };
        }));
      } catch (err) {
        console.error("Chart trend error:", err);
      } finally {
        markLoaded();
      }
    })();
  }, [shopId, dateFrom, dateTo, period, chartDateFrom, chartDateTo, trendFrom, trendTo, markLoaded]);

  // Revenue by payment method
  useEffect(() => {
    (async () => {
      try {
        const paymentRes = await base44.entities.Sale.aggregate({
          groupBy: "payment_method",
          query: saleQuery(),
          sum: "total_amount",
        });
        setPaymentData(
          (paymentRes?.rows || [])
            .filter((r) => r.payment_method)
            .map((r) => ({ name: r.payment_method, value: r.sum_total_amount || 0 }))
            .sort((a, b) => b.value - a.value)
        );
      } catch (err) {
        console.error("Chart payment error:", err);
      } finally {
        markLoaded();
      }
    })();
  }, [shopId, dateFrom, dateTo, chartDateFrom, chartDateTo, trendFrom, trendTo, markLoaded]);

  // Orders by status and inventory by store — re-query when the shop/date filters change
  useEffect(() => {
    (async () => {
      try {
        const orderQuery = {};
        if (shopId) orderQuery.assigned_store_id = shopId;
        if (trendFrom) orderQuery.order_date = { $gte: trendFrom };
        if (trendTo) orderQuery.order_date = { ...orderQuery.order_date, $lte: trendTo };
        const invQuery = shopId ? { store_id: shopId } : {};

        const [orderRes, invRes, stores] = await Promise.all([
          base44.entities.Order.aggregate({ groupBy: "fulfillment_status", query: orderQuery }),
          base44.entities.Inventory.aggregate({ groupBy: "store_id", sum: "quantity", query: invQuery }),
          base44.entities.Store.list("-created_date", 50),
        ]);

        setOrderStatus(
          (orderRes?.rows || [])
            .filter((r) => r.fulfillment_status)
            .map((r) => ({ name: r.fulfillment_status, count: r.count || 0 }))
        );

        const storeMap = {};
        (stores || []).forEach((s) => { storeMap[s.id] = s.name || s.code; });
        setInventoryByStore(
          (invRes?.rows || [])
            .filter((r) => r.store_id)
            .map((r) => ({ name: storeMap[r.store_id] || r.store_id, quantity: r.sum_quantity || 0 }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8)
        );
      } catch (err) {
        console.error("Chart breakdown error:", err);
      } finally {
        markLoaded();
      }
    })();
  }, [shopId, trendFrom, trendTo, markLoaded]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-72 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const hasSalesTrend = salesTrend.some((d) => d.revenue > 0 || d.purchase > 0);
  const hasPayment = paymentData.length > 0;
  const hasOrders = orderStatus.length > 0;
  const hasInventory = inventoryByStore.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Sales & Purchase Trend */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t("dash.sales_trend")}</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {["day", "month", "year"].map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={period === p ? "default" : "outline"}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setPeriod(p)}
                    >
                      {PERIOD_LABELS[p]}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                  <Button
                    size="icon"
                    variant={viewMode === "graph" ? "default" : "ghost"}
                    className="h-6 w-7"
                    onClick={() => setViewMode("graph")}
                    title="Graph View"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant={viewMode === "table" ? "default" : "ghost"}
                    className="h-6 w-7"
                    onClick={() => setViewMode("table")}
                    title="Table View"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">From</span>
                <Input
                  type="date"
                  value={chartDateFrom}
                  onChange={(e) => setChartDateFrom(e.target.value)}
                  className="h-7 w-[140px] text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">To</span>
                <Input
                  type="date"
                  value={chartDateTo}
                  onChange={(e) => setChartDateTo(e.target.value)}
                  className="h-7 w-[140px] text-xs"
                />
              </div>
              {(chartDateFrom || chartDateTo) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setChartDateFrom(""); setChartDateTo(""); }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {hasSalesTrend ? (
            viewMode === "graph" ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="poGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#10b981" }}
                  stroke="#10b981"
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#ef4444" }}
                  stroke="#ef4444"
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(v, name) => {
                    const label = name === "revenue" ? "Sales" : "Purchase";
                    return [`₹${(v || 0).toLocaleString()}`, label];
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => (value === "revenue" ? "Sales" : "Purchase")} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGradient)" />
                <Area yAxisId="right" type="monotone" dataKey="purchase" stroke="#ef4444" strokeWidth={2} fill="url(#poGradient)" />
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <div className="max-h-[220px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right text-emerald-600 font-semibold">Sales (₹)</TableHead>
                      <TableHead className="text-right text-red-600 font-semibold">Purchase (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesTrend.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right text-emerald-700">{(row.revenue || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-700">{(row.purchase || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right text-emerald-700">{salesTrend.reduce((s, r) => s + (r.revenue || 0), 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-700">{salesTrend.reduce((s, r) => s + (r.purchase || 0), 0).toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              {t("dash.no_sales")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue by Payment Method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t("dash.payment_methods")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {hasPayment ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={paymentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {paymentData.map((entry, idx) => (
                    <Cell key={idx} fill={PAYMENT_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => `₹${(v || 0).toLocaleString()}`}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, textTransform: "capitalize" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              {t("dash.no_sales")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders by Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t("dash.order_status")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {hasOrders ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={orderStatus} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {orderStatus.map((_, idx) => (
                    <Cell key={idx} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              {t("dash.no_orders")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory by Store */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t("dash.inventory_by_store")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {hasInventory ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={inventoryByStore} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="quantity" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              {t("dash.no_inventory")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}