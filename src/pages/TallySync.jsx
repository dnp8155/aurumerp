import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import PageHeader from "@/components/erp/PageHeader";
import TallySyncConnectionCard from "@/components/erp/TallySyncConnectionCard";
import TallyCompanySelector from "@/components/erp/TallyCompanySelector";
import TallyAgentSetupCard from "@/components/erp/TallyAgentSetupCard";
import TallySyncLogTable from "@/components/erp/TallySyncLogTable";
import TallyCompanyMappings from "@/components/erp/TallyCompanyMappings";
import TallyCoveragePanel from "@/components/erp/TallyCoveragePanel";
import { RefreshCw, Play, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function TallySync() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ success: 0, failed: 0, retry: 0, pending: 0 });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await base44.entities.TallySyncLog.filter({}, { sort: "-created_date", limit: 50 });
      setLogs(items || []);
      const s = { success: 0, failed: 0, retry: 0, pending: 0 };
      for (const l of items || []) {
        if (l.sync_status === "success") s.success++;
        else if (l.sync_status === "failed") s.failed++;
        else if (l.sync_status === "retry") s.retry++;
        else if (l.sync_status === "pending") s.pending++;
      }
      setStats(s);
    } catch (err) {
      toast({ title: t("tally.load_logs_failed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const loadReadiness = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("tallySync", { action: "readiness" });
      setReadiness(res.data);
    } catch {
      setReadiness(null);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    loadReadiness();
  }, [loadLogs, loadReadiness]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("tallySync", { action: "processQueue", limit: 15 });
      const data = res.data || {};
      toast({
        title: t("tally.queue_scan_done"),
        description: `${data.summary?.queued || 0} ${t("tally.queued_lbl")} · ${data.summary?.skipped || 0} ${t("tally.skipped_lbl")}`,
      });
      loadLogs();
      loadReadiness();
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast({ title: t("tally.sync_failed"), description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async (logId) => {
    try {
      const res = await base44.functions.invoke("tallySync", { action: "retry", log_id: logId });
      toast({
        title: res.data?.sync_status === "success" ? t("tally.retry_succeeded") : t("tally.retry_queued"),
        description: res.data?.entity_number || "",
      });
      loadLogs();
      loadReadiness();
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast({ title: t("tally.retry_failed"), description: err.message, variant: "destructive" });
    }
  };

  const statCards = [
    { key: "success", label: t("tally.stat_synced"), value: stats.success, icon: CheckCircle2, color: "text-emerald-600" },
    { key: "failed", label: t("tally.stat_failed"), value: stats.failed, icon: XCircle, color: "text-red-600" },
    { key: "retry", label: t("tally.stat_retry"), value: stats.retry, icon: AlertTriangle, color: "text-amber-600" },
    { key: "pending", label: t("tally.stat_pending"), value: stats.pending, icon: Clock, color: "text-slate-500" },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("tally.sync_title")} description={t("tally.sync_desc")}>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {t("tally.refresh")}
        </Button>
        <Button size="sm" onClick={handleSyncNow} disabled={syncing}>
          {syncing ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t("tally.syncing")}</>
          ) : (
            <><Play className="h-4 w-4 mr-2" /> {t("tally.sync_now")}</>
          )}
        </Button>
      </PageHeader>

      <TallySyncConnectionCard readiness={readiness} onRecheck={loadReadiness} />

      <TallyCompanySelector onSaved={loadReadiness} />

      <TallyCompanyMappings onChanged={loadReadiness} />

      <TallyAgentSetupCard />

      <TallyCoveragePanel refreshKey={refreshKey} onRetry={handleRetry} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {statCards.map(s => (
          <Card key={s.key}>
            <CardContent className="pt-5 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t("tally.recent_activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TallySyncLogTable logs={logs} loading={loading} onRetry={handleRetry} />
        </CardContent>
      </Card>

    </div>
  );
}