import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, Plus, Pencil, Trash2, Phone, Settings2 } from "lucide-react";
import PricingRuleManager from "@/components/erp/PricingRuleManager";
import VendorForm from "@/components/erp/VendorForm";
import NextStepDialog from "@/components/erp/NextStepDialog";
import ConfirmCloseDialog from "@/components/erp/ConfirmCloseDialog";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [ruleManagerVendor, setRuleManagerVendor] = useState(null);
  const [vendorDirty, setVendorDirty] = useState(false);
  const [nextStep, setNextStep] = useState(null);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadVendors(); }, []);

  const loadVendors = async () => {
    try {
      const vendorData = await base44.entities.Vendor.list('-created_date', 100);
      setVendors(vendorData || []);
    } catch (err) {
      console.error("Failed to load vendors", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVendorSaved = () => {
    const isNew = !editing;
    setDialogOpen(false);
    setEditing(null);
    loadVendors();
    if (isNew) setNextStep({ key: "vendor" });
  };

  const handleEdit = (vendor) => {
    setEditing(vendor);
    setVendorDirty(false);
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm(t("action.delete_confirm"))) return;
    try {
      await base44.entities.Vendor.delete(id);
      toast({ title: t("common.deleted") });
      loadVendors();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("vendor.title")} description={t("vendor.desc")}>
        <ConfirmCloseDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setVendorDirty(false); } }} isDirty={vendorDirty}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> {t("vendor.add")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? t("vendor.edit") : t("vendor.add")}</DialogTitle>
            </DialogHeader>
            <VendorForm editing={editing} onSaved={handleVendorSaved} onDirtyChange={setVendorDirty} />
          </DialogContent>
        </ConfirmCloseDialog>
      </PageHeader>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : vendors.length === 0 ? (
        <EmptyState icon={Building2} title={t("vendor.no_vendors")} description={t("vendor.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Nickname</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>GST Type</TableHead>
                <TableHead>Pricing Rule</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{v.name}</p>
                      {v.code && <p className="text-xs text-muted-foreground font-mono">{v.code}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.nickname || "—"}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {v.contact_person && <p className="text-sm">{v.contact_person}</p>}
                      {v.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{v.category || "—"}</TableCell>
                  <TableCell className="text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${(v.gst_pricing_type || "exclusive") === "inclusive" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                      {(v.gst_pricing_type || "exclusive") === "inclusive" ? "Inclusive" : "Exclusive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Button variant="outline" size="sm" onClick={() => setRuleManagerVendor(v)} className="h-7 text-xs">
                      <Settings2 className="mr-1 h-3 w-3" /> Manage Rule
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.default_collection_code ? (
                      <span className="font-mono text-xs">{v.default_collection_code}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.bank_name || v.bank_account_number ? (
                      <span className="text-xs">{v.bank_name || "Bank"} {v.bank_account_number ? `••${(v.bank_account_number || "").slice(-4)}` : ""}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PricingRuleManager vendor={ruleManagerVendor} open={!!ruleManagerVendor} onOpenChange={(open) => !open && setRuleManagerVendor(null)} />
      <NextStepDialog step={nextStep} onClose={() => setNextStep(null)} />
    </div>
  );
}