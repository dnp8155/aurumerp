import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { generateBarcode } from "@/lib/barcodeEngine";
import { ArrowLeft, Plus, X, Barcode, Calculator, RefreshCw, ScanLine, Upload, ChevronDown, ChevronUp, AlertCircle, Edit3, UserPlus, Printer, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BarcodeDisplay from "@/components/erp/BarcodeDisplay";
import ProductImageScanner from "@/components/erp/ProductImageScanner";
import PreInsertProduct from "@/components/erp/PreInsertProduct";
import VendorForm from "@/components/erp/VendorForm";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import { useToast } from "@/components/ui/use-toast";
import { executePricingRule, formatRuleSteps, OPERATIONS } from "@/lib/pricingEngine";
import { detectGstType, calculateItemGst, calculatePoGst, formatPricingType, GST_RATES } from "@/lib/gstUtils";
import { calcTotalNos, calcItemTotalPrice, calcPerNosPrice, isBanglesProduct, DOZENS_PER_BOX_OPTIONS } from "@/lib/unitConversion";

const createEmptyItem = () => ({
  product_code: "", product_name: "", short_code: "", quantity: 1, unit: "nos", total_price: 0, unit_price: 0,
  pricing_mode: "automatic", calculated_price: 0, manual_override_price: null, final_price: 0,
  override_reason: "", gst_rate: 3, gst_amount: 0, gst_pricing_type: "exclusive", taxable_amount: 0,
  selling_price: 0, dozens_per_box: 4, vertical: "",
});

export default function PurchaseOrderCreate() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [stores, setStores] = useState([]);
  const [barcodeProducts, setBarcodeProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingBarcodes, setGeneratingBarcodes] = useState(false);
  const [activePricingRule, setActivePricingRule] = useState(null);
  const [activeCollection, setActiveCollection] = useState("");
  const [canOverride, setCanOverride] = useState(false);
  const [viewCalcIdx, setViewCalcIdx] = useState(null);
  const [barcodeResults, setBarcodeResults] = useState([]);
  const [showBarcodes, setShowBarcodes] = useState(false);
  const [overrideIdx, setOverrideIdx] = useState(null);
  const [overridePrice, setOverridePrice] = useState(0);
  const [overrideReason, setOverrideReason] = useState("");
  const [gstRegistrations, setGstRegistrations] = useState([]);
  const [selectedGstRegId, setSelectedGstRegId] = useState("");
  const [gstType, setGstType] = useState("intra");
  const [vendorGstPricingType, setVendorGstPricingType] = useState("exclusive");
  const [scanning, setScanning] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [vendorDirty, setVendorDirty] = useState(false);
  const [nextStep, setNextStep] = useState(null);
  const [form, setForm] = useState({
    po_number: "", vendor_id: "", store_id: "", expected_delivery: "", notes: "",
    items: [createEmptyItem()], total_amount: 0,
  });
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [vendorData, storeData, productData, user, gstRegs, productRecords] = await Promise.all([
        base44.entities.Vendor.filter({ status: "active" }),
        base44.entities.Store.list("-created_date", 100),
        base44.entities.BarcodeProductMaster.filter({ status: "active" }),
        base44.auth.me().catch(() => null),
        base44.entities.GstRegistration.filter({ status: "active" }),
        base44.entities.Product.list("-created_date", 500),
      ]);
      setVendors(vendorData || []);
      setStores(storeData || []);
      setBarcodeProducts(productData || []);
      setProducts(productRecords || []);
      setGstRegistrations(gstRegs || []);
      const defaultReg = (gstRegs || []).find(g => g.is_default) || (gstRegs || [])[0];
      if (defaultReg) setSelectedGstRegId(defaultReg.id);
      setCanOverride(user?.role === "admin" || user?.role === "ho");
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVendorChange = async (vendorId) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    setForm((prev) => ({ ...prev, vendor_id: vendorId }));

    const vPricingType = vendor?.gst_pricing_type || "exclusive";
    setVendorGstPricingType(vPricingType);
    const itemsWithPricingType = form.items.map((item) => ({
      ...item,
      gst_pricing_type: item.gst_pricing_type && item.gst_pricing_type !== "exclusive" ? item.gst_pricing_type : vPricingType,
    }));

    setActiveCollection(vendor?.default_collection_code || "");

    const defaultReg = (gstRegistrations || []).find(g => g.id === selectedGstRegId) || (gstRegistrations || []).find(g => g.is_default);
    const companyState = defaultReg?.state || "";
    const vendorState = vendor?.billing_address_state || "";
    const detected = detectGstType(vendorState, companyState);
    setGstType(detected);

    try {
      const pricingRules = await base44.entities.VendorPricingRule.filter({ vendor_id: vendorId, is_active: true });
      const rule = pricingRules?.[0] || null;
      setActivePricingRule(rule);
      recalcItems(itemsWithPricingType, rule, detected);
    } catch {
      setActivePricingRule(null);
      recalcItems(itemsWithPricingType, null, detected);
    }
  };

  const recalcItems = (items, pricingRule, gType = gstType) => {
    const updated = items.map((item) => {
      let calculatedPrice = 0;
      if (pricingRule) {
        const calcResult = executePricingRule(item.unit_price || 0, pricingRule.steps);
        calculatedPrice = calcResult.valid ? calcResult.price : 0;
      }
      const finalPrice = item.pricing_mode === "manual_override" ? (item.manual_override_price || 0) : calculatedPrice;
      const itemGst = calculateItemGst(item.total_price || 0, item.gst_rate || 0, gType, item.gst_pricing_type || "exclusive");
      return { ...item, calculated_price: calculatedPrice, final_price: finalPrice, gst_amount: itemGst.total_gst_amount, taxable_amount: itemGst.taxable_amount };
    });
    setForm((prev) => ({ ...prev, items: updated }));
  };

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };

    if (field === "product_code") {
      const product = barcodeProducts.find((p) => p.product_code === value);
      items[idx].product_name = product?.product_name || "";
      items[idx].short_code = product?.short_code || "";
      const productRecord = products.find((p) => p.sku === value);
      if (productRecord?.gst_rate != null) items[idx].gst_rate = productRecord.gst_rate;
      const isBangles = isBanglesProduct(value, product?.product_name, products);
      items[idx].vertical = isBangles ? "Bangles" : "Art Jewellery";
      if (!isBangles && (items[idx].unit === "dozen" || items[idx].unit === "box")) {
        items[idx].unit = "nos";
      }
    }
    if (field === "unit" && value === "box" && !items[idx].dozens_per_box) {
      items[idx].dozens_per_box = 4;
    }

    if (field === "quantity" || field === "unit_price" || field === "gst_rate" || field === "unit" || field === "gst_pricing_type" || field === "dozens_per_box") {
      items[idx].total_price = calcItemTotalPrice(items[idx]);
      const itemGst = calculateItemGst(items[idx].total_price || 0, items[idx].gst_rate || 0, gstType, items[idx].gst_pricing_type || "exclusive");
      items[idx].gst_amount = itemGst.total_gst_amount;
      items[idx].taxable_amount = itemGst.taxable_amount;
      if (activePricingRule) {
        const calcResult = executePricingRule(items[idx].unit_price || 0, activePricingRule.steps);
        items[idx].calculated_price = calcResult.valid ? calcResult.price : 0;
        if (items[idx].pricing_mode !== "manual_override") items[idx].final_price = items[idx].calculated_price;
      } else {
        items[idx].calculated_price = 0;
        if (items[idx].pricing_mode !== "manual_override") items[idx].final_price = items[idx].unit_price || 0;
      }
    }
    const total = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
    setForm({ ...form, items, total_amount: total });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, createEmptyItem()] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const startOverride = (idx) => {
    setOverrideIdx(idx);
    setOverridePrice(form.items[idx].final_price || form.items[idx].calculated_price || 0);
    setOverrideReason("");
  };

  const applyOverride = () => {
    if (!overrideReason.trim()) { toast({ title: "Reason required", description: "Please provide a reason for the override", variant: "destructive" }); return; }
    const items = [...form.items];
    items[overrideIdx] = { ...items[overrideIdx], pricing_mode: "manual_override", manual_override_price: overridePrice, final_price: overridePrice, override_reason: overrideReason };
    setForm({ ...form, items });
    setOverrideIdx(null);
    toast({ title: "Price overridden", description: `Final price set to ₹${overridePrice}` });
  };

  const removeOverride = (idx) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], pricing_mode: "automatic", manual_override_price: null, final_price: items[idx].calculated_price || 0, override_reason: "" };
    setForm({ ...form, items });
  };

  const generateBarcodes = async (poNumber, items) => {
    const results = [];
    for (const item of items) {
      if (!item.product_code || !item.unit_price) continue;
      const qty = Math.max(1, Math.floor(calcTotalNos(item)) || 1);
      try {
        const priceForBarcode = item.selling_price || item.final_price || item.unit_price || 0;
        const vendor = vendors.find((v) => v.id === form.vendor_id);
        const r = await generateBarcode({
          product_code: item.product_code, price: priceForBarcode,
          collection_code: activeCollection, quantity: qty,
          persist: true, purchase_date: new Date().toISOString().split("T")[0], source_transaction: poNumber,
          vendor_code: vendor?.code || "", vendor_name: vendor?.name || "",
        });
        const createdRecords = r.records || [];
        for (const rec of createdRecords) {
          results.push({
            product: item.product_name, barcode: rec?.barcode, success: true,
            selling_price: rec?.price || priceForBarcode,
            purchase_date: rec?.purchase_date || new Date().toISOString().split("T")[0],
            vendor_code: rec?.vendor_code || "",
            vendor_name: rec?.vendor_name || "",
          });
        }
      } catch (err) {
        results.push({ product: item.product_name, error: err.message, success: false });
      }
    }
    return results;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor_id || !form.store_id) { toast({ title: "Error", description: "Select vendor and store", variant: "destructive" }); return; }
    try {
      const vendor = vendors.find((v) => v.id === form.vendor_id);
      const store = stores.find((s) => s.id === form.store_id);
      const poNumber = form.po_number || `PO-${Date.now().toString().slice(-8)}`;
      const user = await base44.auth.me().catch(() => null);

      const itemsWithPricing = form.items.map((item) => ({
        ...item,
        pricing_rule_id: activePricingRule?.id || "",
        pricing_rule_version: activePricingRule?.version_number || null,
        override_user: item.pricing_mode === "manual_override" ? (user?.full_name || user?.email || "Unknown") : "",
        calculation_timestamp: new Date().toISOString(),
      }));

      const gstBreakdown = calculatePoGst(itemsWithPricing, gstType);
      const selectedReg = (gstRegistrations || []).find(g => g.id === selectedGstRegId);
      const vendorGstNumber = vendor?.gst_number || "";
      const companyGstNumber = selectedReg?.gst_number || "";

      setGeneratingBarcodes(true);
      const po = await base44.entities.PurchaseOrder.create({
        ...form, items: itemsWithPricing, po_number: poNumber,
        vendor_name: vendor?.name || "", store_name: store?.name || "", status: "approved",
        vendor_gst_number: vendorGstNumber,
        vendor_gst_pricing_type: vendorGstPricingType,
        company_gst_registration_id: selectedGstRegId || "",
        company_gst_number: companyGstNumber,
        gst_type: gstType,
        subtotal_before_gst: gstBreakdown.subtotal_before_gst,
        cgst_amount: gstBreakdown.cgst_amount,
        sgst_amount: gstBreakdown.sgst_amount,
        igst_amount: gstBreakdown.igst_amount,
        total_gst_amount: gstBreakdown.total_gst_amount,
        tax_amount: gstBreakdown.total_gst_amount,
        total_with_gst: gstBreakdown.total_with_gst,
        total_amount: gstBreakdown.total_with_gst,
        payable_amount: gstBreakdown.total_with_gst,
      });

      const pendingImages = form._pending_images || [];
      for (const item of itemsWithPricing) {
        if (!item.product_code && !item.product_name) continue;
        const pendingImg = pendingImages.find((p) => p.product_name === item.product_name);
        let product;
        if (item.product_code) {
          const existingProducts = await base44.entities.Product.filter({ sku: item.product_code });
          if (existingProducts.length > 0) {
            product = existingProducts[0];
            if (pendingImg) {
              await base44.entities.Product.update(product.id, {
                images: [...(product.images || []), pendingImg.image_url].filter(Boolean),
                dominant_color: pendingImg.dominant_color || product.dominant_color,
                attributes: { ...(product.attributes || {}), ...pendingImg.attributes },
              });
            }
          } else {
            product = await base44.entities.Product.create({
              sku: item.product_code, name: item.product_name || item.product_code,
              vertical: pendingImg?.vertical || "Art Jewellery",
              category: pendingImg?.category || "General",
              sub_category: pendingImg?.sub_category || "",
              dominant_color: pendingImg?.dominant_color || "",
              images: pendingImg ? [pendingImg.image_url] : [],
              attributes: pendingImg?.attributes || {},
              is_set: pendingImg?.is_set || false,
              weight: pendingImg?.estimated_weight || null,
              status: "active",
              cost_price: item.final_price || item.unit_price || 0, selling_price: item.selling_price || item.final_price || item.unit_price || 0,
              vendor_id: form.vendor_id, vendor_name: vendor?.name || "",
            });
          }
        } else {
          product = await base44.entities.Product.create({
            sku: `AI-${Date.now().toString().slice(-6)}`, name: item.product_name,
            vertical: pendingImg?.vertical || "Art Jewellery",
            category: pendingImg?.category || "General",
            sub_category: pendingImg?.sub_category || "",
            dominant_color: pendingImg?.dominant_color || "",
            images: pendingImg ? [pendingImg.image_url] : [],
            attributes: pendingImg?.attributes || {},
            is_set: pendingImg?.is_set || false,
            weight: pendingImg?.estimated_weight || null,
            status: "active",
            cost_price: item.final_price || item.unit_price || 0, selling_price: item.selling_price || item.final_price || item.unit_price || 0,
            vendor_id: form.vendor_id, vendor_name: vendor?.name || "",
          });
          item.product_code = product.sku;
        }
        const nos = calcTotalNos(item);
        const existingInv = await base44.entities.Inventory.filter({ product_id: product.id, store_id: form.store_id });
        if (existingInv.length > 0) {
          await base44.entities.Inventory.update(existingInv[0].id, {
            quantity: (existingInv[0].quantity || 0) + nos,
            last_received_date: new Date().toISOString(),
          });
        } else {
          await base44.entities.Inventory.create({
            product_id: product.id, sku: product.sku, product_name: product.name,
            store_id: form.store_id, store_name: store?.name || "",
            quantity: nos, last_received_date: new Date().toISOString(),
          });
        }
      }

      for (let i = 0; i < itemsWithPricing.length; i++) {
        const item = itemsWithPricing[i];
        if (item.pricing_mode === "manual_override") {
          await base44.entities.PriceOverrideAudit.create({
            purchase_order_id: po.id, po_number: poNumber, vendor_id: form.vendor_id, vendor_name: vendor?.name || "",
            item_index: i, item_description: item.product_name || "", buy_price: item.unit_price || 0,
            pricing_rule_id: activePricingRule?.id || "", pricing_rule_version: activePricingRule?.version_number || null,
            calculated_price: item.calculated_price || 0, manual_price: item.manual_override_price || 0,
            difference: (item.manual_override_price || 0) - (item.calculated_price || 0),
            override_user: user?.full_name || user?.email || "Unknown", override_reason: item.override_reason,
          });
        }
      }

      const bResults = await generateBarcodes(poNumber, itemsWithPricing);
      const successCount = bResults.filter((r) => r.success).length;
      const failCount = bResults.filter((r) => !r.success).length;

      if (successCount > 0 && failCount === 0) toast({ title: "PO created & barcodes generated", description: `${successCount} barcodes auto-generated` });
      else if (successCount > 0 && failCount > 0) toast({ title: "PO created (partial barcodes)", description: `${successCount} generated, ${failCount} failed`, variant: "destructive" });
      else {
        const firstError = bResults.find((r) => !r.success)?.error || "No items with valid product code + price";
        toast({ title: "PO created — Barcodes failed", description: firstError, variant: "destructive" });
      }

      setBarcodeResults(bResults);
      setShowBarcodes(true);
      setForm({ po_number: "", vendor_id: "", store_id: "", expected_delivery: "", notes: "", items: [createEmptyItem()], total_amount: 0, _pending_images: [] });
      setActivePricingRule(null); setActiveCollection(""); setGstType("intra"); setVendorGstPricingType("exclusive");
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setGeneratingBarcodes(false); }
  };

  const handleProductRecognized = (recognized) => {
    const newItem = {
      ...createEmptyItem(),
      product_name: recognized.product_name,
      product_code: recognized.matched_existing ? recognized.matched_product_id : "",
      quantity: 1,
      unit: recognized.vertical === "Bangles" ? "dozen" : "nos",
      vertical: recognized.vertical || "",
    };
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
      _pending_images: [...(prev._pending_images || []), { product_name: recognized.product_name, image_url: recognized.image_url, attributes: recognized.attributes, vertical: recognized.vertical, category: recognized.category, sub_category: recognized.sub_category, dominant_color: recognized.dominant_color, is_set: recognized.is_set, estimated_weight: recognized.estimated_weight }],
    }));
    toast({ title: "✅ Product Added", description: recognized.matched_existing ? `Matched: ${recognized.product_name}` : recognized.product_name });
  };

  const handleScanBill = async (file) => {
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const res = await base44.functions.invoke("extractBillDetails", { image_url: file_url });
      const r = res.data || res;
      if (r.error) { toast({ title: "Scan failed", description: r.error, variant: "destructive" }); return; }
      const matchedVendor = vendors.find((v) => v.name.toLowerCase().includes((r.vendor_name || "").toLowerCase()) || (r.vendor_gst && v.gst_number === r.vendor_gst));
      const items = (r.items || []).map((item) => ({ ...createEmptyItem(), product_name: item.description || "", quantity: item.quantity || 1, unit_price: item.unit_price || 0, total_price: item.total_price || 0 }));
      setForm({
        po_number: r.bill_number || "", vendor_id: matchedVendor?.id || "", store_id: form.store_id || "",
        expected_delivery: r.due_date || "", notes: r.notes || `Scanned from bill: ${r.vendor_name || ""}`,
        items: items.length > 0 ? items : [createEmptyItem()], total_amount: r.grand_total || r.subtotal || 0,
      });
      if (matchedVendor) handleVendorChange(matchedVendor.id);
      setScanOpen(false);
      toast({ title: "✅ Bill Scanned!", description: `${r.vendor_name || "Vendor"} — ₹${(r.grand_total || 0).toLocaleString()} — ${(r.items || []).length} items. Review & submit.` });
    } catch (err) { toast({ title: "Scan failed", description: err.message, variant: "destructive" }); }
    finally { setScanning(false); }
  };

  const handleVendorCreated = (newVendor) => {
    setVendors((prev) => [...prev, newVendor]);
    setAddVendorOpen(false);
    handleVendorChange(newVendor.id);
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Purchase Order</h1>
            <p className="text-sm text-muted-foreground">Vendor pricing rules auto-apply, barcodes auto-generate on submit</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <PreInsertProduct onSaved={() => loadData()} />
          <ProductImageScanner buttonLabel="Scan Product" buttonVariant="outline" onProductRecognized={handleProductRecognized} />
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine className="mr-2 h-4 w-4" /> Scan Bill
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Top Section: Vendor + Location */}
        <div className="rounded-xl border p-5 space-y-4 bg-card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Vendor *</Label>
              <div className="flex gap-2">
                <Select value={form.vendor_id} onValueChange={handleVendorChange}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.nickname ? `${v.name} (${v.nickname})` : v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setAddVendorOpen(true)} className="whitespace-nowrap">
                  <UserPlus className="mr-1 h-4 w-4" /> Add Vendor
                </Button>
              </div>
            </div>
            <div>
              <Label>Receiving Location *</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {form.vendor_id && (() => {
            const v = vendors.find((x) => x.id === form.vendor_id);
            if (!v) return null;
            return (
              <div className="rounded-lg border bg-slate-50/60 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Building2 className="h-4 w-4" /> Vendor Details
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">GST Number</p><p className="font-mono font-medium">{v.gst_number || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Contact Person</p><p className="font-medium">{v.contact_person || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{v.phone || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium truncate">{v.email || "—"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Billing Address</p><p className="font-medium">{[v.billing_address_line1, v.billing_address_line2, v.billing_address_area].filter(Boolean).join(", ") || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">City</p><p className="font-medium">{v.billing_address_city || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">State</p><p className="font-medium">{v.billing_address_state || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Pincode</p><p className="font-mono font-medium">{v.billing_address_pincode || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">GST Mode</p><p className="font-medium">{v.gst_pricing_type === "inclusive" ? "Inclusive" : "Exclusive"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Vendor Code</p><p className="font-mono font-medium">{v.code || "—"}</p></div>
                </div>
              </div>
            );
          })()}

          <div>
            <Label>Company GST Registration</Label>
            <Select value={selectedGstRegId} onValueChange={(v) => {
              setSelectedGstRegId(v);
              const reg = (gstRegistrations || []).find(g => g.id === v);
              const vendor = vendors.find((vd) => vd.id === form.vendor_id);
              if (reg && vendor) { const gType = detectGstType(vendor.billing_address_state, reg.state); setGstType(gType); recalcItems(form.items, activePricingRule, gType); }
            }}>
              <SelectTrigger><SelectValue placeholder="Select GST registration" /></SelectTrigger>
              <SelectContent>{gstRegistrations.map((g) => <SelectItem key={g.id} value={g.id}>{g.registration_name} ({g.gst_number})</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {form.vendor_id && (
            <div className={`rounded-lg border p-3 flex items-center gap-2 ${vendorGstPricingType === "inclusive" ? "border-violet-300 bg-violet-50" : "border-blue-300 bg-blue-50"}`}>
              <Calculator className={`h-4 w-4 ${vendorGstPricingType === "inclusive" ? "text-violet-600" : "text-blue-600"}`} />
              <span className="text-sm">
                <strong>Vendor GST Mode: {formatPricingType(vendorGstPricingType)}</strong>
                <span className="text-muted-foreground ml-2">— default for all items. Change per-item using the "GST Mode" dropdown if needed.</span>
              </span>
            </div>
          )}

          {form.vendor_id && !activeCollection && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <span className="text-sm text-blue-700">No collection code set for this vendor — barcodes will auto-provision a collection from the vendor code. Set <strong>Default Collection Code</strong> on the vendor for a custom code.</span>
            </div>
          )}

          {activePricingRule ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
                <Calculator className="h-4 w-4" /> Auto-Applied Pricing: {activePricingRule.rule_name} (V{activePricingRule.version_number})
              </div>
              <div className="text-xs text-muted-foreground">Formula: <span className="font-mono text-foreground">{formatRuleSteps(activePricingRule.steps)}</span></div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700">No pricing calculation rule is configured for this vendor. Final price = Buy Price. Use "Override" to set a manual price (reason required).</span>
            </div>
          )}
        </div>

        {/* Items Section */}
        <div className="rounded-xl border p-5 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Add Item</Button>
          </div>
          <div className="space-y-2">
            <div className="hidden md:grid md:grid-cols-[repeat(13,minmax(0,1fr))] md:gap-2 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-2">Product</div>
              <div className="col-span-2">Qty / Unit / Nos</div>
              <div className="col-span-1 text-right">Buy Price</div>
              <div className="col-span-1 text-right">GST%</div>
              <div className="col-span-1">GST Mode</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1 text-right">GST Amt</div>
              <div className="col-span-1 text-right">Buy (Calc)</div>
              <div className="col-span-1 text-right">Sell Price</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex flex-col gap-2 md:grid md:grid-cols-[repeat(13,minmax(0,1fr))] md:gap-2 md:items-center">
                  <div className="md:col-span-2">
                    <span className="md:hidden text-xs font-medium text-muted-foreground mb-1 block">Product</span>
                    <Select value={item.product_code} onValueChange={(v) => updateItem(idx, "product_code", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>{barcodeProducts.map((p) => <SelectItem key={p.id} value={p.product_code}>{p.product_code} — {p.product_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-1">
                    <span className="md:hidden text-xs font-medium text-muted-foreground mb-1 block w-full">Qty / Unit / Nos</span>
                    <Input type="number" className="h-8 w-16 text-right" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                    <Select value={item.unit || "nos"} onValueChange={(v) => updateItem(idx, "unit", v)}>
                      <SelectTrigger className="h-8 w-20 px-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nos">Nos</SelectItem>
                        {(item.vertical === "Bangles" || isBanglesProduct(item.product_code, item.product_name, products)) && <SelectItem value="dozen">Dozen</SelectItem>}
                        {(item.vertical === "Bangles" || isBanglesProduct(item.product_code, item.product_name, products)) && <SelectItem value="box">Box</SelectItem>}
                      </SelectContent>
                    </Select>
                    {item.unit === "dozen" && (
                      <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                        = {(item.quantity || 0) * 12} nos
                      </span>
                    )}
                    {item.unit === "box" && (
                      <span className="text-xs text-violet-600 bg-violet-100 px-2 py-1 rounded whitespace-nowrap">
                        = {calcTotalNos(item)} nos
                      </span>
                    )}
                  </div>
                  <div className="md:col-span-1">
                    <span className="md:hidden text-xs font-medium text-muted-foreground mb-1 block">Buy Price</span>
                    <Input type="number" className="h-8 text-right" placeholder={item.unit === "box" ? "₹/Box" : "₹/Nos"} value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))} />
                  </div>
                  <div className="md:col-span-1">
                    <span className="md:hidden text-xs font-medium text-muted-foreground mb-1 block">GST%</span>
                    <Select value={String(item.gst_rate || 0)} onValueChange={(v) => updateItem(idx, "gst_rate", Number(v))}>
                      <SelectTrigger className="h-8 px-1"><SelectValue placeholder="%" /></SelectTrigger>
                      <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <span className="md:hidden text-xs font-medium text-muted-foreground mb-1 block">GST Mode</span>
                    <Select value={item.gst_pricing_type || "exclusive"} onValueChange={(v) => updateItem(idx, "gst_pricing_type", v)}>
                      <SelectTrigger className="h-8 px-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exclusive">Excl</SelectItem>
                        <SelectItem value="inclusive">Incl</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1 flex justify-between md:block md:text-right">
                    <span className="md:hidden text-xs font-medium text-muted-foreground">Total</span>
                    <span className="text-sm font-medium">₹{(item.total_price || 0).toLocaleString()}</span>
                  </div>
                  <div className="md:col-span-1 flex justify-between md:block md:text-right">
                    <span className="md:hidden text-xs font-medium text-muted-foreground">GST Amt</span>
                    <span className="text-sm text-muted-foreground">₹{(item.gst_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="md:col-span-1 flex justify-between md:block md:text-right">
                    <span className="md:hidden text-xs font-medium text-muted-foreground">Buy (Calc)</span>
                    <span className={`text-sm font-medium ${item.pricing_mode === "manual_override" ? "text-amber-600" : "text-primary"}`}>₹{(item.final_price || 0).toLocaleString()}</span>
                    {item.pricing_mode === "manual_override" && <span className="block text-xs text-amber-600">overridden</span>}
                  </div>
                  <div className="md:col-span-1">
                    <span className="md:hidden text-xs font-medium text-muted-foreground mb-1 block">Sell Price</span>
                    <Input type="number" className="h-8 text-right" placeholder="Sell" value={item.selling_price || ""} onChange={(e) => updateItem(idx, "selling_price", Number(e.target.value))} />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewCalcIdx(viewCalcIdx === idx ? null : idx)} title="View Calculation">
                      {viewCalcIdx === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {canOverride && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => item.pricing_mode === "manual_override" ? removeOverride(idx) : startOverride(idx)} title={item.pricing_mode === "manual_override" ? "Remove Override" : "Override Price"}>
                        <Edit3 className={`h-4 w-4 ${item.pricing_mode === "manual_override" ? "text-amber-600" : ""}`} />
                      </Button>
                    )}
                    {form.items.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}><X className="h-4 w-4" /></Button>}
                  </div>
                </div>

                {item.unit === "box" && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-2 flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Dozens/Box:</span>
                      <Select value={String(item.dozens_per_box || 4)} onValueChange={(v) => updateItem(idx, "dozens_per_box", Number(v))}>
                        <SelectTrigger className="h-7 w-24 px-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOZENS_PER_BOX_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} dozen</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-xs text-muted-foreground bg-white px-2 py-1 rounded">
                      Total: {calcTotalNos(item)} nos
                    </span>
                    <span className="text-xs text-violet-700 bg-white px-2 py-1 rounded font-medium">
                      ₹{(calcPerNosPrice(item) || 0).toFixed(2)}/nos
                    </span>
                  </div>
                )}

                {viewCalcIdx === idx && (
                  <div className="ml-4 rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                    <div className="font-medium text-muted-foreground">Calculation Breakdown:</div>
                    <div>GST Pricing: <strong className="text-violet-600">{formatPricingType(item.gst_pricing_type)}</strong></div>
                    <div>Buy Price: <strong>₹{(item.unit_price || 0).toLocaleString()}</strong></div>
                    <div>Total (Qty × Price): <strong>₹{(item.total_price || 0).toLocaleString()}</strong></div>
                    <div>Taxable/Base Amount: <strong>₹{((item.taxable_amount || 0)).toLocaleString()}</strong></div>
                    <div>GST Amount ({item.gst_rate || 0}%): <strong>₹{(item.gst_amount || 0).toLocaleString()}</strong></div>
                    {activePricingRule ? (
                      <>
                        {(activePricingRule.steps || []).map((step, i) => (
                          <div key={i} className="text-muted-foreground">{OPERATIONS[step.operation]?.symbol} {step.operand} → ₹{executePricingRule(item.unit_price, activePricingRule.steps.slice(0, i + 1)).price?.toLocaleString()}</div>
                        ))}
                        <div className="pt-1 border-t">Calculated Price: <strong className="text-primary">₹{(item.calculated_price || 0).toLocaleString()}</strong></div>
                      </>
                    ) : <div className="text-amber-600">No rule configured — Final Price = Buy Price</div>}
                    {item.pricing_mode === "manual_override" && (
                      <div className="pt-1 border-t text-amber-600">
                        Manual Override: <strong>₹{(item.manual_override_price || 0).toLocaleString()}</strong>
                        <div className="text-xs">Reason: {item.override_reason}</div>
                      </div>
                    )}
                    <div className="pt-1 border-t font-medium">Buy Price (Calculated): <strong className="text-primary">₹{(item.final_price || 0).toLocaleString()}</strong></div>
                    <div className="text-emerald-600">Selling Price (Manual): <strong>₹{(item.selling_price || 0).toLocaleString()}</strong></div>
                  </div>
                )}

                {overrideIdx === idx && (
                  <div className="ml-4 rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                    <div className="text-sm font-medium text-amber-700">Manual Price Override</div>
                    <div className="text-xs text-muted-foreground">Calculated: ₹{(item.calculated_price || 0).toLocaleString()} → Override to:</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input type="number" className="h-8" placeholder="Manual Final Price" value={overridePrice} onChange={(e) => setOverridePrice(Number(e.target.value))} />
                      <Input className="h-8 flex-1" placeholder="Reason (required) *" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                      <Button type="button" size="sm" onClick={applyOverride}>Apply</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setOverrideIdx(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end mt-2 gap-1">
            {(() => {
              const gst = calculatePoGst(form.items, gstType);
              return (
                <div className="text-sm space-y-1">
                  <div className="flex justify-end gap-4"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium w-28 text-right">₹{gst.subtotal_before_gst.toLocaleString()}</span></div>
                  {gstType === "intra" ? (
                    <>
                      <div className="flex justify-end gap-4"><span className="text-muted-foreground">CGST:</span><span className="w-28 text-right">₹{gst.cgst_amount.toLocaleString()}</span></div>
                      <div className="flex justify-end gap-4"><span className="text-muted-foreground">SGST:</span><span className="w-28 text-right">₹{gst.sgst_amount.toLocaleString()}</span></div>
                    </>
                  ) : (
                    <div className="flex justify-end gap-4"><span className="text-muted-foreground">IGST:</span><span className="w-28 text-right">₹{gst.igst_amount.toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-end gap-4 pt-1 border-t"><span className="font-semibold">Total with GST:</span><span className="font-bold text-primary w-28 text-right">₹{gst.total_with_gst.toLocaleString()}</span></div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border p-5 bg-card">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any notes about this PO" />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/purchase-orders")}>Cancel</Button>
          <Button type="submit" disabled={generatingBarcodes}>
            {generatingBarcodes ? (<><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating Barcodes...</>) : (<><Barcode className="mr-2 h-4 w-4" /> Submit & Generate Barcodes</>)}
          </Button>
        </div>
      </form>

      {/* Scan Bill Dialog */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Scan Bill / Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a photo or PDF of a vendor bill/invoice. AI will extract vendor, items, prices, and tax automatically.</p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors">
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) handleScanBill(f); }} disabled={scanning} />
              {scanning ? (<><RefreshCw className="h-8 w-8 text-primary animate-spin" /><span className="text-sm font-medium">Scanning bill...</span></>) : (<><Upload className="h-8 w-8 text-muted-foreground" /><span className="text-sm font-medium">Click to upload bill</span><span className="text-xs text-muted-foreground">JPG, PNG, PDF</span></>)}
            </label>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Dialog */}
      <ConfirmCloseDialog open={addVendorOpen} onOpenChange={(open) => { setAddVendorOpen(open); if (!open) setVendorDirty(false); }} isDirty={vendorDirty}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Vendor</DialogTitle></DialogHeader>
          <VendorForm onSaved={handleVendorCreated} submitLabel="Save & Select" onDirtyChange={setVendorDirty} />
        </DialogContent>
      </ConfirmCloseDialog>

      {/* Barcode Results Dialog */}
      <Dialog open={showBarcodes} onOpenChange={(open) => { setShowBarcodes(open); if (!open) setNextStep({ key: "purchase_order" }); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Barcode className="h-5 w-5" /> Generated Barcodes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 print-area">
            <p className="text-sm text-muted-foreground no-print">{barcodeResults.filter((r) => r.success).length} barcode(s) auto-generated for this purchase order — grouped by product.</p>
            {(() => {
              const grouped = {};
              barcodeResults.forEach((r) => {
                const key = r.product || "Unknown";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(r);
              });
              return Object.entries(grouped).map(([productName, items]) => {
                const successCount = items.filter((r) => r.success).length;
                return (
                  <div key={productName} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b">
                      <div className="font-medium text-sm">{productName}</div>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{successCount} barcode{successCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {items.map((r, i) => (
                        <div key={i} className="rounded-md border p-2 flex flex-col items-center gap-1">
                          {r.success ? (
                            <>
                              <BarcodeDisplay value={r.barcode} />
                              <div className="text-[10px] text-muted-foreground font-mono break-all text-center">{r.barcode}</div>
                              <div className="w-full mt-1 pt-1 border-t space-y-0.5 text-left">
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Sell:</span><span className="font-bold text-emerald-600">₹{(r.selling_price || 0).toLocaleString()}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Date:</span><span className="font-medium">{r.purchase_date || "—"}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Vendor:</span><span className="font-mono font-medium">{r.vendor_code || "—"}</span></div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-destructive flex flex-col items-center gap-1 text-center">
                              <div className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Failed</div>
                              <div className="text-[10px] text-muted-foreground break-words px-1">{r.error || "Unknown error"}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <DialogFooter className="no-print">
            <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print Barcodes</Button>
            <Button type="button" onClick={() => { setShowBarcodes(false); setNextStep({ key: "purchase_order" }); }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NextStepDialog step={nextStep} onClose={() => { setNextStep(null); navigate("/purchase-orders"); }} />
    </div>
  );
}