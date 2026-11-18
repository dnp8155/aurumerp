import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { syncReferenceImageToGoogle, removeReferenceImageFromGoogle } from "@/lib/visualIdentification";
import { Upload, Trash2, Star, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const IMAGE_TYPES = [
  { value: "front", label: "Front View" },
  { value: "back", label: "Back View" },
  { value: "left", label: "Left Angle" },
  { value: "right", label: "Right Angle" },
  { value: "closeup", label: "Close-up" },
  { value: "angle", label: "Other Angle" },
  { value: "packaging", label: "Packaging / Tag" },
  { value: "other", label: "Other" },
];

/**
 * Manage multiple reference images for a product (used in Cataloging).
 * Props: product (the Product record)
 */
export default function ReferenceImageManager({ product }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [imageType, setImageType] = useState("front");
  const { toast } = useToast();

  useEffect(() => {
    if (product?.id) loadImages();
     
  }, [product?.id]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ProductReferenceImage.filter({ product_id: product.id });
      setImages(data || []);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        const created = await base44.entities.ProductReferenceImage.create({
          product_id: product.id,
          sku: product.sku,
          product_name: product.name,
          image_url: file_url,
          image_type: imageType,
          is_primary: images.length === 0,
          uploaded_by: user?.full_name || user?.email || "system",
          ai_recognition_status: "ready",
          status: "active",
        });
        // Sync to Google Vision Product Search (best-effort, non-blocking)
        syncReferenceImageToGoogle({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          category: product.category,
          imageId: created.id,
          imageUrl: file_url,
        }).catch(err => console.error("Google Vision sync failed:", err));
      }
      toast({ title: `${files.length} reference image(s) added` });
      loadImages();
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (img) => {
    if (!confirm("Delete this reference image?")) return;
    try {
      await base44.entities.ProductReferenceImage.delete(img.id);
      removeReferenceImageFromGoogle({ productId: product.id, imageId: img.id }).catch(() => {});
      toast({ title: "Image deleted" });
      loadImages();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const setPrimary = async (img) => {
    try {
      await base44.entities.ProductReferenceImage.update(img.id, { is_primary: true });
      // unset others
      for (const other of images) {
        if (other.id !== img.id && other.is_primary) {
          await base44.entities.ProductReferenceImage.update(other.id, { is_primary: false });
        }
      }
      loadImages();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const aiReady = images.length >= 3;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Reference Images ({images.length})</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${aiReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {aiReady ? <><Check className="h-3 w-3" /> AI Ready</> : "Needs More Images"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={imageType} onValueChange={setImageType}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMAGE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label>
            <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
            <Button size="sm" asChild disabled={uploading}>
              <span>{uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />} Add</span>
            </Button>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      ) : images.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No reference images yet. Add at least 3 clear images for best AI recognition.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {images.map(img => (
            <div key={img.id} className="relative group rounded-lg border overflow-hidden">
              <img src={img.image_url} alt="" className="h-20 w-full object-cover" />
              <div className="absolute top-1 left-1 flex gap-1">
                {img.is_primary && <span className="rounded bg-amber-400 text-white px-1 text-[9px] font-bold">PRIMARY</span>}
                <span className="rounded bg-black/60 text-white px-1 text-[9px] uppercase">{img.image_type}</span>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {!img.is_primary && (
                  <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => setPrimary(img)} title="Set primary">
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => handleDelete(img)} title="Delete">
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}