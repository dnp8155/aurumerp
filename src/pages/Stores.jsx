import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Store as StoreIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import NextStepDialog from "@/components/erp/NextStepDialog";
import useFormDirty from "@/hooks/useFormDirty";

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", type: "store", address: "", city: "", state: "", pincode: "", phone: "", manager_name: "", gst_number: "", invoice_tagline: "", invoice_hsn_code: "", invoice_hsn_label: "", status: "active" });
  const { toast } = useToast();
  const { t } = useI18n();
  const storeDirty = useFormDirty(dialogOpen, form);
  const [nextStep, setNextStep] = useState(null);

  useEffect(() => { loadStores(); }, []);

  const loadStores = async () => {
    try {
      const data = await base44.entities.Store.list('-created_date', 100);
      setStores(data || []);
    } catch (err) {
      console.error("Failed to load stores", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStore) {
        await base44.entities.Store.update(editingStore.id, form);
        toast({ title: "Store updated" });
      } else {
        await base44.entities.Store.create(form);
        toast({ title: "Store created" });
        setNextStep({ key: "store" });
      }
      setDialogOpen(false);
      setEditingStore(null);
      setForm({ name: "", code: "", type: "store", address: "", city: "", state: "", pincode: "", phone: "", manager_name: "", gst_number: "", invoice_tagline: "", invoice_hsn_code: "", invoice_hsn_label: "", status: "active" });
      loadStores();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEdit = (store) => {
    setEditingStore(store);
    setForm({ ...store });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this store? This cannot be undone.")) return;
    try {
      await base44.entities.Store.delete(id);
      toast({ title: "Store deleted" });
      loadStores();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("store.title")} description={t("store.desc")}>
        <ConfirmCloseDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingStore(null); setForm({ name: "", code: "", type: "store", address: "", city: "", state: "", pincode: "", phone: "", manager_name: "", gst_number: "", invoice_tagline: "", invoice_hsn_code: "", invoice_hsn_label: "", status: "active" }); } }} isDirty={storeDirty}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Store</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingStore ? "Edit Store" : "Add Store"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Store Name *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Store Code *</Label>
                  <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="head_office">Head Office</SelectItem>
                    <SelectItem value="store">Store</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Manager</Label><Input value={form.manager_name} onChange={e => setForm({ ...form, manager_name: e.target.value })} /></div>
              </div>
              <div>
                <Label>GST Number</Label>
                <Input value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tax Invoice Printing</p>
                <div>
                  <Label>Invoice Tagline</Label>
                  <Input value={form.invoice_tagline} onChange={e => setForm({ ...form, invoice_tagline: e.target.value })} placeholder="Dealers in All Type of Bangles" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Default HSN Code</Label>
                    <Input value={form.invoice_hsn_code} onChange={e => setForm({ ...form, invoice_hsn_code: e.target.value })} placeholder="7117" />
                  </div>
                  <div>
                    <Label>HSN Label</Label>
                    <Input value={form.invoice_hsn_label} onChange={e => setForm({ ...form, invoice_hsn_label: e.target.value })} placeholder="7117 - Imitation Jewellery" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{editingStore ? "Update" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </ConfirmCloseDialog>
      </PageHeader>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : stores.length === 0 ? (
        <EmptyState icon={StoreIcon} title={t("store.no_stores")} description={t("store.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-mono text-xs font-medium">{store.code}</TableCell>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell><StatusBadge status={store.type} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {store.city ? `${store.city}, ${store.state}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{store.manager_name || "—"}</TableCell>
                  <TableCell><StatusBadge status={store.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(store)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}