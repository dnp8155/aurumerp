import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Camera, Loader2, Upload, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function PosPhotoScan({ open, onClose, onProductMatched, availableProducts }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [vertical, setVertical] = useState("Bangles");
  const fileRef = useRef(null);
  const { toast } = useToast();

  const reset = () => {
    setImagePreview(null);
    setImageUrl(null);
    setResult(null);
    setScanning(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setImageUrl(file_url);
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const handleScan = async () => {
    if (!imageUrl) {
      toast({ title: "Upload a photo first", variant: "destructive" });
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("extractProductDetails", {
        image_url: imageUrl,
        vertical,
      });

      // If matched an existing product, find it in available products
      if (res.matched_existing && res.matched_product_id) {
        const matched = availableProducts.find(p => p.id === res.matched_product_id);
        if (matched) {
          // AUTO-ADD to cart immediately
          onProductMatched(matched);
          toast({
            title: res.likely_match ? "Likely match added to cart" : "Product matched & added to cart",
            description: `${matched.name} (${Math.round(res.match_confidence * 100)}% match)`
          });
          handleClose();
        } else {
          // Matched but not in stock
          setResult({ type: "matched_no_stock", product: res, confidence: res.match_confidence });
        }
      } else {
        console.info("Photo scan: no exact match found", res);
        setResult(null);
      }
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Scan Product Photo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vertical selector */}
          <div className="flex gap-2">
            <Button
              variant={vertical === "Bangles" ? "default" : "outline"}
              size="sm"
              onClick={() => setVertical("Bangles")}
            >
              Bangles
            </Button>
            <Button
              variant={vertical === "Art Jewellery" ? "default" : "outline"}
              size="sm"
              onClick={() => setVertical("Art Jewellery")}
            >
              Art Jewellery
            </Button>
          </div>

          {/* Upload area */}
          {!imagePreview ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload product photo</p>
              <p className="text-xs text-muted-foreground mt-1">AI will recognize and add to cart</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={reset}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Scan button */}
          {imagePreview && !result && (
            <Button className="w-full" onClick={handleScan} disabled={scanning || !imageUrl}>
              {scanning ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI Recognizing...</>
              ) : (
                <><Camera className="mr-2 h-4 w-4" /> Recognize Product</>
              )}
            </Button>
          )}

          {/* Result */}
          {result?.type === "matched_no_stock" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Product recognized but out of stock</span>
              </div>
              <p className="text-sm">{result.product.product_name}</p>
              <p className="text-xs text-muted-foreground">This product is not in current inventory.</p>
            </div>
          )}


        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}