import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import BarcodeDisplay from "@/components/erp/BarcodeDisplay";
import { hasSecondBarcode } from "@/lib/barcodeLabels";

// Renders barcode labels linked to a PO (by source_transaction = po_number)
// so they appear in the PO print output as a format reference.
// An item prints a second (legacy-system) barcode image only when its stored
// legacy code differs from the current one — see hasSecondBarcode.

export default function POPrintLabels({ poNumber, vendorCode }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!poNumber) { setRecords([]); setLoading(false); return; }
    (async () => {
      try {
        const res = await base44.entities.BarcodeRecord.filter({ source_transaction: poNumber, status: "active" });
        if (active) setRecords(res || []);
      } catch { if (active) setRecords([]); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [poNumber]);

  if (loading) return <div className="text-xs text-muted-foreground">Loading barcode labels...</div>;
  if (!records.length) return <div className="text-xs text-muted-foreground">No barcode labels generated for this PO yet.</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold border-b pb-1">Barcode Labels (Format Reference)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {records.map((r) => (
          <div key={r.id} className="border-2 border-black rounded p-2 flex flex-col items-center gap-1 bg-white">
            <p className="text-[10px] font-bold text-center truncate w-full uppercase">{r.product_name}</p>
            <BarcodeDisplay value={r.barcode} label={hasSecondBarcode(r) ? "Current" : undefined} />
            {hasSecondBarcode(r) && <BarcodeDisplay value={r.legacy_barcode} label="Legacy" />}
            <div className="flex justify-between w-full text-[9px] font-mono">
              <span>{r.sku}</span>
              <span className="font-bold">₹{r.price}</span>
            </div>
            <div className="flex justify-between w-full text-[8px] font-mono">
              <span>{r.purchase_date || ""}</span>
              <span className="font-bold">{r.vendor_code || vendorCode || ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}