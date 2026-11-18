import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Tag, Plus, Pencil, Eye, Upload, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import StatusBadge from "@/components/erp/StatusBadge";
import BarcodeDisplay from "@/components/erp/BarcodeDisplay";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import ReferenceImageManager from "@/components/erp/ReferenceImageManager";
import { syncReferenceImageToGoogle } from "@/lib/visualIdentification";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import useFormDirty from "@/hooks/useFormDirty";
import NextStepDialog from "@/components/erp/NextStepDialog";

export default function Cataloging() {
  const [products, setProducts] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [inventoryMap, setInventoryMap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [editing, setEditing] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nextStep, setNextStep] = useState(null);
  const [form, setForm] = useState({
    sku: "", name: "", goods_receipt_id: "", vertical: "Bangles", category: "", subcategory: "",
    attributes: {}, images: [], videos: [], dominant_color: "",
    cost_price: 0, selling_price: 0, mrp: 0, weight: 0, status: "active"
  });
  const { toast } = useToast();
  const { t } = useI18n();
  const skuDirty = useFormDirty(dialogOpen, form);

  const stockByProduct = useMemo(() => {
    const map = {};
    inventoryMap.forEach(i => {
      map[i.product_id] = (map[i.product_id] || 0) + (i.quantity || 0);
    });
    return map;
  }, [inventoryMap]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [prodData, attrData, receiptData, invData] = await Promise.all([
        base44.entities.Product.list('-created_date', 100),
        base44.entities.AttributeDefinition.list('display_order', 100),
        base44.entities.GoodsReceipt.filter({ status: "qc_completed" }),
        base44.entities.Inventory.list('-created_date', 500),
      ]);
      const inv = invData || [];
      setInventoryMap(inv);
      // Auto-mark active products with 0 total stock as inactive (Stock over → Inactive)
      const stockByProd = {};
      inv.forEach(i => {
        stockByProd[i.product_id] = (stockByProd[i.product_id] || 0) + (i.quantity || 0);
      });
      const outOfStockActive = (prodData || []).filter(p => p.status === "active" && (stockByProd[p.id] || 0) <= 0);
      if (outOfStockActive.length > 0) {
        await base44.entities.Product.bulkUpdate(outOfStockActive.map(p => ({ id: p.id, status: "inactive" })));
        outOfStockActive.forEach(p => { p.status = "inactive"; });
      }
      setProducts(prodData || []);
      setAttributes(attrData || []);
      setReceipts(receiptData || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      sku: "", name: "", goods_receipt_id: "", vertical: "Bangles", category: "", subcategory: "",
      attributes: {}, images: [], videos: [], dominant_color: "",
      cost_price: 0, selling_price: 0, mrp: 0, weight: 0, status: "active"
    });
  };

  const handleEdit = (product) => {
    setEditing(product);
    setForm({ ...product, attributes: product.attributes || {}, images: product.images || [], videos: product.videos || [] });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
          return file_url;
        })
      );
      setForm(prev => ({ ...prev, images: [...(prev.images || []), ...uploaded] }));
      toast({ title: `${uploaded.length} image(s) uploaded` });
      // Auto-trigger AI analysis on first image upload
      if (uploaded.length > 0 && (form.images || []).length === 0) {
        runAutoFill(uploaded[0]);
      }
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const runAutoFill = async (imageUrl) => {
    setAutoFilling(true);
    try {
      const response = await base44.functions.invoke('extractProductDetails', {
        image_url: imageUrl,
        vertical: form.vertical || "Bangles"
      });
      const r = response.data || response;
      if (r.error) {
        toast({ title: "AI Auto-Fill failed", description: r.error, variant: "destructive" });
      } else {
        setForm(prev => ({
          ...prev,
          name: r.product_name || prev.name,
          vertical: r.vertical || prev.vertical,
          category: r.category || prev.category,
          subcategory: r.sub_category || prev.subcategory,
          dominant_color: r.dominant_color || prev.dominant_color,
          is_set: r.is_set ?? prev.is_set,
          weight: r.estimated_weight || prev.weight,
          attributes: {
            ...prev.attributes,
            ...(r.material && { Material: r.material }),
            ...(r.plating && { Plating: r.plating }),
            ...(r.bangle_type && { "Bangle Type": r.bangle_type }),
            ...(r.stones && { Stones: r.stones }),
            ...(r.pattern && { Pattern: r.pattern }),
            ...(r.finish && { Finish: r.finish }),
            ...(r.size && { Size: r.size }),
            ...(r.secondary_color && { "Secondary Color": r.secondary_color }),
          }
        }));
        if (r.matched_existing) {
          toast({
            title: "✅ Exact Match Found!",
            description: `Matched existing SKU: ${r.matched_sku} (${Math.round((r.match_confidence || 0) * 100)}% confidence). All details auto-filled from saved record.`
          });
        } else {
          toast({
            title: "AI Auto-Fill complete",
            description: `${Math.round((r.confidence || 0) * 100)}% confidence — review & edit before saving`
          });
        }
      }
    } catch (err) {
      toast({ title: "Auto-Fill failed", description: err.message, variant: "destructive" });
    } finally {
      setAutoFilling(false);
    }
  };

  const autoFillDetails = () => {
    if (!form.images?.[0]) {
      toast({ title: "Upload an image first", variant: "destructive" });
      return;
    }
    runAutoFill(form.images[0]);
  };

  const detectColor = async () => {
    if (!form.images?.[0]) {
      toast({ title: "Upload an image first", variant: "destructive" });
      return;
    }
    setDetecting(true);
    try {
      const response = await base44.functions.invoke('detectProductColor', { image_url: form.images[0] });
      const result = response.data || response;
      if (result.primary_color) {
        setForm(prev => ({ ...prev, dominant_color: result.primary_color }));
        toast({ title: `Detected: ${result.primary_color}`, description: result.color_hex });
      } else {
        toast({ title: "Could not detect color", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Detection failed", description: err.message, variant: "destructive" });
    } finally {
      setDetecting(false);
    }
  };

  const handleAttributeChange = (attrName, value) => {
    setForm(prev => ({ ...form, attributes: { ...prev.attributes, [attrName]: value } }));
  };

  const addAttributeValue = (attrName, newValue) => {
    setAttributes(prev => prev.map(a =>
      a.name === attrName ? { ...a, values: [...(a.values || []), newValue] } : a
    ));
    handleAttributeChange(attrName, newValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const sku = form.sku || `SKU-${Date.now().toString().slice(-8)}`;
      const barcode = `SLB${sku.replace(/[^A-Z0-9]/gi, '').padEnd(10, '0')}`;
      const payload = { ...form, sku, barcode };

      const savedProduct = editing
        ? await base44.entities.Product.update(editing.id, payload)
        : await base44.entities.Product.create(payload);
      const productId = editing ? editing.id : savedProduct?.id;
      toast({ title: editing ? "SKU updated" : "SKU created", description: `SKU: ${sku}` });
      if (!editing) setNextStep({ key: "cataloging" });

      // Auto-sync product images as AI reference images (pattern generate + store)
      if (productId && (form.images || []).length > 0) {
        const user = await base44.auth.me().catch(() => null);
        let existingRefs = [];
        try {
          existingRefs = await base44.entities.ProductReferenceImage.filter({ product_id: productId });
        } catch (e) { /* none yet */ }
        const existingUrls = new Set((existingRefs || []).map(r => r.image_url));
        let synced = 0;
        for (const imgUrl of form.images) {
          if (existingUrls.has(imgUrl)) continue;
          try {
            const ref = await base44.entities.ProductReferenceImage.create({
              product_id: productId,
              sku,
              product_name: form.name,
              image_url: imgUrl,
              image_type: "front",
              is_primary: synced === 0,
              uploaded_by: user?.full_name || user?.email || "system",
              ai_recognition_status: "processing",
              status: "active",
            });
            // Sync to Google Vision (pattern generate + store) — best-effort, non-blocking
            syncReferenceImageToGoogle({
              productId, productName: form.name, sku, category: form.category,
              imageId: ref.id, imageUrl: imgUrl,
            }).then(() => {
              base44.entities.ProductReferenceImage.update(ref.id, { ai_recognition_status: "ready" });
            }).catch(err => {
              console.error("Google Vision sync failed:", err);
              base44.entities.ProductReferenceImage.update(ref.id, { ai_recognition_status: "failed" });
            });
            synced++;
          } catch (e) { /* skip */ }
        }
        if (synced > 0) {
          toast({ title: `${synced} reference image(s) syncing to AI`, description: "Pattern generate ho raha hai — ~30 min mein searchable" });
        }
      }

      setDialogOpen(false);
      setEditing(null);
      resetForm();
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleStatusChange = async (product, newStatus) => {
    try {
      await base44.entities.Product.update(product.id, { status: newStatus });
      toast({ title: `Marked as ${newStatus}` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("cat.title")} description={t("cat.desc")}>
        <ConfirmCloseDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); resetForm(); } }} isDirty={skuDirty}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New SKU</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit SKU" : "Create New SKU"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SKU Code</Label>
                  <Input value={editing ? form.sku : "Auto-generated on save"} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Product Name *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Vertical</Label>
                  <Select value={form.vertical} onValueChange={v => setForm({ ...form, vertical: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bangles">Bangles</SelectItem>
                      <SelectItem value="Art Jewellery">Art Jewellery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Bangles, Rings" />
                </div>
                <div>
                  <Label>Subcategory</Label>
                  <Input value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Link to Goods Receipt (QC Completed)</Label>
                <Select value={form.goods_receipt_id} onValueChange={v => setForm({ ...form, goods_receipt_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional — select receipt" /></SelectTrigger>
                  <SelectContent>
                    {receipts.length === 0 ? <SelectItem value={null} disabled>No QC-completed receipts</SelectItem> :
                      receipts.map(r => <SelectItem key={r.id} value={r.id}>{r.receipt_number} — {r.vendor_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Product Images</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(form.images || []).map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt="" className="h-20 w-20 rounded-lg object-cover border" />
                      <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed hover:border-primary transition-colors">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    {uploading ? <div className="h-5 w-5 border-2 border-muted border-t-primary rounded-full animate-spin" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 p-3">
                <Wand2 className="h-5 w-5 text-violet-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-violet-900">AI Auto-Fill Details</p>
                  <p className="text-xs text-violet-700">Analyze image & auto-fill name, category, color, material, plating, stones, pattern & more</p>
                </div>
                <Button type="button" size="sm" onClick={autoFillDetails} disabled={autoFilling || !form.images?.length} className="bg-violet-600 hover:bg-violet-700">
                  {autoFilling ? (
                    <><div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing...</>
                  ) : (
                    <><Wand2 className="h-3.5 w-3.5" /> Auto-Fill All</>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium">Color Only</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={detectColor} disabled={detecting || !form.images?.length}>
                  {detecting ? "..." : "Detect Color"}
                </Button>
              </div>
              {form.dominant_color && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Detected Color:</span>
                  <span className="font-medium">{form.dominant_color}</span>
                </div>
              )}

              <div>
                <Label>Attributes</Label>
                <div className="space-y-3 rounded-lg border p-3">
                  {attributes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No attribute definitions. Add them in Settings.</p>
                  ) : (
                    attributes.map((attr) => (
                      <AttributeField key={attr.name} attr={attr} value={form.attributes?.[attr.name] || ""} onChange={(v) => handleAttributeChange(attr.name, v)} onAddNew={(v) => addAttributeValue(attr.name, v)} />
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div><Label>Cost Price (₹)</Label><Input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: Number(e.target.value) })} /></div>
                <div><Label>Selling Price (₹)</Label><Input type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: Number(e.target.value) })} /></div>
                <div><Label>MRP (₹)</Label><Input type="number" value={form.mrp} onChange={e => setForm({ ...form, mrp: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Weight (grams)</Label><Input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: Number(e.target.value) })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{editing ? "Update SKU" : "Create SKU"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </ConfirmCloseDialog>
      </PageHeader>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : products.length === 0 ? (
        <EmptyState icon={Tag} title={t("cat.no_products")} description={t("cat.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-medium">{p.sku}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><Tag className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{p.category || "—"}</TableCell>
                  <TableCell className="text-sm">{p.dominant_color || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">₹{(p.selling_price || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">
                    {(stockByProduct[p.id] || 0) > 0 ? (stockByProduct[p.id]) : <span className="text-red-600 font-medium">0</span>}
                  </TableCell>
                  <TableCell>
                    <Select value={p.status} onValueChange={v => handleStatusChange(p, v)}>
                      <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewProduct(p)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SKU Details — {viewProduct?.sku}</DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              {(viewProduct.images || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewProduct.images.map((img, i) => (
                    <img key={i} src={img} alt="" className="h-24 w-24 rounded-lg object-cover border" />
                  ))}
                </div>
              )}
              <div className="flex justify-center py-2">
                <BarcodeDisplay value={viewProduct.barcode} label="Product Barcode" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{viewProduct.name}</span></div>
                <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{viewProduct.category || "—"}</span></div>
                <div><span className="text-muted-foreground">Color:</span> <span className="font-medium">{viewProduct.dominant_color || "—"}</span></div>
                <div><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{viewProduct.weight || 0}g</span></div>
                <div><span className="text-muted-foreground">Cost:</span> <span className="font-medium">₹{(viewProduct.cost_price || 0).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Selling:</span> <span className="font-medium">₹{(viewProduct.selling_price || 0).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">MRP:</span> <span className="font-medium">₹{(viewProduct.mrp || 0).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewProduct.status} /></div>
              </div>
              {viewProduct.attributes && Object.keys(viewProduct.attributes).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Attributes</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(viewProduct.attributes).map(([k, v]) => (
                      <span key={k} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                        <span className="text-muted-foreground mr-1">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t pt-4">
                <ReferenceImageManager product={viewProduct} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}

function AttributeField({ attr, value, onChange, onAddNew }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const handleAddCustom = () => {
    if (customValue.trim()) {
      onAddNew(customValue.trim());
      setCustomValue("");
      setShowCustom(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Label className="w-32 text-xs shrink-0">{attr.name}{attr.is_required ? " *" : ""}</Label>
      <div className="flex-1 flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {(attr.values || []).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {attr.allow_custom && (
          showCustom ? (
            <div className="flex gap-1">
              <Input className="h-8 text-xs w-32" placeholder="New value" value={customValue} onChange={e => setCustomValue(e.target.value)} />
              <Button type="button" size="sm" variant="outline" onClick={handleAddCustom}>Add</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowCustom(false)}>×</Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCustom(true)}>
              <Plus className="h-3 w-3" /> New
            </Button>
          )
        )}
      </div>
    </div>
  );
}