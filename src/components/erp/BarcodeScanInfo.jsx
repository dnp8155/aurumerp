import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { scanBarcode } from "@/lib/barcodeEngine";
import { Search, Package, IndianRupee, Calendar, Building2, Store, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

/**
 * Barcode scan quick-info panel.
 * Scan/type a barcode → matches a Product → shows selling price, purchase date,
 * vendor code/name, and store-wise available stock (from Inventory).
 *
 * Reuses the `barcodeEngine` backend function (scan action) to resolve the
 * barcode, then loads the matching Product + its Inventory records.
 */
export default function BarcodeScanInfo({ defaultBarcode = "" }) {
  const [barcode, setBarcode] = useState(defaultBarcode);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleScan = async (value) => {
    const code = (value ?? barcode).trim();
    if (!code) return;
    setLoading(true);
    setError("");
    setInfo(null);
    try {
      // 1. Resolve barcode via barcodeEngine scan action
      let matchedProduct = null;
      let barcodeRecord = null;
      try {
        const result = await scanBarcode(code);
        barcodeRecord = result.record || null;
      } catch {
        // barcode not in BarcodeRecord — that's fine, try direct product match
      }

      // 2. Match a Product — by barcode field first, then by sku from barcode record
      const byBarcode = await base44.entities.Product.filter({ barcode: code });
      if (byBarcode && byBarcode.length > 0) {
        matchedProduct = byBarcode[0];
      } else if (barcodeRecord?.sku) {
        const bySku = await base44.entities.Product.filter({ sku: barcodeRecord.sku });
        if (bySku && bySku.length > 0) matchedProduct = bySku[0];
      } else if (barcodeRecord?.product_name) {
        const byName = await base44.entities.Product.filter({ name: barcodeRecord.product_name });
        if (byName && byName.length > 0) matchedProduct = byName[0];
      }

      // 3. Load store-wise inventory for the matched product (if one exists)
      let locations = [];
      let totalStock = 0;
      if (matchedProduct) {
        const inv = await base44.entities.Inventory.filter({ product_id: matchedProduct.id });
        locations = (inv || [])
          .filter((i) => (i.quantity || 0) > 0)
          .map((i) => ({ store_name: i.store_name || "—", quantity: i.quantity || 0 }));
        totalStock = locations.reduce((s, l) => s + l.quantity, 0);
      }

      if (!matchedProduct && !barcodeRecord) {
        setError("No product found for this barcode");
        toast({ title: "Not found", description: code, variant: "destructive" });
        return;
      }

      setInfo({
        product: matchedProduct,
        barcodeRecord,
        locations,
        totalStock,
      });
    } catch (err) {
      setError(err.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Search className="h-4 w-4" /> Scan Product for Quick Info
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="Scan or type barcode..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            className="flex-1"
          />
          <Button onClick={() => handleScan()} disabled={loading || !barcode.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Scan
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {info && (
        <div className="p-4 space-y-4">
          {/* Product / Barcode header */}
          <div className="flex items-start gap-3">
            {info.product?.images?.[0] ? (
              <img src={info.product.images[0]} alt="" className="h-16 w-16 rounded-lg object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border">
                <Package className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{info.product?.name || info.barcodeRecord?.product_name || "Unknown Product"}</p>
              <p className="text-xs text-muted-foreground font-mono">{info.product?.sku || info.barcodeRecord?.sku || "—"}</p>
              {info.barcodeRecord && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Barcode: {info.barcodeRecord.barcode}</p>
              )}
              {!info.product && info.barcodeRecord && (
                <p className="text-[10px] text-amber-600 mt-0.5">No Product catalog entry — showing barcode record</p>
              )}
            </div>
          </div>

          {/* Quick info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoTile icon={IndianRupee} label="Selling Price" value={info.product ? `₹${(info.product.selling_price || 0).toLocaleString()}` : (info.barcodeRecord?.price ? `₹${info.barcodeRecord.price}` : "—")} accent="emerald" />
            <InfoTile
              icon={Calendar}
              label="Purchase Date"
              value={info.product?.purchase_date ? format(new Date(info.product.purchase_date), "dd MMM yyyy") : (info.barcodeRecord?.purchase_date ? format(new Date(info.barcodeRecord.purchase_date), "dd MMM yyyy") : "—")}
              accent="blue"
            />
            <InfoTile
              icon={Building2}
              label="Vendor Code"
              value={info.product?.vendor_id ? (info.product.vendor_name || info.product.vendor_id) : (info.barcodeRecord?.vendor_code || info.barcodeRecord?.vendor_name || "—")}
              accent="violet"
            />
          </div>

          {/* Store-wise stock */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5" /> Store-wise Availability
              </h4>
              <span className="text-xs font-bold">Total: {info.totalStock}</span>
            </div>
            {info.locations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center rounded-lg bg-muted/50">{info.product ? "Out of stock across all stores" : "No inventory tracked (no Product catalog entry)"}</p>
            ) : (
              <div className="space-y-1.5">
                {info.locations.map((l, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-muted-foreground" />
                      {l.store_name}
                    </span>
                    <span className="font-bold">{l.quantity} pcs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, accent }) {
  const accents = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <div className={`rounded-lg border p-3 ${accents[accent] || "bg-muted"}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80 mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="text-sm font-bold truncate">{value}</p>
    </div>
  );
}