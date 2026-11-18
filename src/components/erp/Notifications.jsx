import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell, PackageCheck, AlertTriangle, ShoppingBag, Wallet, Truck, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadReminders, describeReminders, REMINDER_ICONS } from "@/lib/reminders";
import { useI18n } from "@/lib/i18n";

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { loadAlerts(); }, [lang]);

  const loadAlerts = async () => {
    try {
      const [receipts, inventory, orders, expenses, shipments, products] = await Promise.all([
        base44.entities.GoodsReceipt.list('-created_date', 50),
        base44.entities.Inventory.list('-created_date', 100),
        base44.entities.Order.list('-created_date', 50),
        base44.entities.Expense.list('-created_date', 50),
        base44.entities.Shipment.list('-created_date', 20),
        base44.entities.Product.list('-created_date', 50),
      ]);

      const list = [];
      const pendingQC = (receipts || []).filter(r => r.status === "pending_qc" || r.status === "qc_in_progress").length;
      if (pendingQC > 0) list.push({ icon: PackageCheck, color: "amber", title: `${pendingQC} receipts pending QC`, path: "/goods-receipt" });

      const lowStock = (inventory || []).filter(i => (i.quantity || 0) <= (i.min_stock_level || 0) && i.min_stock_level > 0).length;
      if (lowStock > 0) list.push({ icon: AlertTriangle, color: "red", title: `${lowStock} products low on stock`, path: "/inventory" });

      const outOfStock = (inventory || []).filter(i => (i.quantity || 0) === 0).length;
      if (outOfStock > 0) list.push({ icon: Boxes, color: "red", title: `${outOfStock} products out of stock`, path: "/inventory" });

      const pendingOrders = (orders || []).filter(o => o.fulfillment_status === "pending" || o.fulfillment_status === "confirmed").length;
      if (pendingOrders > 0) list.push({ icon: ShoppingBag, color: "blue", title: `${pendingOrders} online orders pending fulfillment`, path: "/ecommerce" });

      const pendingExp = (expenses || []).filter(e => e.status === "pending").length;
      if (pendingExp > 0) list.push({ icon: Wallet, color: "amber", title: `${pendingExp} expenses pending approval`, path: "/finance" });

      const inTransit = (shipments || []).filter(s => s.status === "dispatched" || s.status === "in_transit").length;
      if (inTransit > 0) list.push({ icon: Truck, color: "violet", title: `${inTransit} shipments in transit`, path: "/pallets" });

      const draftProducts = (products || []).filter(p => p.status === "draft").length;
      if (draftProducts > 0) list.push({ icon: PackageCheck, color: "blue", title: `${draftProducts} products waiting to be cataloged`, path: "/cataloging" });

      const discrepancies = (receipts || []).filter(r => r.status === "discrepancy").length + (shipments || []).filter(s => s.status === "discrepancy").length;
      if (discrepancies > 0) list.push({ icon: AlertTriangle, color: "red", title: `${discrepancies} discrepancies need attention`, path: "/audit-trail" });

      const reminders = await loadReminders();
      const reminderItems = describeReminders(reminders, t).map(r => ({
        icon: REMINDER_ICONS[r.key] || AlertTriangle,
        color: r.level === "critical" ? "red" : r.level === "warning" ? "amber" : "blue",
        title: r.title,
        path: r.path,
      }));

      setAlerts([...reminderItems, ...list]);
    } catch (err) {
      console.error("Notifications error:", err);
    } finally {
      setLoading(false);
    }
  };

  const colorMap = {
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors"
      >
        <Bell className="h-4.5 w-4.5 text-foreground" />
        {alerts.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover shadow-lg z-50">
          <div className="flex items-center justify-between border-b p-3">
            <p className="text-sm font-semibold">Notifications</p>
            {alerts.length > 0 && <span className="text-xs text-muted-foreground">{alerts.length} alerts</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
            ) : alerts.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                  <Bell className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-0.5">No pending alerts</p>
              </div>
            ) : (
              <div className="p-2">
                {alerts.map((alert, i) => (
                  <button
                    key={i}
                    onClick={() => { navigate(alert.path); setOpen(false); }}
                    className="w-full flex items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-accent transition-colors"
                  >
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", colorMap[alert.color])}>
                      <alert.icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-foreground">{alert.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}