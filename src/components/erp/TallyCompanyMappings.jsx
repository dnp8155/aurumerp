import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import TallyMappingConfig from "@/components/erp/TallyMappingConfig";
import { Building2, CheckCircle2, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

export default function TallyCompanyMappings({ onChanged }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("tallySync", { action: "mappings" });
      setRows(res.data?.mappings || []);
    } catch (err) {
      toast({ title: t("tally.coverage_load_failed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action, payload, title) => {
    try {
      await base44.functions.invoke("tallySync", { action, ...payload });
      toast({ title });
      await load();
      onChanged?.();
    } catch (err) {
      toast({ title: t("tally.mapping_save_failed"), description: err.message, variant: "destructive" });
    }
  };

  const handleActivate = async (id) => {
    setBusyId(id);
    await act("activateMapping", { id }, t("tally.mapping_activated"));
    setBusyId("");
  };

  const handleDelete = async () => {
    const id = pendingDelete?.id;
    setPendingDelete(null);
    if (!id) return;
    setBusyId(id);
    await act("deleteMapping", { id }, t("tally.mapping_deleted"));
    setBusyId("");
  };

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> {t("tally.companies_title")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{t("tally.companies_desc")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {t("tally.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> {t("tally.add_company")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">{t("tally.company_none")}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((m) => (
              <div key={m.id} className="rounded-md border border-border/60 p-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{m.name || "—"}</span>
                    {m.active && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {t("tally.active_mapping")}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{m.tally_company || t("tally.company_placeholder")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {m.ready_types}/{m.total_types} {t("tally.map_ready")}
                    {m.incomplete?.length > 0 && (
                      <> · {t("tally.map_incomplete")}: {m.incomplete.map((r) => r.entity_type).join(", ")}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!m.active && (
                    <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => handleActivate(m.id)}>
                      {t("tally.set_active")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> {t("tally.edit_mapping")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingDelete(m)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <TallyMappingConfig
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSaved={() => { load(); onChanged?.(); }}
        />

        <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("tally.delete_mapping")}</AlertDialogTitle>
              <AlertDialogDescription>{t("tally.delete_mapping_confirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("action.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{t("tally.delete_mapping")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}