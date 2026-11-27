import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/sales", labelKey: "nav.sales" },
  { to: "/stock", labelKey: "nav.stock" },
  { to: "/vendors", labelKey: "nav.vendors" },
  { to: "/returns", labelKey: "nav.returns" },
  { to: "/hr", labelKey: "nav.staff" },
  { to: "/money", labelKey: "nav.money" },
];

export default function TopTabBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  return (
    <nav className="flex items-center gap-1 px-4 lg:px-6 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => {
        const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(tab.labelKey)}
            {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full" style={{ background: "#A07941" }} />}
          </Link>
        );
      })}
    </nav>
  );
}