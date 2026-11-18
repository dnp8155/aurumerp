import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, RefreshCw, ScanSearch, ImageIcon, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

/**
 * Product Image Scanner — uploads a product photo, AI recognizes it and auto-fills details.
 * Calls the extractProductDetails backend function.
 * Returns the recognized product details to the parent via onProductRecognized.
 */
export default function ProductImageScanner({ onProductRecognized, buttonLabel = "Scan Product", buttonVariant = "outline", className = "" }) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [vertical, setVertical] = useState("Bangles");
  const { toast } = useToast();

  const handleFile = async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const res = await base44.functions.invoke("extractProductDetails", { image_url: file_url, vertical });
      const r = res.data || res;
      if (r.error) {
        toast({ title: "Scan failed", description: r.error, variant: "destructive" });
        setScanning(false);
        return;
      }
      setResult({ ...r, image_url: file_url });
      setScanning(false);
      toast({ title: "✅ Product Recognized!", description: r.matched_existing ? `Matched existing: ${r.match_name}` : r.product_name });
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
      setScanning(false);
    }
  };

  const handleAddToPO = () => {
    if (!result) return;
    onProductRecognized({
      product_name: result.product_name || "",
      vertical: result.vertical || "Art Jewellery",
      category: result.category || "",
      sub_category: result.sub_category || "",
      dominant_color: result.dominant_color || "",
      attributes: {
        material: result.material || "",
        plating: result.plating || "",
        stones: result.stones || "",
        pattern: result.pattern || "",
        finish: result.finish || "",
        bangle_type: result.bangle_type || "",
        size: result.size || "",
        secondary_color: result.secondary_color || "",
        color_hex: result.color_hex || "",
      },
      is_set: result.is_set || false,
      estimated_weight: result.estimated_weight || null,
      image_url: result.image_url || "",
      matched_existing: result.matched_existing || false,
      matched_product_id: result.matched_product_id || null,
      match_confidence: result.match_confidence || 0,
    });
    setOpen(false);
    setPreview(null);
    setResult(null);
  };

  const handleClose = (v) => {
    setOpen(v);
    if (!v) { setPreview(null); setResult(null); setScanning(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} className={className}>
          <ScanSearch className="mr-2 h-4 w-4" /> {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Product Image Scanner
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a product photo — AI will recognize the product and auto-fill name, category, color, material, plating, stones, and more.
          </p>

          <div>
            <Label className="text-xs mb-1">Product Type (for better accuracy)</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={vertical === "Bangles" ? "default" : "outline"} onClick={() => setVertical("Bangles")}>Bangles</Button>
              <Button type="button" size="sm" variant={vertical === "Art Jewellery" ? "default" : "outline"} onClick={() => setVertical("Art Jewellery")}>Art Jewellery</Button>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer hover:border-primary transition-colors">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }} disabled={scanning} />
            {scanning ? (
              <><RefreshCw className="h-8 w-8 text-primary animate-spin" /><span className="text-sm font-medium">AI recognizing product...</span></>
            ) : preview ? (
              <img src={preview} alt="Preview" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <><Upload className="h-8 w-8 text-muted-foreground" /><span className="text-sm font-medium">Click to upload product image</span><span className="text-xs text-muted-foreground">JPG, PNG</span></>
            )}
          </label>

          {result && (
            <div className="rounded-lg border bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Product Recognized
                {result.matched_existing && <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Exact Match ({Math.round(result.match_confidence * 100)}%)</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <DetailField label="Name" value={result.product_name} />
                <DetailField label="Category" value={result.category} />
                <DetailField label="Sub-Category" value={result.sub_category} />
                <DetailField label="Vertical" value={result.vertical} />
                <DetailField label="Color" value={result.dominant_color} />
                <DetailField label="Material" value={result.material} />
                <DetailField label="Plating" value={result.plating} />
                <DetailField label="Stones" value={result.stones} />
                <DetailField label="Pattern" value={result.pattern} />
                <DetailField label="Finish" value={result.finish} />
                <DetailField label="Size" value={result.size} />
                <DetailField label="Is Set" value={result.is_set ? "Yes" : "No"} />
              </div>
              <Button type="button" className="w-full" onClick={handleAddToPO}>
                <ImageIcon className="mr-2 h-4 w-4" /> Add to Purchase Order
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value}</span>
    </div>
  );
}