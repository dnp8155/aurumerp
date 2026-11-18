import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Boxes, PackageCheck, AlertTriangle, HeartCrack, Send, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function StockOverview() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, allocated: 0, damaged: 0, lowStock: 0 });
  const [nonMoving, setNonMoving] = useState([]);

  useEffect(() => {
    loadStockOverview();
  }, []);

  const loadStockOverview = async () => {
    try {
      const [aggResult, lowStockCandidates, nonMovingPage] = await Promise.all([
        base44.entities.Inventory.aggregate({ sum: ["quantity", "allocated_quantity", "damaged_quantity"] }),
        base44.entities.Inventory.filter({ min_stock_level: { $gt: 0 } }, { limit: 500, fields: ["quantity", "min_stock_level", "sku", "product_name", "store_name"] }),
        base44.entities.Inventory.filter({ quantity: { $gt: 0 }, sold_quantity: 0 }, { sort: "-quantity", limit: 8, fields: ["sku", "product_name", "quantity", "store_name", "store_id", "product_id"] }),
      ]);

      const aggRow = (aggResult?.rows?.[0]) || {};
      const lowStockCount = (lowStockCandidates?.items || []).filter(i => (i.quantity || 0) <= (i.min_stock_level || 0)).length;

      setTotals({
        total: aggRow.sum_quantity || 0,
        allocated: aggRow.sum_allocated_quantity || 0,
        damaged: aggRow.sum_damaged_quantity || 0,
        lowStock: lowStockCount,
      });
      setNonMoving((nonMovingPage?.items || []));
    } catch (err) {
      console.error("Stock overview error:", err);
    } finally {
      setLoading(false);
    }
  };

  const tiles = [
    { label: t("stock.total"), value: totals.total, icon: Boxes, accent: "blue" },
    { label: t("stock.allocated"), value: totals.allocated, icon: PackageCheck, accent: "violet" },
    { label: t("stock.low_review"), value: totals.lowStock, icon: AlertTriangle, accent: "amber" },
    { label: t("stock.damaged"), value: totals.damaged, icon: HeartCrack, accent: "red" },
  ];

  const accentClasses = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">{t("stock.overview_title")}</CardTitle>
        <Link to="/inventory">
          <Button variant="ghost" size="sm" className="text-xs">{t("action.view_all")} <ArrowRight className="ml-1 h-3 w-3" /></Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {tiles.map((tile, idx) => (
            <div key={idx} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${accentClasses[tile.accent]}`}>
                  <tile.icon className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
              </div>
              <p className="mt-2 text-xl font-heading font-bold tracking-tight">
                {loading ? "—" : tile.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t("stock.non_moving")}</p>
          {loading ? (
            <div className="h-20 rounded-lg bg-muted animate-pulse" />
          ) : nonMoving.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("stock.no_non_moving")}</p>
          ) : (
            <div className="space-y-2">
              {nonMoving.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.product_name || item.sku}</p>
                    <p className="text-xs text-muted-foreground">{item.store_name} · {t("stock.qty")}: {item.quantity}</p>
                  </div>
                  <Link
                    to={`/allocations?product_id=${item.product_id || ""}&sku=${item.sku || ""}`}
                    className="ml-3 shrink-0"
                  >
                    <Button variant="outline" size="sm" className="text-xs h-7">
                      <Send className="mr-1 h-3 w-3" /> {t("stock.send_to_store")}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}