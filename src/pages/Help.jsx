import React, { useState } from "react";
import { Keyboard, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/erp/PageHeader";
import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { useI18n } from "@/lib/i18n";

const FEATURE_GUIDES = [
  {
    module: "Dashboard",
    icon: "📊",
    items: [
      "Overview of key metrics — total sales, pending POs, low stock alerts, and active rentals/repairs.",
      "Quick stat cards show real-time counts. Click any card to jump to the relevant page.",
    ]
  },
  {
    module: "Vendors",
    icon: "🏢",
    items: [
      "Register vendors with full billing/shipping address, GST number, bank details, and nickname.",
      "Each vendor can have a Calculation Rule and default collection/party code for barcode generation.",
      "Vendor outstanding amount tracks unpaid purchase orders.",
    ]
  },
  {
    module: "Purchase Orders",
    icon: "📄",
    items: [
      "Create POs with vendor pricing rules — automatic markup calculation or manual selling price override.",
      "GST auto-calculated: intra-state (CGST+SGST) or inter-state (IGST) based on vendor vs company state.",
      "For Bangle products: select unit as Box, Dozen, or Nos — quantity and price auto-convert (1 Box = 12 Nos).",
      "On submission: inventory updates immediately, barcodes generate in batch (grouped by product).",
      "Price override audits are logged automatically when you manually change the selling price.",
    ]
  },
  {
    module: "Goods Receipt & QC",
    icon: "📦",
    items: [
      "Receive goods against approved POs with quality check.",
      "Verify quantities, inspect quality, and update inventory on receipt.",
    ]
  },
  {
    module: "SKU Cataloging",
    icon: "🏷️",
    items: [
      "Catalog products with dynamic attributes per category (color, weight, material, stone, etc.).",
      "AI photo recognition: upload product image → auto-extract product details and dominant color.",
      "Products can be individual items or sets (e.g., bangle set with components).",
      "Status flow: Draft → Cataloged → Active → Discontinued.",
    ]
  },
  {
    module: "Barcode Engine",
    icon: "🔢",
    items: [
      "Global barcode architecture: Product Code + Short Code + Collection/Party + Store + Part No.",
      "Calculation Rules define multiplier, divisor, and rounding for P-value generation.",
      "Barcodes auto-generate on PO submission, grouped by product in the result summary.",
      "Barcode masters: Product Master, Party Master (collection codes), Store Master (B-codes).",
    ]
  },
  {
    module: "Stock Overview",
    icon: "🏭",
    items: [
      "View inventory across all stores or filter by specific store.",
      "Track available, reserved, allocated, sold, returned, and damaged quantities.",
      "Aging status (Green/Amber/Red) shows how long stock has been sitting.",
      "Set minimum stock levels for reorder alerts.",
    ]
  },
  {
    module: "POS & Billing",
    icon: "🛒",
    items: [
      "Search products by name or scan barcode to add to cart.",
      "Prices are GST-inclusive by default — the selling price includes GST.",
      "Payment methods: Cash, UPI, Cheque (with name + number), Card, Partial (cash + other), Pending, Advanced.",
      "Card payments above ₹50,000 require customer phone number (GST compliance).",
      "AI photo scan: upload product photo to auto-identify and add to cart.",
      "WhatsApp invoice: send bill directly to customer's WhatsApp number.",
      "Returns: process returns from POS with reason dropdown and refund handling.",
    ]
  },
  {
    module: "Returns",
    icon: "↩️",
    items: [
      "Search returns by customer name, mobile number, or invoice number.",
      "Refund methods: Cash, Adjust in New Bill, Credit Note, Cheque, UPI, Bank Transfer.",
      "Credit Notes auto-generate (CN-XXXX) — customer can use balance in future purchases.",
      "Return reasons: Damaged, Wrong Product, Quality Issue, Customer Changed Mind, Other.",
      "Original purchase date shown alongside invoice number in the returns table.",
      "Inventory auto-restocked when return is processed.",
    ]
  },
  {
    module: "Rentals",
    icon: "📅",
    items: [
      "Set start and end date WITH time — e.g., 22 Sep 10:00 AM to 25 Sep 2:00 PM.",
      "Rental duration auto-calculated from the date+time (partial days round up).",
      "Line items with rate per day/week/month/fixed — charges auto-calculate from duration.",
      "Security deposit tracked per item. On return: late fee + damage charge calculated.",
      "Return processing: actual return date+time, late fee, damage charge, deposit refund.",
    ]
  },
  {
    module: "Repairs",
    icon: "🔧",
    items: [
      "Two modes: 'Our Product' (from catalog) or 'Other Product' (external items).",
      "Other Product mode: manual customer name + phone, product image upload, product name.",
      "Technician name AND phone number both captured.",
      "Receipt auto-generated on creation — print or send via WhatsApp to customer.",
      "Status flow: Received → Diagnosing → In Progress → Awaiting Parts → Ready → Delivered.",
      "Update repair with labor charge, parts cost, technician notes, and advance payment.",
    ]
  },
  {
    module: "E-commerce",
    icon: "🌐",
    items: [
      "Sync orders from Shopify, Amazon, website, or manual entry.",
      "Track fulfillment status: Pending → Confirmed → Packed → Dispatched → Delivered.",
      "Assign orders to specific stores for fulfillment.",
    ]
  },
  {
    module: "Finance & GST",
    icon: "💰",
    items: [
      "GST registration management — multiple state registrations supported.",
      "Auto-calculation of CGST/SGST (intra-state) vs IGST (inter-state) based on party states.",
      "Vendor and customer outstanding tracking.",
      "Tally sync integration for accounting export.",
    ]
  },
  {
    module: "Audit Trail",
    icon: "📜",
    items: [
      "Tracks all create/update/delete actions across entities.",
      "Filter by user, entity type, or date range.",
      "Essential for compliance and accountability.",
    ]
  },
  {
    module: "Settings",
    icon: "⚙️",
    items: [
      "Configure app preferences, GST registrations, and payment configurations.",
      "Manage calculation rules for barcode generation.",
      "Tally sync settings and marketplace integrations.",
    ]
  },
  {
    module: "AI Assistant",
    icon: "✨",
    items: [
      "Click 'Ask AI' in the top bar to open the assistant panel.",
      "Ask questions about your data — sales, inventory, vendors, etc.",
      "The assistant can help with reports, analysis, and guidance.",
    ]
  },
];

const SHORTCUT_GROUPS = ["Overview", "Procurement", "Cataloging", "Inventory", "Sales", "Finance", "Admin"];

export default function Help() {
  const { t } = useI18n();
  const [expandedModule, setExpandedModule] = useState(null);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <PageHeader title={t("help.title")} description={t("help.desc")} />

      <Tabs defaultValue="shortcuts" className="mt-6">
        <TabsList>
          <TabsTrigger value="shortcuts"><Keyboard className="mr-2 h-4 w-4" /> Keyboard Shortcuts</TabsTrigger>
          <TabsTrigger value="guide"><BookOpen className="mr-2 h-4 w-4" /> Feature Guide</TabsTrigger>
        </TabsList>

        {/* Keyboard Shortcuts Tab */}
        <TabsContent value="shortcuts" className="mt-4">
          <div className="rounded-lg border p-4 bg-muted/30 mb-4">
            <p className="text-sm text-muted-foreground">
              Press <kbd className="px-2 py-0.5 rounded bg-background border text-xs font-mono">Alt</kbd> + the key shown below to navigate to any page instantly.
              Works anywhere in the app — even while typing in input fields.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SHORTCUT_GROUPS.map((group) => {
              const groupShortcuts = SHORTCUTS.filter(s => s.group === group);
              if (groupShortcuts.length === 0) return null;
              return (
                <div key={group} className="rounded-xl border">
                  <div className="px-4 py-3 border-b bg-muted/50">
                    <p className="text-sm font-semibold">{group}</p>
                  </div>
                  <div className="divide-y">
                    {groupShortcuts.map((s) => (
                      <div key={s.key} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm">{s.label}</span>
                        <kbd className="px-2.5 py-1 rounded-md bg-muted border text-xs font-mono font-medium">
                          {s.key.replace("Alt+", "Alt + ")}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Feature Guide Tab */}
        <TabsContent value="guide" className="mt-4">
          <div className="space-y-2">
            {FEATURE_GUIDES.map((guide) => {
              const isExpanded = expandedModule === guide.module;
              return (
                <div key={guide.module} className="rounded-xl border overflow-hidden">
                  <button
                    onClick={() => setExpandedModule(isExpanded ? null : guide.module)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-xl">{guide.icon}</span>
                    <span className="flex-1 text-sm font-semibold">{guide.module}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-2">
                      {guide.items.map((item, i) => (
                        <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}