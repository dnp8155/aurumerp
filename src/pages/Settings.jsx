import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Tag, CreditCard, Database, Check, Sparkles } from "lucide-react";
import AiIdentificationSettings from "@/components/erp/AiIdentificationSettings";
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
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

export default function Settings() {
  const { t } = useI18n();
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <PageHeader title={t("set.title")} description={t("set.desc")} />
      <Tabs defaultValue="attributes">
        <TabsList>
          <TabsTrigger value="attributes"><Tag className="mr-2 h-4 w-4" /> Attributes</TabsTrigger>
          <TabsTrigger value="tally"><Database className="mr-2 h-4 w-4" /> Tally</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="mr-2 h-4 w-4" /> Payments</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="mr-2 h-4 w-4" /> AI Identification</TabsTrigger>
        </TabsList>

        <TabsContent value="attributes" className="mt-4"><AttributesTab /></TabsContent>
        <TabsContent value="tally" className="mt-4"><TallyTab /></TabsContent>
        <TabsContent value="payments" className="mt-4"><PaymentsTab /></TabsContent>
        <TabsContent value="ai" className="mt-4"><AiIdentificationSettings /></TabsContent>
      </Tabs>
    </div>
  );
}

function AttributesTab() {
  const [attrs, setAttrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "", values: [], allow_custom: true, is_required: false, display_order: 0 });
  const [newValue, setNewValue] = useState("");
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadAttrs(); }, []);

  const loadAttrs = async () => {
    try {
      const data = await base44.entities.AttributeDefinition.list('display_order', 100);
      setAttrs(data || []);
    } catch (err) {
      console.error("Failed to load attributes", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setForm({ name: "", category: "", values: [], allow_custom: true, is_required: false, display_order: 0 });

  const handleEdit = (attr) => {
    setEditing(attr);
    setForm({ ...attr, values: attr.values || [] });
    setDialogOpen(true);
  };

  const addValue = () => {
    if (newValue.trim()) {
      setForm(prev => ({ ...prev, values: [...prev.values, newValue.trim()] }));
      setNewValue("");
    }
  };

  const removeValue = (idx) => {
    setForm(prev => ({ ...prev, values: prev.values.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await base44.entities.AttributeDefinition.update(editing.id, form);
        toast({ title: "Attribute updated" });
      } else {
        await base44.entities.AttributeDefinition.create(form);
        toast({ title: "Attribute created" });
      }
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      loadAttrs();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this attribute?")) return;
    try {
      await base44.entities.AttributeDefinition.delete(id);
      toast({ title: "Attribute deleted" });
      loadAttrs();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Attribute</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit Attribute" : "Add Attribute"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Attribute Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Color, Size, Material" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. General, Jewelry" /></div>
              <div>
                <Label>Values</Label>
                <div className="flex gap-2 mb-2">
                  <Input value={newValue} onChange={e => setNewValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addValue(); } }} placeholder="Add a value" />
                  <Button type="button" variant="outline" onClick={addValue}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(form.values || []).map((v, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                      {v}
                      <button type="button" onClick={() => removeValue(i)} className="text-muted-foreground hover:text-destructive">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.allow_custom} onCheckedChange={v => setForm({ ...form, allow_custom: v })} />
                <Label>Allow custom values</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_required} onCheckedChange={v => setForm({ ...form, is_required: v })} />
                <Label>Required field</Label>
              </div>
              <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{editing ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : attrs.length === 0 ? (
        <EmptyState icon={Tag} title="No attributes defined" description="Create attribute definitions to use during SKU cataloging" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Values</TableHead>
                <TableHead>Custom</TableHead>
                <TableHead>Required</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attrs.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-sm">{a.category || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(a.values || []).slice(0, 5).map((v, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs">{v}</span>
                      ))}
                      {(a.values || []).length > 5 && <span className="text-xs text-muted-foreground">+{a.values.length - 5}</span>}
                    </div>
                  </TableCell>
                  <TableCell>{a.allow_custom ? <Check className="h-4 w-4 text-emerald-600" /> : "—"}</TableCell>
                  <TableCell>{a.is_required ? <Check className="h-4 w-4 text-emerald-600" /> : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TallyTab() {
  const [configs, setConfigs] = useState({ TALLY_API_URL: "", TALLY_API_KEY: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Note: Secrets are set via dashboard settings, this is a reference for the user
      toast({
        title: "Tally Configuration",
        description: "Set TALLY_API_URL and TALLY_API_KEY in Dashboard → Settings → Environment Variables to enable Tally sync.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-xl border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Tally Prime Integration</h3>
            <p className="text-xs text-muted-foreground">Sync POs, inventory ledgers, and payments to Tally</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Tally API URL</Label>
            <Input placeholder="http://localhost:9000 or Tally Prime HTTP API URL" value={configs.TALLY_API_URL} onChange={e => setConfigs({ ...configs, TALLY_API_URL: e.target.value })} />
          </div>
          <div>
            <Label>Tally API Key</Label>
            <Input type="password" placeholder="••••••••" value={configs.TALLY_API_KEY} onChange={e => setConfigs({ ...configs, TALLY_API_KEY: e.target.value })} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
      <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">How Tally sync works:</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>Approved POs are synced to Tally as Purchase vouchers</li>
          <li>New SKUs are synced as Stock Items with ledgers</li>
          <li>Inventory movements sync as stock journals</li>
          <li>Payment status (paid/unpaid/due) syncs back from Tally</li>
        </ul>
      </div>

    </div>
  );
}

function PaymentsTab() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    try {
      const data = await base44.entities.PaymentConfig.list('-created_date', 20);
      setConfigs(data || []);
    } catch (err) {
      console.error("Failed to load payment configs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (config) => {
    try {
      await base44.entities.PaymentConfig.update(config.id, { is_active: !config.is_active });
      toast({ title: `${config.display_name || config.provider} ${!config.is_active ? "activated" : "deactivated"}` });
      loadConfigs();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAdd = async (provider) => {
    try {
      const existing = configs.find(c => c.provider === provider);
      if (existing) {
        toast({ title: "Already exists", description: `${provider} is already configured` });
        return;
      }
      await base44.entities.PaymentConfig.create({
        provider,
        display_name: provider === "stripe" ? "Stripe (Cards & UPI)" : provider === "upi" ? "UPI Direct" : provider === "card_terminal" ? "Card Terminal" : "Razorpay",
        is_active: false,
        config: {},
        supported_methods: provider === "stripe" ? ["card", "upi"] : provider === "upi" ? ["upi"] : ["card"],
        environment: "test"
      });
      toast({ title: "Payment provider added" });
      loadConfigs();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => handleAdd("stripe")}>+ Stripe</Button>
        <Button variant="outline" size="sm" onClick={() => handleAdd("upi")}>+ UPI</Button>
        <Button variant="outline" size="sm" onClick={() => handleAdd("card_terminal")}>+ Card Terminal</Button>
        <Button variant="outline" size="sm" onClick={() => handleAdd("razorpay")}>+ Razorpay</Button>
      </div>

      {loading ? (
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
      ) : configs.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payment providers configured" description="Add payment providers for the POS module (Phase 2)" />
      ) : (
        <div className="space-y-3">
          {configs.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                  <CreditCard className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.display_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.environment} · {(c.supported_methods || []).join(", ")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{c.is_active ? "Active" : "Inactive"}</span>
                <Switch checked={c.is_active} onCheckedChange={() => handleToggle(c)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
        <p className="font-medium">Payment integration is ready for Phase 2 (POS Module).</p>
        <p className="text-xs mt-1">Providers configured here will be available at checkout. Stripe is available in your region (IN) for cards and UPI.</p>
      </div>
    </div>
  );
}