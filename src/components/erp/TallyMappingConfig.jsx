import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { getEmptyMapping } from "@/lib/tallyExport";
import { Settings2, Loader2 } from "lucide-react";

export default function TallyMappingConfig({ open, onOpenChange, onSaved, editing }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [mapping, setMapping] = useState(getEmptyMapping());
  const [existingId, setExistingId] = useState(null);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMapping({ ...getEmptyMapping(), ...editing });
      setExistingId(editing.id);
      setActive(!!editing.active);
    } else {
      setMapping(getEmptyMapping());
      setExistingId(null);
      setActive(true);
    }
  }, [open, editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("tallySync", {
        action: "saveMapping",
        id: existingId || undefined,
        activate: active,
        mapping,
      });
      toast({ title: t("tally.mapping_saved") });
      onSaved?.(mapping);
      onOpenChange(false);
    } catch (err) {
      toast({ title: t("tally.mapping_save_failed"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setMapping(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> {t("tally.companies_title")}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            <div><Label>{t("tally.mapping_name")}</Label><Input value={mapping.name} onChange={e => set("name", e.target.value)} /></div>
            <div>
              <Label>{t("tally.company_label")}</Label>
              <Input
                value={mapping.tally_company || ""}
                onChange={e => set("tally_company", e.target.value)}
                placeholder="e.g. SLB Jewellers Pvt Ltd"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("tally.mapping_company_hint")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("tally.default_party_ledger")}</Label><Input value={mapping.default_party_ledger} onChange={e => set("default_party_ledger", e.target.value)} /></div>
              <div><Label>{t("tally.default_godown")}</Label><Input value={mapping.default_godown} onChange={e => set("default_godown", e.target.value)} /></div>
              <div><Label>{t("tally.default_uom")}</Label><Input value={mapping.default_uom} onChange={e => set("default_uom", e.target.value)} /></div>
              <div><Label>{t("tally.po_party_ledger")}</Label><Input value={mapping.po_party_ledger} onChange={e => set("po_party_ledger", e.target.value)} /></div>
              <div><Label>{t("tally.cgst_ledger")}</Label><Input value={mapping.cgst_ledger} onChange={e => set("cgst_ledger", e.target.value)} /></div>
              <div><Label>{t("tally.sgst_ledger")}</Label><Input value={mapping.sgst_ledger} onChange={e => set("sgst_ledger", e.target.value)} /></div>
              <div><Label>{t("tally.igst_ledger")}</Label><Input value={mapping.igst_ledger} onChange={e => set("igst_ledger", e.target.value)} /></div>
              <div><Label>{t("tally.round_off_ledger")}</Label><Input value={mapping.round_off_ledger} onChange={e => set("round_off_ledger", e.target.value)} /></div>
              <div><Label>{t("tally.default_expense_ledger")}</Label><Input value={mapping.default_expense_ledger} onChange={e => set("default_expense_ledger", e.target.value)} /></div>
              <div><Label>{t("tally.default_payment_ledger")}</Label><Input value={mapping.default_payment_ledger} onChange={e => set("default_payment_ledger", e.target.value)} /></div>
            </div>
            <div>
              <Label>{t("tally.store_godown_map")}</Label>
              <Textarea rows={4} value={mapping.store_godown_map} onChange={e => set("store_godown_map", e.target.value)} placeholder={"Main Store=Godown A\nWarehouse=Godown B"} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <Label className="text-sm">{t("tally.active_mapping_switch")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("tally.active_mapping_hint")}</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("action.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("tally.company_saving")}</> : t("tally.save_mapping")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}