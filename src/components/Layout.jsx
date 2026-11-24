import React, { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard, Store, Building2, FileText, PackageCheck,
  Tag, Share2, Boxes, Truck, Warehouse, ScrollText, Settings,
  Menu, X, LogOut, ChevronDown, Gem, ShoppingCart, ShoppingBag, Wallet, Sparkles, Barcode, Undo2, CalendarClock, Wrench, Users, GraduationCap, BarChart3, Bell, ScanSearch, FileSpreadsheet, Send, RefreshCw, Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import GlobalSearch from "@/components/erp/GlobalSearch";
import Notifications from "@/components/erp/Notifications";
import AssistantPanel from "@/components/erp/AssistantPanel";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { HelpCircle } from "lucide-react";

const navGroups = [
  {
    labelKey: "nav.group.overview",
    items: [
      { path: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
      { path: "/money", icon: LayoutDashboard, labelKey: "nav.money" }
    ]
  },
  {
    labelKey: "nav.group.procurement",
    items: [
      { path: "/vendors", icon: Building2, labelKey: "nav.vendors" },
      { path: "/purchase-orders", icon: FileText, labelKey: "nav.purchase_orders" }
    ]
  },
  {
    labelKey: "nav.group.cataloging",
    items: [
      { path: "/goods-receipt", icon: PackageCheck, labelKey: "nav.goods_receipt" },
      { path: "/cataloging", icon: Tag, labelKey: "nav.cataloging" },
      { path: "/barcode-engine", icon: Barcode, labelKey: "nav.barcode_engine" },
      { path: "/allocations", icon: Share2, labelKey: "nav.allocations" },
      { path: "/pallets", icon: Boxes, labelKey: "nav.pallets" }
    ]
  },
  {
    labelKey: "nav.group.inventory",
    items: [
      { path: "/inventory", icon: Warehouse, labelKey: "nav.stock_overview" },
      { path: "/warehouse", icon: Boxes, labelKey: "nav.warehouse" },
      { path: "/stores", icon: Store, labelKey: "nav.stores" }
    ]
  },
  {
    labelKey: "nav.group.sales",
    items: [
      { path: "/pos", icon: ShoppingCart, labelKey: "nav.pos" },
      { path: "/returns", icon: Undo2, labelKey: "nav.returns" },
      { path: "/rentals", icon: CalendarClock, labelKey: "nav.rentals" },
      { path: "/repairs", icon: Wrench, labelKey: "nav.repairs" },
      { path: "/ecommerce", icon: ShoppingBag, labelKey: "nav.ecommerce" }
    ]
  },
  {
    labelKey: "nav.group.finance",
    items: [
      { path: "/finance", icon: Wallet, labelKey: "nav.finance_gst" },
      { path: "/gst", icon: Receipt, labelKey: "nav.gst_returns" },
      { path: "/vendor-payouts", icon: Send, labelKey: "nav.vendor_payouts" },
      { path: "/custom-reports", icon: BarChart3, labelKey: "nav.custom_reports" }
    ]
  },
  {
    labelKey: "nav.group.hr",
    items: [
      { path: "/hr", icon: GraduationCap, labelKey: "nav.hr" }
    ]
  },
  {
    labelKey: "nav.group.administration",
    items: [
      { path: "/alerts", icon: Bell, labelKey: "nav.alerts" },
      { path: "/audit-trail", icon: ScrollText, labelKey: "nav.audit_trail" },
      { path: "/settings", icon: Settings, labelKey: "nav.settings" },
      { path: "/tally-export", icon: FileSpreadsheet, labelKey: "nav.tally_export" },
      { path: "/tally-sync", icon: RefreshCw, labelKey: "nav.tally_sync" },
      { path: "/user-roles", icon: Users, labelKey: "nav.user_roles" },
      { path: "/help", icon: HelpCircle, labelKey: "nav.help" },
      { path: "/google-vision", icon: ScanSearch, labelKey: "nav.google_vision" }
    ]
  }
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { logout } = useAuth();
  useKeyboardShortcuts(navigate);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const initials = user?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U";

  const handleLogout = async () => {
    logout(true);
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Gem className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-heading font-bold tracking-tight text-sidebar-foreground">{t("app.name")}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("app.subtitle")}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-hide">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => {
            if (user?.role === "admin") return true;
            if (!user?.module_access) return true;
            return user.module_access.includes(item.path);
          });
          if (visibleItems.length === 0) return null;
          return (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t(group.labelKey)}</p>
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.full_name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("action.account")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              {t("action.sign_out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex justify-center px-4">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setAssistantOpen(true)} className="hidden sm:flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
              <Sparkles className="h-4 w-4" /> {t("action.ask_ai")}
            </button>
            <LanguageSwitcher />
            <Notifications />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  );
}