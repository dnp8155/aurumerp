import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Package, Receipt, ShoppingBag, Building2, Store, Users, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fuzzyMatch, fuzzyScore } from "@/lib/fuzzySearch";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = async (q) => {
    setLoading(true);
    try {
      const [products, sales, orders, vendors, stores, customers] = await Promise.all([
        base44.entities.Product.list('-created_date', 50),
        base44.entities.Sale.list('-created_date', 50),
        base44.entities.Order.list('-created_date', 50),
        base44.entities.Vendor.list('-created_date', 50),
        base44.entities.Store.list('-created_date', 50),
        base44.entities.Customer.list('-created_date', 50),
      ]);
      const fMatch = (str) => fuzzyMatch(q, str);
      const fScore = (...strs) => Math.max(...strs.map(s => fuzzyScore(q, s)));

      const grouped = [];
      const prodMatches = (products || []).filter(p => fMatch(p.name) || fMatch(p.sku))
        .sort((a, b) => fScore(b.name, b.sku) - fScore(a.name, a.sku)).slice(0, 4);
      if (prodMatches.length) grouped.push({ type: "Products", icon: Package, path: "/cataloging", items: prodMatches.map(p => ({ id: p.id, label: p.name, sub: p.sku, path: "/cataloging" })) });

      const saleMatches = (sales || []).filter(s => fMatch(s.sale_number) || fMatch(s.customer_name))
        .sort((a, b) => fScore(b.sale_number, b.customer_name) - fScore(a.sale_number, a.customer_name)).slice(0, 3);
      if (saleMatches.length) grouped.push({ type: "Sales", icon: Receipt, path: "/pos", items: saleMatches.map(s => ({ id: s.id, label: s.sale_number, sub: `₹${(s.total_amount || 0).toLocaleString()} · ${s.customer_name}`, path: "/pos" })) });

      const orderMatches = (orders || []).filter(o => fMatch(o.order_number) || fMatch(o.customer_name))
        .sort((a, b) => fScore(b.order_number, b.customer_name) - fScore(a.order_number, a.customer_name)).slice(0, 3);
      if (orderMatches.length) grouped.push({ type: "Orders", icon: ShoppingBag, path: "/ecommerce", items: orderMatches.map(o => ({ id: o.id, label: o.order_number, sub: `${o.customer_name} · ${o.channel}`, path: "/ecommerce" })) });

      const vendorMatches = (vendors || []).filter(v => fMatch(v.name) || fMatch(v.code))
        .sort((a, b) => fScore(b.name, b.code) - fScore(a.name, a.code)).slice(0, 3);
      if (vendorMatches.length) grouped.push({ type: "Vendors", icon: Building2, path: "/vendors", items: vendorMatches.map(v => ({ id: v.id, label: v.name, sub: v.code || "", path: "/vendors" })) });

      const storeMatches = (stores || []).filter(s => fMatch(s.name) || fMatch(s.code))
        .sort((a, b) => fScore(b.name, b.code) - fScore(a.name, a.code)).slice(0, 3);
      if (storeMatches.length) grouped.push({ type: "Stores", icon: Store, path: "/stores", items: storeMatches.map(s => ({ id: s.id, label: s.name, sub: s.code || "", path: "/stores" })) });

      const custMatches = (customers || []).filter(c => fMatch(c.name) || fMatch(c.phone))
        .sort((a, b) => fScore(b.name, b.phone) - fScore(a.name, a.phone)).slice(0, 3);
      if (custMatches.length) grouped.push({ type: "Customers", icon: Users, path: "/ecommerce", items: custMatches.map(c => ({ id: c.id, label: c.name, sub: c.phone || "", path: "/ecommerce" })) });

      setResults(grouped);
      setActiveIndex(0);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const allItems = results.flatMap(g => g.items.map(i => ({ ...i, groupPath: g.path })));
  const totalResults = allItems.length;

  const handleSelect = (item) => {
    navigate(item.path || item.groupPath);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, totalResults - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && totalResults > 0) {
      handleSelect(allItems[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  let runningIndex = -1;

  return (
    <div ref={containerRef} className="relative flex-1 w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="Search products, sales, orders, vendors..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-8 h-9 bg-muted/50 border-transparent focus-visible:bg-background"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        {query && !loading && (
          <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full mt-2 w-full rounded-lg border bg-popover shadow-lg max-h-[70vh] overflow-y-auto z-50">
          {totalResults === 0 && !loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-2">
              {results.map((group, gi) => (
                <div key={group.type}>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                    <group.icon className="h-3 w-3" /> {group.type}
                  </p>
                  {group.items.map((item) => {
                    runningIndex++;
                    const idx = runningIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className={cn(
                          "w-full flex items-center justify-between rounded-md px-2 py-2 text-left transition-colors",
                          idx === activeIndex ? "bg-accent" : "hover:bg-accent/50"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
                        </div>
                        <group.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}