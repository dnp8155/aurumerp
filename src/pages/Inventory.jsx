import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Warehouse, RefreshCw, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("all");
  const [agingFilter, setAgingFilter] = useState("all");
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [invData, storeData] = await Promise.all([
        base44.entities.Inventory.list('-created_date', 200),
        base44.entities.Store.list('-created_date', 100),
      ]);
      setInventory(invData || []);
      setStores(storeData || []);
    } catch (err) {
      console.error("Failed to load inventory", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = inventory.filter(item => {
    if (storeFilter !== "all" && item.store_id !== storeFilter) return false;
    if (agingFilter !== "all" && item.aging_status !== agingFilter) return false;
    return true;
  });

  const totalStock = filtered.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalAllocated = filtered.reduce((s, i) => s + (i.allocated_quantity || 0), 0);
  const lowStockCount = filtered.filter(i => i.min_stock_level > 0 && (i.quantity || 0) <= i.min_stock_level).length;
  const redCount = filtered.filter(i => i.aging_status === "red").length;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("stock.overview_title")} description={t("inv.desc")}>
        <Button variant="outline" onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" /> {t("action.refresh")}</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("stock.total")}</p>
          <p className="text-xl font-heading font-bold mt-1">{totalStock.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("stock.allocated")}</p>
          <p className="text-xl font-heading font-bold mt-1 text-violet-600">{totalAllocated.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("inv.low_stock")}</p>
          <p className="text-xl font-heading font-bold mt-1 text-amber-600">{lowStockCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Old Stock (Red)</p>
          <p className="text-xl font-heading font-bold mt-1 text-red-600">{redCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Select value={agingFilter} onValueChange={setAgingFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All aging" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Aging</SelectItem>
            <SelectItem value="green">Fresh (Green)</SelectItem>
            <SelectItem value="amber">Aging (Amber)</SelectItem>
            <SelectItem value="red">Old Stock (Red)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Warehouse} title={t("inv.no_inventory")} description={t("inv.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Min Level</TableHead>
                <TableHead>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const isLow = item.min_stock_level > 0 && (item.quantity || 0) <= item.min_stock_level;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-medium">{item.sku}</TableCell>
                    <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-sm">{item.store_name || "—"}</TableCell>
                    <TableCell><StatusBadge status={item.channel} /></TableCell>
                    <TableCell className={`text-right font-medium ${isLow ? "text-amber-600" : ""}`}>
                      {item.quantity || 0}
                      {isLow && <AlertTriangle className="inline ml-1 h-3 w-3" />}
                    </TableCell>
                    <TableCell className="text-right text-violet-600">{item.allocated_quantity || 0}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{item.min_stock_level || 0}</TableCell>
                    <TableCell><StatusBadge status={item.aging_status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}