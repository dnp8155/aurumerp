import React, { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserCheck, Search, AlertCircle, UserX, Settings } from "lucide-react";
import { useCustomerLookup } from "@/hooks/useCustomerLookup";

// Phone input with automatic customer lookup.
// Props:
//  - value, onChange: controlled phone value
//  - onResolved(customer): called with { name, email, address, source } when a match is found
//  - label, required: field config
export default function CustomerPhoneLookup({ value, onChange, onResolved, label = "Phone", required = false }) {
  const { status, data, error } = useCustomerLookup(value);

  // Notify parent whenever a resolution arrives/changes for this number.
  useEffect(() => {
    if (status === "found" && data) {
      onResolved?.(data);
    }
  }, [status, data, onResolved]);

  return (
    <div>
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="10-digit mobile number"
          inputMode="tel"
          maxLength={13}
        />
        {status === "loading" && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {status === "found" && (
          <UserCheck className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}
        {status === "not_found" && (
          <UserX className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        {status === "error" && (
          <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
        )}
        {status === "unconfigured" && (
          <Settings className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
        )}
      </div>
      {status === "loading" && (
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Search className="h-3 w-3" /> Looking up customer…
        </p>
      )}
      {status === "found" && data && (
        <p className="text-[11px] text-green-700 mt-1">
          {data.source === "database" ? "Existing customer" : data.source === "cache" ? "Saved customer" : "Found via lookup"} — {data.name}
          {data.email ? ` · ${data.email}` : ""}
        </p>
      )}
      {status === "not_found" && (
        <p className="text-[11px] text-muted-foreground mt-1">No name found — enter manually.</p>
      )}
      {status === "unconfigured" && (
        <p className="text-[11px] text-amber-600 mt-1">
          Lookup not configured — add API key in Dashboard → Secrets. Customer DB lookup still works.
        </p>
      )}
      {status === "error" && (
        <p className="text-[11px] text-destructive mt-1">{error || "Lookup failed"}</p>
      )}
    </div>
  );
}