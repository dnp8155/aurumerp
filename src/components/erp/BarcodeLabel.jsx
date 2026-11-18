import React from "react";
import BarcodeDisplay from "@/components/erp/BarcodeDisplay";
import { hasSecondBarcode } from "@/lib/barcodeLabels";

export default function BarcodeLabel({ record, quantity = 1 }) {
  if (!record) return null;
  return (
    <div className="print-area flex flex-wrap gap-3 justify-center p-4">
      {Array.from({ length: quantity }).map((_, i) => (
        <div key={i} className="border-2 border-black rounded p-3 w-48 flex flex-col items-center gap-1 bg-white">
          <p className="text-xs font-bold text-center truncate w-full uppercase">{record.product_name}</p>
          <BarcodeDisplay value={record.barcode} label={hasSecondBarcode(record) ? "Current" : undefined} />
          {hasSecondBarcode(record) && <BarcodeDisplay value={record.legacy_barcode} label="Legacy" />}
          <div className="flex justify-between w-full text-[10px] font-mono">
            <span>{record.sku}</span>
            <span className="font-bold">₹{record.price}</span>
          </div>
          {(record.purchase_date || record.vendor_code) && (
            <div className="flex justify-between w-full text-[9px] font-mono">
              <span>{record.purchase_date || ""}</span>
              <span className="font-bold">{record.vendor_code || ""}</span>
            </div>
          )}
          {record.store_name && (
            <p className="text-[9px] text-muted-foreground text-center truncate w-full">{record.store_name}</p>
          )}
        </div>
      ))}
    </div>
  );
}