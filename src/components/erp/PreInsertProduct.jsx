import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, RefreshCw, Library, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

/**
 * Pre-insert Product — add a product with image to the reference library
 * so the AI scanner can identify it later during Purchase Order scanning.
 */
export default function PreInsertProduct({ className = "", onSaved }) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [vertical, setVertical] = useState("Bangles");
  const [form, setForm] = useState({
    name: "", category: "", sub_category: "", dominant_color: "",
    material: "", plating: "", stones: "", pattern: "", finish: "",
    size: "", is_set: false, weight: null, sku: "",
  });
  const { toast } = useToast();

  const reset = () => {
    setPreview(null); setImageUrl(""); setScanning(false); setSaving(false);
    setForm({ name: "", category: "", sub_category: "", dominant_color: "", material: "", plating: "", stones: "", pattern: "", finish: "", size: "", is_set: false, weight: null, sku: "" });
  };

  const handleFile = async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setImageUrl(file_url);
      const res = await base44.functions.invoke("extractProductDetails", { image_url: file_url, vertical });
      const r = res.data || res;
      if (r.error) {
        toast({ title: "AI extraction failed", description: r.error, variant: "destructive" });
        setScanning(false);
        return;
      }
      setForm({
        name: r.product_name || "",
        category: r.category || "",
        sub_category: r.sub_category || "",
        dominant_color: r.dominant_color || "",
        material: r.material || "",
        plating: r.plating || "",
        stones: r.stones || "",
        pattern: r.pattern || "",
        finish: r.finish || "",
        size: r.size || "",
        is_set: r.is_set || false,
        weight: r.estimated_weight || null,
        sku: "",
      });
      if (r.vertical) setVertical(r.vertical);
      setScanning(false);
      toast({ title: "✅ Details auto-filled", description: "Review and save to reference library" });
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: "Product name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const sku = form.sku || `REF-${Date.now().toString().slice(-6)}`;
      await base44.entities.Product.create({
        sku,
        name: form.name,
        vertical,
        category: form.category || "General",
        sub_category: form.sub_category || "",
        dominant_color: form.dominant_color || "",
        images: imageUrl ? [imageUrl] : [],
        attributes: {
          material: form.material, plating: form.plating, stones: form.stones,
          pattern: form.pattern, finish: form.finish, size: form.size,
        },
        is_set: form.is_set,
        weight: form.weight || null,
        status: "active",
      });
      toast({ title: "✅ Pre-inserted", description: `${form.name} added to reference library` });
      reset();
      setOpen(false);
      if (onSaved) onSaved();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleClose = (v) => {
    setOpen(v);
    if (!v) reset();
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Library className="mr-2 h-4 w-4" /> Pre-insert Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" /> Pre-insert Product (Reference Library)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add a product with its photo to the reference library. When you scan this product during Purchase Order creation, the AI will identify it and auto-fill all details.
          </p>

          <div>
            <Label className="text-xs mb-1">Product Type</Label>
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
              <><Upload className="h-8 w-8 text-muted-foreground" /><span className="text-sm font-medium">Click to upload product image</span><span className="text-xs text-muted-foreground">AI will auto-fill details</span></>
            )}
          </label>

          {form.name && (
            <div className="rounded-lg border bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> AI Extracted — Review & Edit
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-8" /></Field>
                <Field label="SKU (optional)"><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Auto-generated" className="h-8" /></Field>
                <Field label="Category"><Input value={form.category} onChange={(e) => set("category", e.target.value)} className="h-8" /></Field>
                <Field label="Sub-Category"><Input value={form.sub_category} onChange={(e) => set("sub_category", e.target.value)} className="h-8" /></Field>
                <Field label="Color"><Input value={form.dominant_color} onChange={(e) => set("dominant_color", e.target.value)} className="h-8" /></Field>
                <Field label="Material"><Input value={form.material} onChange={(e) => set("material", e.target.value)} className="h-8" /></Field>
                <Field label="Plating"><Input value={form.plating} onChange={(e) => set("plating", e.target.value)} className="h-8" /></Field>
                <Field label="Stones"><Input value={form.stones} onChange={(e) => set("stones", e.target.value)} className="h-8" /></Field>
                <Field label="Pattern"><Input value={form.pattern} onChange={(e) => set("pattern", e.target.value)} className="h-8" /></Field>
                <Field label="Finish"><Input value={form.finish} onChange={(e) => set("finish", e.target.value)} className="h-8" /></Field>
                <Field label="Size"><Input value={form.size} onChange={(e) => set("size", e.target.value)} className="h-8" /></Field>
                <Field label="Weight (g)"><Input type="number" value={form.weight || ""} onChange={(e) => set("weight", e.target.value ? Number(e.target.value) : null)} className="h-8" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_set} onChange={(e) => set("is_set", e.target.checked)} />
                Is a Set (multiple pieces)
              </label>
              <Button type="button" className="w-full" onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save to Reference Library"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs mb-1">{label}</Label>
      {children}
    </div>
  );
}