import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calculator, RefreshCw, Building2, User, CreditCard, MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PricingRuleBuilder from "@/components/erp/PricingRuleBuilder";
import { validateSteps } from "@/lib/pricingEngine";
import { useToast } from "@/components/ui/use-toast";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Chandigarh", "Puducherry", "Andaman and Nicobar Islands",
  "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep",
];

const EMPTY_FORM = {
  name: "", nickname: "", code: "", contact_person: "", phone: "", email: "",
  billing_address_line1: "", billing_address_line2: "", billing_address_area: "",
  billing_address_city: "", billing_address_state: "", billing_address_pincode: "",
  shipping_address_line1: "", shipping_address_line2: "", shipping_address_area: "",
  shipping_address_city: "", shipping_address_state: "", shipping_address_pincode: "",
  gst_number: "", gst_pricing_type: "exclusive", category: "", notes: "", status: "active", rating: 0,
  default_collection_code: "", default_collection_name: "",
  bank_account_name: "", bank_account_number: "", bank_ifsc_code: "",
  bank_name: "", bank_branch: "", bank_upi_id: "",
};

export default function VendorForm({ editing, onSaved, submitLabel, onDirtyChange }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [collections, setCollections] = useState([]);
  const [pricingSteps, setPricingSteps] = useState([{ sequence: 1, operation: "multiply", operand: "" }]);
  const [pricingRuleName, setPricingRuleName] = useState("");
  const [testPrice, setTestPrice] = useState(600);
  const [saving, setSaving] = useState(false);
  const [copyToShipping, setCopyToShipping] = useState(false);
  const [codeWarning, setCodeWarning] = useState("");
  const [gstWarning, setGstWarning] = useState("");
  const [bankWarning, setBankWarning] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const checkDuplicates = async () => {
      try {
        const all = await base44.entities.Vendor.list("-created_date", 500);
        const others = (all || []).filter(v => v.id !== editing?.id);
        const code = form.code?.trim();
        const gst = form.gst_number?.trim().toUpperCase();
        const bank = form.bank_account_number?.trim();
        setCodeWarning(code ? (others.find(v => (v.code || "").toLowerCase() === code.toLowerCase()) || {}) : null);
        setGstWarning(gst ? (others.find(v => (v.gst_number || "").toUpperCase() === gst) || {}) : null);
        setBankWarning(bank ? (others.find(v => (v.bank_account_number || "") === bank) || {}) : null);
      } catch {}
    };
    const tmr = setTimeout(checkDuplicates, 300);
    return () => clearTimeout(tmr);
  }, [form.code, form.gst_number, form.bank_account_number, editing]);

  useEffect(() => {
    base44.entities.BarcodePartyMaster.filter({ status: "active" })
      .then(data => setCollections(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editing) {
      setForm({ ...EMPTY_FORM, ...editing });
      base44.entities.VendorPricingRule.filter({ vendor_id: editing.id, is_active: true })
        .then(rules => {
          if (rules && rules.length > 0) {
            setPricingSteps(rules[0].steps || [{ sequence: 1, operation: "multiply", operand: "" }]);
            setPricingRuleName(rules[0].rule_name || "");
          } else {
            setPricingSteps([{ sequence: 1, operation: "multiply", operand: "" }]);
            setPricingRuleName("");
          }
        })
        .catch(() => {
          setPricingSteps([{ sequence: 1, operation: "multiply", operand: "" }]);
          setPricingRuleName("");
        });
    } else {
      setForm(EMPTY_FORM);
      setPricingSteps([{ sequence: 1, operation: "multiply", operand: "" }]);
      setPricingRuleName("");
    }
  }, [editing]);

  useEffect(() => {
    const initial = editing ? { ...EMPTY_FORM, ...editing } : EMPTY_FORM;
    onDirtyChange?.(JSON.stringify(form) !== JSON.stringify(initial));
  }, [form, editing]);

  const handleCollectionChange = (collectionCode) => {
    const col = collections.find(c => c.collection_code === collectionCode);
    setForm(prev => ({ ...prev, default_collection_code: collectionCode, default_collection_name: col?.party_name || "" }));
  };

  const copyBillingToShipping = () => {
    setForm(prev => ({
      ...prev,
      shipping_address_line1: prev.billing_address_line1,
      shipping_address_line2: prev.billing_address_line2,
      shipping_address_area: prev.billing_address_area,
      shipping_address_city: prev.billing_address_city,
      shipping_address_state: prev.billing_address_state,
      shipping_address_pincode: prev.billing_address_pincode,
    }));
    setCopyToShipping(true);
    toast({ title: "Copied", description: "Billing address copied to shipping" });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name?.trim()) {
      toast({ title: "Name required", description: "Vendor name is required", variant: "destructive" });
      return;
    }
    if (codeWarning?.name || gstWarning?.name || bankWarning?.name) {
      toast({ title: "Duplicate detected", description: "Please resolve the warnings before saving", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let vendor;
      if (editing) {
        vendor = await base44.entities.Vendor.update(editing.id, form);
        toast({ title: "Vendor updated" });
      } else {
        vendor = await base44.entities.Vendor.create({ ...form, status: "active" });
        toast({ title: "Vendor created" });
      }

      const validation = validateSteps(pricingSteps);
      if (validation.valid) {
        const allRules = await base44.entities.VendorPricingRule.filter({ vendor_id: vendor.id });
        const activeRule = allRules?.find(r => r.is_active);
        const nextVersion = allRules && allRules.length > 0 ? Math.max(...allRules.map(r => r.version_number || 0)) + 1 : 1;
        if (activeRule) {
          await base44.entities.VendorPricingRule.update(activeRule.id, { is_active: false, effective_to: new Date().toISOString().split("T")[0] });
        }
        const user = await base44.auth.me().catch(() => null);
        await base44.entities.VendorPricingRule.create({
          vendor_id: vendor.id, vendor_name: form.name,
          rule_name: pricingRuleName || `Rule V${nextVersion}`,
          version_number: nextVersion, is_active: true,
          steps: pricingSteps.map((s, i) => ({ sequence: i + 1, operation: s.operation, operand: Number(s.operand) })),
          effective_from: new Date().toISOString().split("T")[0],
          created_by: user?.full_name || user?.email || "Unknown", status: "active",
        });
        toast({ title: "Pricing rule saved", description: `V${nextVersion} active — auto-applies to purchases` });
      }

      onSaved?.(vendor);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Identity Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Building2 className="h-4 w-4" /> Vendor Identity
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vendor Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dipak Suppliers" required />
          </div>
          <div>
            <Label>Nickname / Short Name</Label>
            <Input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="e.g. Dipak" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vendor Code</Label>
            <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. V001" />
            {codeWarning?.name && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Code already used by "{codeWarning.name}"</p>}
          </div>
          <div>
            <Label>Category</Label>
            <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Bangles, Rings" />
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <User className="h-4 w-4" /> Contact Details
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Contact Person</Label>
            <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Contact person name" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vendor@example.com" />
        </div>
      </div>

      {/* Billing Address */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MapPin className="h-4 w-4" /> Billing Address
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={copyBillingToShipping} className="text-xs h-7">
            Copy to Shipping →
          </Button>
        </div>
        <div>
          <Label>Address Line 1</Label>
          <Input value={form.billing_address_line1} onChange={e => setForm({ ...form, billing_address_line1: e.target.value })} placeholder="Shop/Building no, Street" />
        </div>
        <div>
          <Label>Address Line 2</Label>
          <Input value={form.billing_address_line2} onChange={e => setForm({ ...form, billing_address_line2: e.target.value })} placeholder="Area, Landmark" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Area</Label>
            <Input value={form.billing_address_area} onChange={e => setForm({ ...form, billing_address_area: e.target.value })} placeholder="Area" />
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.billing_address_city} onChange={e => setForm({ ...form, billing_address_city: e.target.value })} placeholder="City" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>State</Label>
            <Select value={form.billing_address_state} onValueChange={(v) => setForm({ ...form, billing_address_state: v })}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pincode</Label>
            <Input value={form.billing_address_pincode} onChange={e => setForm({ ...form, billing_address_pincode: e.target.value })} placeholder="Pincode" />
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <MapPin className="h-4 w-4" /> Shipping Address {copyToShipping && <span className="text-xs text-muted-foreground font-normal">(same as billing)</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Address Line 1</Label>
            <Input value={form.shipping_address_line1} onChange={e => setForm({ ...form, shipping_address_line1: e.target.value })} placeholder="Shop/Building no, Street" />
          </div>
          <div>
            <Label>Address Line 2</Label>
            <Input value={form.shipping_address_line2} onChange={e => setForm({ ...form, shipping_address_line2: e.target.value })} placeholder="Area, Landmark" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>City</Label>
            <Input value={form.shipping_address_city} onChange={e => setForm({ ...form, shipping_address_city: e.target.value })} placeholder="City" />
          </div>
          <div>
            <Label>State</Label>
            <Select value={form.shipping_address_state} onValueChange={(v) => setForm({ ...form, shipping_address_state: v })}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pincode</Label>
            <Input value={form.shipping_address_pincode} onChange={e => setForm({ ...form, shipping_address_pincode: e.target.value })} placeholder="Pincode" />
          </div>
        </div>
      </div>

      {/* GST & Tax */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Calculator className="h-4 w-4" /> GST & Tax Settings
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>GST Number</Label>
            <Input value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" className="font-mono" />
            {gstWarning?.name && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> GST already assigned to "{gstWarning.name}"</p>}
          </div>
          <div>
            <Label>GST Pricing Type</Label>
            <Select value={form.gst_pricing_type || "exclusive"} onValueChange={(v) => setForm({ ...form, gst_pricing_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exclusive">Exclusive (GST added on top)</SelectItem>
                <SelectItem value="inclusive">Inclusive (GST embedded in price)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CreditCard className="h-4 w-4" /> Bank Details
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Account Holder Name</Label>
            <Input value={form.bank_account_name} onChange={e => setForm({ ...form, bank_account_name: e.target.value })} placeholder="Account holder name" />
          </div>
          <div>
            <Label>Account Number</Label>
            <Input value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} placeholder="Bank account number" />
            {bankWarning?.name && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Bank account already assigned to "{bankWarning.name}"</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Bank Name</Label>
            <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. State Bank of India" />
          </div>
          <div>
            <Label>Branch</Label>
            <Input value={form.bank_branch} onChange={e => setForm({ ...form, bank_branch: e.target.value })} placeholder="Branch name" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>IFSC Code</Label>
            <Input value={form.bank_ifsc_code} onChange={e => setForm({ ...form, bank_ifsc_code: e.target.value.toUpperCase() })} placeholder="SBIN0001234" className="font-mono" />
          </div>
          <div>
            <Label>UPI ID</Label>
            <Input value={form.bank_upi_id} onChange={e => setForm({ ...form, bank_upi_id: e.target.value })} placeholder="vendor@upi" />
          </div>
        </div>
      </div>

      {/* Collection */}
      <div>
        <Label>Default Collection / Party</Label>
        <Select value={form.default_collection_code} onValueChange={handleCollectionChange}>
          <SelectTrigger><SelectValue placeholder="Select collection" /></SelectTrigger>
          <SelectContent>
            {collections.map(c => <SelectItem key={c.id} value={c.collection_code}>{c.collection_code} — {c.party_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Pricing Rule */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Calculator className="h-4 w-4" /> Pricing / Quotation Calculation
        </div>
        <p className="text-xs text-muted-foreground">Configure how Purchase Price converts to Selling Price. This auto-applies to all future purchases from this vendor.</p>
        <div>
          <Label>Rule Name</Label>
          <Input value={pricingRuleName} onChange={e => setPricingRuleName(e.target.value)} placeholder="e.g. Standard Markup, Festive Pricing" />
        </div>
        <PricingRuleBuilder steps={pricingSteps} onChange={setPricingSteps} testPrice={testPrice} onTestPriceChange={setTestPrice} />
      </div>

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any additional notes about this vendor" />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? (<><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : (submitLabel || (editing ? "Update Vendor" : "Create Vendor"))}
        </Button>
      </div>
    </form>
  );
}