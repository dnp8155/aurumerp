import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, ShoppingCart, Plus, Minus, Receipt, Printer, X, Package, RotateCcw, CreditCard, MapPin, Camera, Tag, Pencil, Check, MessageCircle, CalendarClock, Wrench, PanelRightOpen, Sparkles } from "lucide-react";
import CustomerPhoneLookup from "@/components/erp/CustomerPhoneLookup";
import PosPhotoScan from "@/components/erp/PosPhotoScan";
import VisualProductIdentifier from "@/components/erp/VisualProductIdentifier";
import ReturnSearchSection from "@/components/erp/ReturnSearchSection";
import TaxInvoicePrint from "@/components/erp/TaxInvoicePrint";
import RetailBillPrint from "@/components/erp/RetailBillPrint";
import BarcodeScanInfo from "@/components/erp/BarcodeScanInfo";
import { scanBarcode } from "@/lib/barcodeEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import useFormDirty from "@/hooks/useFormDirty";
import { format } from "date-fns";
import { calculatePoGst } from "@/lib/gstUtils";
import { fuzzyMatchAny } from "@/lib/fuzzySearch";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [returnSearch, setReturnSearch] = useState("");
  const [chequeName, setChequeName] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [partialCash, setPartialCash] = useState(0);
  const [partialOtherMethod, setPartialOtherMethod] = useState("upi");
  const [partialOtherAmount, setPartialOtherAmount] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [saleType, setSaleType] = useState("b2c");
  const [customerGstin, setCustomerGstin] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const checkoutDirty = useFormDirty(checkoutOpen, {
    saleType, paymentMethod, chequeName, chequeNumber,
    partialCash, partialOtherMethod, partialOtherAmount, advanceAmount,
  });
  const [receipt, setReceipt] = useState(null);
  // true only when the receipt on screen came from this session's checkout,
  // so the next-step prompt never fires when an old invoice is just viewed.
  const [receiptIsNewSale, setReceiptIsNewSale] = useState(false);
  const [returnSale, setReturnSale] = useState(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [photoScanOpen, setPhotoScanOpen] = useState(false);
  const [visualIdOpen, setVisualIdOpen] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [nextStep, setNextStep] = useState(null);
  const { toast } = useToast();
  const { t } = useI18n();
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    base44.auth.me().then(u => setUserRole(u?.role || "user")).catch(() => setUserRole("user"));
  }, []);

  const isShopView = userRole !== "admin";

  const loadData = async () => {
    try {
      const [prodData, invData, storeData, saleData] = await Promise.all([
        base44.entities.Product.filter({ status: "active" }),
        base44.entities.Inventory.list('-created_date', 200),
        base44.entities.Store.list('-created_date', 100),
        base44.entities.Sale.list('-created_date', 50),
      ]);
      setProducts(prodData || []);
      setInventory(invData || []);
      setStores(storeData || []);
      setSales(saleData || []);
      const firstStore = (storeData || []).find(s => s.type === "store");
      if (firstStore) setSelectedStore(firstStore.id);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const storeInventory = selectedStore === "all"
    ? inventory
    : inventory.filter(i => i.store_id === selectedStore);
  const availableProducts = products.filter(p => {
    const inv = storeInventory.find(i => i.product_id === p.id);
    return inv && (inv.quantity || 0) > 0;
  });

  const filteredProducts = searchQuery
    ? availableProducts.filter(p => fuzzyMatchAny(searchQuery, p.name, p.sku, p.barcode))
    : availableProducts;

  const getStock = (productId) => {
    const inv = storeInventory.find(i => i.product_id === productId);
    return inv ? inv.quantity || 0 : 0;
  };

  // Resolve tax-invoice business identity from the sale's shop (Store).
  // GSTIN, address, phone, tagline and HSN auto-fetch per shop.
  const resolveBusiness = (sale) => {
    if (!sale) return null;
    const store = stores.find(s => s.id === sale.store_id);
    if (!store) return null;
    const addressParts = [store.address, store.city, store.state, store.pincode].filter(Boolean);
    return {
      name: store.name,
      tagline: store.invoice_tagline || "Dealers in All Type of Bangles",
      address: addressParts.join(", "),
      phone: store.phone || "",
      gstin: store.gst_number || "",
      hsn: store.invoice_hsn_code || "7117",
      hsnLabel: store.invoice_hsn_label || "7117 - Imitation Jewellery",
    };
  };

  // Stock by location: group inventory by product, show each store's quantity
  const stockByLocation = products
    .map(p => {
      const locs = inventory
        .filter(i => i.product_id === p.id && (i.quantity || 0) > 0)
        .map(i => ({ store_id: i.store_id, store_name: i.store_name || stores.find(s => s.id === i.store_id)?.name || "—", quantity: i.quantity || 0 }));
      return { product: p, locations: locs, totalStock: locs.reduce((s, l) => s + l.quantity, 0) };
    })
    .filter(item => item.locations.length > 0);

  const addToCart = (product) => {
    const existing = cart.find(c => c.product_id === product.id);
    const stock = getStock(product.id);
    if (existing && existing.quantity >= stock) {
      toast({ title: "Insufficient stock", description: `Only ${stock} units available`, variant: "destructive" });
      return;
    }
    const price = product.selling_price || 0;
    if (existing) {
      setCart(cart.map(c =>
        c.product_id === product.id
          ? { ...c, quantity: c.quantity + 1, total_price: (c.quantity + 1) * price }
          : c
      ));
    } else {
      setCart([...cart, {
        product_id: product.id, sku: product.sku, product_name: product.name,
        quantity: 1, unit_price: price, total_price: price, discount: 0,
        gst_rate: product.gst_rate ?? 3,
      }]);
    }
  };

  // Barcode gun / Enter: exact barcode or SKU match first, then generated
  // BarcodeRecord -> SKU, then fall back to the first fuzzy search result.
  const handleScanEnter = async () => {
    const code = searchQuery.trim();
    if (!code) return;
    let match = availableProducts.find(p => p.barcode === code || p.sku === code);
    if (!match) {
      try {
        const { record } = await scanBarcode(code);
        match = availableProducts.find(p => p.sku === record.sku)
          || availableProducts.find(p => p.name === record.product_name);
      } catch {
        // not a generated barcode — fall through to fuzzy match
      }
    }
    if (!match) match = filteredProducts[0];
    if (match) {
      addToCart(match);
    } else {
      toast({ title: "Product not found or out of stock", description: code, variant: "destructive" });
    }
    setSearchQuery("");
    searchRef.current?.focus();
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== productId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return null;
      if (newQty > getStock(productId)) {
        toast({ title: "Insufficient stock", variant: "destructive" });
        return c;
      }
      return { ...c, quantity: newQty, total_price: newQty * c.unit_price };
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(c => c.product_id !== productId));
  };

  const startEditPrice = (item) => {
    setEditingPriceId(item.product_id);
    setEditPriceValue(String(item.unit_price));
  };

  const saveEditPrice = (productId) => {
    const newPrice = Number(editPriceValue) || 0;
    setCart(prev => prev.map(c =>
      c.product_id === productId
        ? { ...c, unit_price: newPrice, total_price: newPrice * c.quantity }
        : c
    ));
    setEditingPriceId(null);
    setEditPriceValue("");
  };

  const cancelEditPrice = () => {
    setEditingPriceId(null);
    setEditPriceValue("");
  };

  // GST INCLUSIVE: selling price already includes GST — customer pays the selling price total, no GST added on top
  const subtotal = cart.reduce((s, i) => s + (i.total_price || 0), 0);
  const totalAmount = subtotal - discount; // what customer pays (GST embedded)
  const gstType = "intra";
  // Back-calculate GST from inclusive total for tax reporting
  const gstBreakdown = calculatePoGst(
    cart.map(c => ({ ...c, total_price: c.total_price - (c.discount || 0), gst_pricing_type: "inclusive" })),
    gstType
  );
  const taxAmount = gstBreakdown.total_gst_amount;
  const subtotalBeforeGst = gstBreakdown.subtotal_before_gst;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    if (!selectedStore || selectedStore === "all") {
      toast({ title: "Select a store", description: "Choose a specific store to checkout (not All Stores)", variant: "destructive" });
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({ title: "Customer details required", description: "Name and phone number are mandatory", variant: "destructive" });
      return;
    }
    // For card/cheque payments above ₹50,000, customer phone is mandatory
    if ((paymentMethod === "card" || paymentMethod === "cheque") && totalAmount >= 50000 && !customerPhone.trim()) {
      toast({ title: "Customer ID required", description: "Card/Cheque payments above ₹50,000 need customer phone number", variant: "destructive" });
      return;
    }
    // Validate partial payment: cash + other = total
    if (paymentMethod === "partial") {
      const sumPaid = (Number(partialCash) || 0) + (Number(partialOtherAmount) || 0);
      if (Math.abs(sumPaid - totalAmount) > 1) {
        toast({ title: "Partial payment mismatch", description: `Cash + Other must equal ₹${totalAmount.toLocaleString()}`, variant: "destructive" });
        return;
      }
    }
    // Validate cheque fields
    if (paymentMethod === "cheque" && (!chequeName.trim() || !chequeNumber.trim())) {
      toast({ title: "Cheque details required", description: "Enter cheque name and number", variant: "destructive" });
      return;
    }
    // B2B tax invoice requires customer GSTIN
    if (saleType === "b2b" && !customerGstin.trim()) {
      toast({ title: "GSTIN required", description: "B2B Tax Invoice needs the buyer's GSTIN", variant: "destructive" });
      return;
    }
    try {
      const store = stores.find(s => s.id === selectedStore);
      const saleNumber = `INV-${Date.now().toString().slice(-8)}`;

      // Calculate per-item GST (inclusive — GST embedded in selling price)
      const itemsWithGst = cart.map(c => {
        const itemTotal = c.total_price - (c.discount || 0);
        const rate = c.gst_rate ?? 3;
        const baseAmount = itemTotal / (1 + rate / 100);
        const gstAmt = itemTotal - baseAmount;
        return { ...c, gst_amount: gstAmt, gst_pricing_type: "inclusive" };
      });

      // Determine payment status based on method
      let paymentStatus = "paid";
      let balanceDue = 0;
      if (paymentMethod === "pending") paymentStatus = "pending";
      if (paymentMethod === "advanced") {
        paymentStatus = "advanced";
        balanceDue = totalAmount - (Number(advanceAmount) || 0);
      }
      if (paymentMethod === "partial") paymentStatus = "partial";

      const sale = await base44.entities.Sale.create({
        sale_number: saleNumber,
        sale_type: saleType,
        customer_gstin: saleType === "b2b" ? customerGstin.trim() : undefined,
        store_id: selectedStore,
        store_name: store?.name,
        items: itemsWithGst,
        subtotal,
        subtotal_before_gst: subtotalBeforeGst,
        gst_type: gstType,
        cgst_amount: gstBreakdown.cgst_amount,
        sgst_amount: gstBreakdown.sgst_amount,
        igst_amount: gstBreakdown.igst_amount,
        total_gst_amount: gstBreakdown.total_gst_amount,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        cheque_name: paymentMethod === "cheque" ? chequeName : undefined,
        cheque_number: paymentMethod === "cheque" ? chequeNumber : undefined,
        partial_cash_amount: paymentMethod === "partial" ? (Number(partialCash) || 0) : undefined,
        partial_other_method: paymentMethod === "partial" ? partialOtherMethod : undefined,
        partial_other_amount: paymentMethod === "partial" ? (Number(partialOtherAmount) || 0) : undefined,
        advance_amount: paymentMethod === "advanced" ? (Number(advanceAmount) || 0) : undefined,
        balance_due: balanceDue || undefined,
        customer_name: customerName || "Walk-in Customer",
        customer_phone: customerPhone,
        customer_email: customerEmail || undefined,
        customer_address: customerAddress || undefined,
        status: "completed",
        sale_date: new Date().toISOString(),
        cashier_name: "Store User",
      });

      // Deduct inventory
      for (const item of cart) {
        const inv = storeInventory.find(i => i.product_id === item.product_id);
        if (inv) {
          await base44.entities.Inventory.update(inv.id, {
            quantity: (inv.quantity || 0) - item.quantity
          });
        }
      }

      // Fire-and-forget automatic Tally sync for this sale
      try { const { triggerTallySync } = await import("@/lib/tallySyncTrigger"); triggerTallySync("sale", sale.id); } catch {}

      setReceipt({ ...sale, store_name: store?.name });
      setReceiptIsNewSale(true);
      setCart([]);
      setDiscount(0);
      setShowDiscount(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerAddress("");
      setPaymentMethod("cash");
      setChequeName("");
      setChequeNumber("");
      setPartialCash(0);
      setPartialOtherMethod("upi");
      setPartialOtherAmount(0);
      setAdvanceAmount(0);
      setSaleType("b2c");
      setCustomerGstin("");
      setCheckoutOpen(false);
      setWhatsappSent(false);
      toast({ title: "Sale completed", description: saleNumber });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReturn = async (sale, returnItems, reason) => {
    try {
      const refundAmount = returnItems.reduce((s, i) => s + (i.refund_amount || 0), 0);

      // Restock returned items
      for (const item of returnItems) {
        const inv = inventory.find(i => i.product_id === item.product_id && i.store_id === sale.store_id);
        if (inv) {
          await base44.entities.Inventory.update(inv.id, {
            quantity: (inv.quantity || 0) + item.quantity
          });
        }
      }

      await base44.entities.Sale.update(sale.id, {
        status: returnItems.length === sale.items.length ? "returned" : "partial_return",
        return_items: returnItems,
        return_reason: reason,
        payment_status: "refunded"
      });

      toast({ title: "Return processed", description: `Refund: ₹${refundAmount.toLocaleString()}` });
      setReturnSale(null);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const sendWhatsAppBill = (sale) => {
    if (!sale.customer_phone) {
      toast({ title: "No customer phone", description: "Add a phone number to send via WhatsApp", variant: "destructive" });
      return;
    }
    const items = (sale.items || []).map(i => `• ${i.product_name} × ${i.quantity} — ₹${(i.total_price || 0).toLocaleString()}`).join("\n");
    const msg = `*SLB ERP - Invoice ${sale.sale_number}*\n\n${items}\n\nSubtotal: ₹${(sale.subtotal || 0).toLocaleString()}\n${sale.discount_amount > 0 ? `Discount: -₹${(sale.discount_amount || 0).toLocaleString()}\n` : ""}GST: ₹${(sale.tax_amount || 0).toLocaleString()}\n*Total: ₹${(sale.total_amount || 0).toLocaleString()}*\n\nPayment: ${sale.payment_method}\nCustomer: ${sale.customer_name}\n\nThank you for shopping with us!`;
    const phone = sale.customer_phone.replace(/[^0-9]/g, "");
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
    setWhatsappSent(true);
    toast({ title: "WhatsApp opened", description: "Send the bill to customer" });
  };

  const stockTabContent = stockByLocation.length === 0 ? (
    <EmptyState icon={MapPin} title="No stock found" description="Inventory items will appear here once products are stocked" />
  ) : (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Locations (Store: Qty)</TableHead>
            <TableHead className="text-right">Total Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockByLocation.map(({ product: p, locations, totalStock }) => (
            <TableRow key={p.id}>
              <TableCell className="text-sm font-medium">{p.name}</TableCell>
              <TableCell className="font-mono text-xs">{p.sku}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {locations.map((l, i) => (
                    <span key={i} className="text-xs rounded-md bg-muted px-2 py-1">
                      {l.store_name}: <strong>{l.quantity}</strong>
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right font-bold">{totalStock}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const salesTabContent = sales.length === 0 ? (
    <EmptyState icon={Receipt} title="No sales yet" description="Completed sales will appear here" />
  ) : (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Store</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map(s => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs font-medium">{s.sale_number}</TableCell>
              <TableCell className="text-sm">{s.store_name}</TableCell>
              <TableCell className="text-sm">{s.customer_name}</TableCell>
              <TableCell className="text-sm">{(s.items || []).length}</TableCell>
              <TableCell className="text-right font-medium">₹{(s.total_amount || 0).toLocaleString()}</TableCell>
              <TableCell><StatusBadge status={s.payment_method === "upi" ? "upi" : s.payment_method} label={s.payment_method} /></TableCell>
              <TableCell><StatusBadge status={s.status} /></TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.sale_date ? format(new Date(s.sale_date), "dd MMM, HH:mm") : "—"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => setReceipt(s)}><Receipt className="h-4 w-4" /></Button>
                {s.status === "completed" && (
                  <Button variant="ghost" size="icon" onClick={() => setReturnSale(s)} title="Process Return"><RotateCcw className="h-4 w-4 text-amber-500" /></Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return <div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("pos.title")} description={t("pos.desc")} />

      <Tabs defaultValue="billing">
        <div className="flex items-center justify-between gap-2 flex-wrap">
        <TabsList>
          <TabsTrigger value="billing" className="text-sm px-4 py-2.5 h-11"><ShoppingCart className="mr-2 h-4 w-4" /> Billing</TabsTrigger>
          {isShopView ? (
            <>
              <TabsTrigger value="rental" onClick={() => navigate('/rentals')} className="text-sm px-4 py-2.5 h-11"><CalendarClock className="mr-2 h-4 w-4" /> Rental</TabsTrigger>
              <TabsTrigger value="repair" onClick={() => navigate('/repairs')} className="text-sm px-4 py-2.5 h-11"><Wrench className="mr-2 h-4 w-4" /> Repair</TabsTrigger>
              <TabsTrigger value="return" className="text-sm px-4 py-2.5 h-11"><RotateCcw className="mr-2 h-4 w-4" /> Return</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="stock" className="text-sm px-4 py-2.5 h-11"><MapPin className="mr-2 h-4 w-4" /> Stock by Location</TabsTrigger>
              <TabsTrigger value="sales" className="text-sm px-4 py-2.5 h-11"><Receipt className="mr-2 h-4 w-4" /> Sales History</TabsTrigger>
              <TabsTrigger value="returns" className="text-sm px-4 py-2.5 h-11"><RotateCcw className="mr-2 h-4 w-4" /> Returns</TabsTrigger>
            </>
          )}
        </TabsList>
        {isShopView && (
          <Button variant="outline" onClick={() => setSidePanelOpen(true)}>
            <PanelRightOpen className="h-4 w-4" /> Stock & History
          </Button>
        )}
        </div>

        <TabsContent value="billing" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Product Search & List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.filter(s => s.type === "store" || s.type === "head_office").map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    placeholder="Search by name, SKU, or scan barcode..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleScanEnter(); }}
                    autoFocus
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={() => setPhotoScanOpen(true)} title="Scan product photo">
                  <Camera className="h-4 w-4" /> Scan Photo
                </Button>
                <Button variant="outline" onClick={() => setVisualIdOpen(true)} title="Identify by Camera (AI)" className="border-violet-300 text-violet-700 hover:bg-violet-50">
                  <Sparkles className="h-4 w-4" /> Identify by Camera
                </Button>
              </div>

              <BarcodeScanInfo />

              {availableProducts.length === 0 ? (
                <EmptyState icon={Package} title="No products in stock" description="Add inventory to this store to start billing" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredProducts.slice(0, 24).map(p => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="flex flex-col rounded-lg border p-3 text-left hover:border-primary hover:shadow-sm transition-all"
                    >
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt="" className="h-20 w-full rounded object-cover mb-2" />
                      ) : (
                        <div className="h-20 w-full rounded bg-muted flex items-center justify-center mb-2">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold">₹{(p.selling_price || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground">{getStock(p.id)} left</span>
                      </div>
                      {selectedStore === "all" && (() => {
                        const locs = stockByLocation.find(s => s.product.id === p.id)?.locations || [];
                        return locs.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {locs.slice(0, 3).map((l, i) => (
                              <span key={i} className="text-[9px] rounded bg-muted px-1 py-0.5 truncate max-w-[80px]">{l.store_name}: {l.quantity}</span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="rounded-xl border bg-card flex flex-col lg:h-[calc(100vh-220px)] lg:sticky lg:top-4 max-h-[60vh] lg:max-h-none">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Cart ({cart.length})
                </h3>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCart([])}>Clear</Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">Scan or click products to add</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.product_id} className="rounded-lg border p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name}</p>
                            {editingPriceId === item.product_id ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-xs text-muted-foreground">₹</span>
                                <Input
                                  type="number"
                                  value={editPriceValue}
                                  onChange={e => setEditPriceValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") saveEditPrice(item.product_id); if (e.key === "Escape") cancelEditPrice(); }}
                                  className="h-6 w-20 text-xs px-1"
                                  autoFocus
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveEditPrice(item.product_id)}>
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEditPrice}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditPrice(item)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors group"
                              >
                                <span>₹{item.unit_price.toLocaleString()} × {item.quantity}</span>
                                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product_id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product_id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-sm font-bold w-16 text-right">₹{item.total_price.toLocaleString()}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromCart(item.product_id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t p-4 space-y-3">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                    {!showDiscount ? (
                      <button
                        onClick={() => setShowDiscount(true)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
                        <Tag className="h-3 w-3" /> Add Discount
                      </button>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Discount</span>
                        <div className="flex items-center gap-1">
                          <Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} className="w-20 h-7 text-right" autoFocus />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDiscount(0); setShowDiscount(false); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600"><span>Discount Applied</span><span>-₹{discount.toLocaleString()}</span></div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground"><span>GST (incl. in price)</span><span>₹{taxAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between text-base font-bold pt-1 border-t"><span>Total Payable</span><span>₹{totalAmount.toLocaleString()}</span></div>
                  </div>
                  <Button className="w-full" onClick={() => setCheckoutOpen(true)}>
                    <CreditCard className="mr-2 h-4 w-4" /> Checkout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {isShopView && (
          <TabsContent value="return" className="mt-4">
            <ReturnSearchSection
              sales={sales.filter(s => s.status === "completed")}
              searchQuery={returnSearch}
              onSearchChange={setReturnSearch}
              onReturnClick={(s) => setReturnSale(s)}
            />
          </TabsContent>
        )}

        {!isShopView && (
          <>
            <TabsContent value="stock" className="mt-4">
              {stockTabContent}
            </TabsContent>
            <TabsContent value="sales" className="mt-4">
              {salesTabContent}
            </TabsContent>
            <TabsContent value="returns" className="mt-4 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Process New Return</h3>
                <ReturnSearchSection
                  sales={sales.filter(s => s.status === "completed")}
                  searchQuery={returnSearch}
                  onSearchChange={setReturnSearch}
                  onReturnClick={(s) => setReturnSale(s)}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Return History</h3>
                <ReturnsTab sales={sales.filter(s => s.status === "returned" || s.status === "partial_return")} />
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {isShopView && (
        <Sheet open={sidePanelOpen} onOpenChange={setSidePanelOpen}>
          <SheetContent side="right" className="w-[500px] sm:max-w-[500px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Stock & Sales History</SheetTitle>
            </SheetHeader>
            <Tabs defaultValue="stock" className="mt-4">
              <TabsList>
                <TabsTrigger value="stock"><MapPin className="mr-2 h-4 w-4" /> Stock</TabsTrigger>
                <TabsTrigger value="sales"><Receipt className="mr-2 h-4 w-4" /> Sales</TabsTrigger>
              </TabsList>
              <TabsContent value="stock" className="mt-4">
                {stockTabContent}
              </TabsContent>
              <TabsContent value="sales" className="mt-4">
                {salesTabContent}
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      )}

      {/* Checkout Dialog */}
      <ConfirmCloseDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} isDirty={checkoutDirty}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Complete Sale</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSaleType("b2c")}
                className={`rounded-lg border p-3 text-left transition-colors ${saleType === "b2c" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:bg-accent"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full border-2 ${saleType === "b2c" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                  <span className="text-sm font-semibold">B2C — Retail Bill</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Walk-in consumer sale. Retail invoice (no tax invoice).</p>
              </button>
              <button
                type="button"
                onClick={() => setSaleType("b2b")}
                className={`rounded-lg border p-3 text-left transition-colors ${saleType === "b2b" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:bg-accent"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full border-2 ${saleType === "b2b" ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                  <span className="text-sm font-semibold">B2B — Tax Invoice</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Business sale with buyer GSTIN.</p>
              </button>
            </div>

            {saleType === "b2b" && (
              <div>
                <Label>Buyer's GSTIN <span className="text-destructive">*</span></Label>
                <Input value={customerGstin} onChange={e => setCustomerGstin(e.target.value.toUpperCase())} placeholder="15-digit GSTIN" className="font-mono uppercase" maxLength={15} />
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{discount.toLocaleString()}</span></div>}
              <div className="flex justify-between text-xs text-muted-foreground"><span>GST (incl.)</span><span>₹{taxAmount.toLocaleString()}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t mt-1"><span>Total Payable</span><span>₹{totalAmount.toLocaleString()}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name <span className="text-destructive">*</span></Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Required" />
              </div>
              <div>
                <CustomerPhoneLookup
                  value={customerPhone}
                  onChange={(v) => setCustomerPhone(v)}
                  required
                  onResolved={(info) => {
                    // Auto-fill only empty fields — user edits are never overwritten.
                    if (info?.name && (!customerName || customerName === "Walk-in Customer")) setCustomerName(info.name);
                    if (info?.email && !customerEmail) setCustomerEmail(info.email);
                    if (info?.address && !customerAddress) setCustomerAddress(info.address);
                  }}
                />
              </div>
              <div className="col-span-2">
                <Label>Email</Label>
                <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@email.com" />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Delivery / billing address" />
              </div>
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="partial">Partial (Cash + Other)</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cheque fields */}
            {paymentMethod === "cheque" && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Cheque Name *</Label><Input value={chequeName} onChange={e => setChequeName(e.target.value)} placeholder="Name on cheque" /></div>
                <div><Label>Cheque Number *</Label><Input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="Cheque no." /></div>
              </div>
            )}

            {/* Partial payment fields */}
            {paymentMethod === "partial" && (
              <div className="rounded-lg border p-3 space-y-3 bg-amber-50/50">
                <p className="text-xs font-medium text-amber-700">Split Payment — Cash + Other Method</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cash Amount</Label>
                    <Input type="number" value={partialCash} onChange={e => { const c = Number(e.target.value) || 0; setPartialCash(c); setPartialOtherAmount(Math.max(0, totalAmount - c)); }} placeholder="0" />
                  </div>
                  <div>
                    <Label>Other Method</Label>
                    <Select value={partialOtherMethod} onValueChange={setPartialOtherMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="net_banking">Net Banking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Other Amount</Label>
                  <Input type="number" value={partialOtherAmount} onChange={e => setPartialOtherAmount(Number(e.target.value) || 0)} placeholder="0" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cash + Other</span>
                  <span className={Math.abs((Number(partialCash) || 0) + (Number(partialOtherAmount) || 0) - totalAmount) > 1 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                    ₹{((Number(partialCash) || 0) + (Number(partialOtherAmount) || 0)).toLocaleString()} / ₹{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Advanced payment fields */}
            {paymentMethod === "advanced" && (
              <div className="rounded-lg border p-3 space-y-2 bg-blue-50/50">
                <p className="text-xs font-medium text-blue-700">Advance Payment — Customer pays now, balance later</p>
                <div>
                  <Label>Advance Amount Received</Label>
                  <Input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(Number(e.target.value) || 0)} placeholder="0" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-medium">₹{Math.max(0, totalAmount - (Number(advanceAmount) || 0)).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Pending note */}
            {paymentMethod === "pending" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                Sale will be marked as <strong>Payment Pending</strong> — collect payment later.
              </div>
            )}

            {((paymentMethod === "card" || paymentMethod === "cheque") && totalAmount >= 50000 && !customerPhone.trim()) && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                Customer phone is mandatory for {paymentMethod} payments above ₹50,000
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button onClick={handleCheckout}>Complete Sale — ₹{totalAmount.toLocaleString()}</Button>
          </DialogFooter>
        </DialogContent>
      </ConfirmCloseDialog>

      {/* Receipt Dialog */}
      <ReceiptDialog
        sale={receipt}
        business={resolveBusiness(receipt)}
        onClose={() => {
          const wasNewSale = receiptIsNewSale;
          setReceipt(null);
          setWhatsappSent(false);
          setReceiptIsNewSale(false);
          if (wasNewSale) setNextStep({ key: "sale" });
        }}
        onSendWhatsApp={sendWhatsAppBill}
        whatsappSent={whatsappSent}
      />

      {/* Return Dialog */}
      <ReturnDialog sale={returnSale} onClose={() => setReturnSale(null)} onSubmit={handleReturn} />

      {/* Photo Scan Dialog */}
      <PosPhotoScan
        open={photoScanOpen}
        onClose={() => setPhotoScanOpen(false)}
        onProductMatched={addToCart}
        availableProducts={availableProducts}
      />

      {/* AI Visual Identification Dialog */}
      <VisualProductIdentifier
        open={visualIdOpen}
        onClose={() => setVisualIdOpen(false)}
        module="pos"
        storeId={selectedStore}
        onProductSelected={(product) => {
          addToCart(product);
          setVisualIdOpen(false);
        }}
      />

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}

function ReceiptDialog({ sale, business, onClose, onSendWhatsApp, whatsappSent }) {
  if (!sale) return null;
  const isB2B = sale.sale_type === "b2b";
  const title = isB2B ? "Tax Invoice" : "Retail Bill";
  return (
    <Dialog open={!!sale} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="no-print"><DialogTitle>{title}</DialogTitle></DialogHeader>
        {isB2B ? <TaxInvoicePrint sale={sale} business={business} /> : <RetailBillPrint sale={sale} business={business} />}
        <div className="space-y-2 no-print pt-3 border-t mt-2">
          <Button
            variant="outline"
            className="w-full bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
            onClick={() => onSendWhatsApp(sale)}
            disabled={!sale.customer_phone || whatsappSent}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {whatsappSent ? "WhatsApp Opened" : "Send via WhatsApp"}
          </Button>
          {!sale.customer_phone && (
            <p className="text-xs text-muted-foreground text-center">Add customer phone to enable WhatsApp</p>
          )}
          <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print {title}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ sale, onClose, onSubmit }) {
  const [returnQtys, setReturnQtys] = useState({});
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (sale) {
      const init = {};
      (sale.items || []).forEach(i => { init[i.product_id] = 0; });
      setReturnQtys(init);
    }
  }, [sale]);

  if (!sale) return null;

  const returnItems = (sale.items || [])
    .map(item => ({
      ...item,
      quantity: returnQtys[item.product_id] || 0,
      refund_amount: (returnQtys[item.product_id] || 0) * (item.unit_price || 0)
    }))
    .filter(i => i.quantity > 0);

  const totalRefund = returnItems.reduce((s, i) => s + i.refund_amount, 0);

  return (
    <Dialog open={!!sale} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Process Return — {sale.sale_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Select the quantity for each item to return — set 0 to skip an item.</p>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Return Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sale.items || []).map(item => (
                  <TableRow key={item.product_id}>
                    <TableCell className="text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={returnQtys[item.product_id] || 0}
                        onChange={e => setReturnQtys({ ...returnQtys, [item.product_id]: Math.min(Number(e.target.value), item.quantity) })}
                        className="w-16 h-7 text-right"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Label>Return Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Damaged">Damaged</SelectItem>
                <SelectItem value="Wrong Product">Wrong Product</SelectItem>
                <SelectItem value="Quality Issue">Quality Issue</SelectItem>
                <SelectItem value="Customer Changed Mind">Customer Changed Mind</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {totalRefund > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 flex justify-between text-sm">
              <span className="font-medium text-amber-700">Refund Amount</span>
              <span className="font-bold text-amber-700">₹{totalRefund.toLocaleString()}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(sale, returnItems, reason)} disabled={returnItems.length === 0}>Process Return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnsTab({ sales }) {
  if (sales.length === 0) {
    return <EmptyState icon={RotateCcw} title="No returns processed" description="Returned sales will appear here" />;
  }
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Store</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Items Returned</TableHead>
            <TableHead className="text-right">Refund</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map(s => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
              <TableCell className="text-sm">{s.store_name}</TableCell>
              <TableCell className="text-sm">{s.customer_name}</TableCell>
              <TableCell className="text-right text-sm">{(s.return_items || []).length}</TableCell>
              <TableCell className="text-right font-medium text-red-600">₹{((s.return_items || []).reduce((sum, i) => sum + (i.refund_amount || 0), 0)).toLocaleString()}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{s.return_reason || "—"}</TableCell>
              <TableCell><StatusBadge status={s.status} /></TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.sale_date ? format(new Date(s.sale_date), "dd MMM yyyy") : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}