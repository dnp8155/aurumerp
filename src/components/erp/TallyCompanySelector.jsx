import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { Building2, CheckCircle2, Loader2, RefreshCw, Save } from "lucide-react";

export default function TallyCompanySelector({ onSaved }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("tallySync", { action: "companies" });
      const d = res.data || {};
      setData(d);
      setSelected(d.selected_company || "");
    } catch (err) {
      setData(null);
      toast({ title: t("tally.company_load_failed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const companies = data?.companies || [];
  const savedCompany = data?.selected_company || "";
  const dirty = Boolean(selected) && selected !== savedCompany;

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await base44.functions.invoke("tallySync", { action: "setCompany", company: selected });
      toast({ title: t("tally.company_saved"), description: selected });
      await load();
      onSaved?.();
    } catch (err) {
      toast({ title: t("tally.company_save_failed"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">{t("tally.company_title")}</h3>
          {savedCompany && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {savedCompany}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{t("tally.company_desc")}</p>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="w-full sm:max-w-sm">
              <Label htmlFor="tally-company">{t("tally.company_label")}</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="tally-company">
                  <SelectValue placeholder={t("tally.company_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("tally.company_saving")}</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> {t("tally.company_use")}</>
              )}
            </Button>
            <Button variant="outline" onClick={load} disabled={saving}>
              <RefreshCw className="h-4 w-4 mr-2" /> {t("tally.company_reload")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-amber-600 flex-1">{t("tally.company_unavailable")}</p>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> {t("tally.company_reload")}
            </Button>
          </div>
        )}

        {companies.length > 0 && !savedCompany && (
          <p className="text-xs text-amber-600 mt-3">{t("tally.company_none")}</p>
        )}
      </CardContent>
    </Card>
  );
}