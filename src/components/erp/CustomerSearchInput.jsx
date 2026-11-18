import React, { useState, useRef, useEffect } from "react";
import { Search, User, Phone, Mail, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";

/**
 * Unified customer search — type name / phone / email / invoice (repair number)
 * and matching customers appear in a dropdown. Selecting one auto-fills the form.
 */
export default function CustomerSearchInput({ customers = [], repairs = [], onSelect, placeholder = "Search by name, phone, email, or invoice #..." }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  // Resolve repair_number → customer_id map for invoice-number search
  const invoiceToCustomer = React.useMemo(() => {
    const map = {};
    repairs.forEach(r => { if (r.customer_id && r.repair_number) map[r.repair_number.toLowerCase()] = r.customer_id; });
    return map;
  }, [repairs]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    // Direct invoice-number match
    const invoiceCustomerId = Object.keys(invoiceToCustomer).find(inv => inv.includes(q));
    const matched = [];
    customers.forEach(c => {
      if (fuzzyMatchAny(query, c.name, c.phone, c.email)) matched.push(c);
    });
    if (invoiceCustomerId && !matched.find(c => c.id === invoiceCustomerId)) {
      const c = customers.find(c => c.id === invoiceCustomerId);
      if (c) matched.push(c);
    }
    return matched.slice(0, 7);
  }, [query, customers, invoiceToCustomer]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (c) => {
    onSelect(c);
    setQuery("");
    setOpen(false);
    setHighlight(0);
  };

  const onKey = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[highlight]) pick(results[highlight]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="pl-10"
      />
      {query && (
        <button type="button" onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
          {results.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              onMouseEnter={() => setHighlight(idx)}
              className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 border-b last:border-0 ${idx === highlight ? "bg-accent" : "hover:bg-accent/50"}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  {c.customer_type && c.customer_type !== "walk_in" && <span className="flex items-center gap-1"><User className="h-3 w-3" />{c.customer_type}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2 text-sm text-muted-foreground">
          No customer found. Fill details manually below.
        </div>
      )}
    </div>
  );
}