import { useEffect } from "react";

export const SHORTCUTS = [
  { key: "Alt+d", path: "/", label: "Dashboard", group: "Overview" },
  { key: "Alt+v", path: "/vendors", label: "Vendors", group: "Procurement" },
  { key: "Alt+p", path: "/purchase-orders", label: "Purchase Orders", group: "Procurement" },
  { key: "Alt+g", path: "/goods-receipt", label: "Goods Receipt & QC", group: "Cataloging" },
  { key: "Alt+c", path: "/cataloging", label: "SKU Cataloging", group: "Cataloging" },
  { key: "Alt+b", path: "/barcode-engine", label: "Barcode Engine", group: "Cataloging" },
  { key: "Alt+i", path: "/inventory", label: "Stock Overview", group: "Inventory" },
  { key: "Alt+s", path: "/stores", label: "Stores", group: "Inventory" },
  { key: "Alt+o", path: "/pos", label: "POS & Billing", group: "Sales" },
  { key: "Alt+r", path: "/returns", label: "Returns", group: "Sales" },
  { key: "Alt+l", path: "/rentals", label: "Rentals", group: "Sales" },
  { key: "Alt+w", path: "/repairs", label: "Repairs", group: "Sales" },
  { key: "Alt+e", path: "/ecommerce", label: "E-commerce", group: "Sales" },
  { key: "Alt+f", path: "/finance", label: "Finance & GST", group: "Finance" },
  { key: "Alt+a", path: "/audit-trail", label: "Audit Trail", group: "Admin" },
  { key: "Alt+t", path: "/settings", label: "Settings", group: "Admin" },
  { key: "Alt+h", path: "/help", label: "Help", group: "Admin" },
];

const shortcutMap = SHORTCUTS.reduce((acc, s) => {
  acc[s.key.toLowerCase()] = s.path;
  return acc;
}, {});

export function useKeyboardShortcuts(navigate) {
  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const key = `alt+${e.key.toLowerCase()}`;
      if (shortcutMap[key]) {
        e.preventDefault();
        navigate(shortcutMap[key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}