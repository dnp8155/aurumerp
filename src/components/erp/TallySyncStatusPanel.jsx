import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import useTallySyncStatus from "@/hooks/useTallySyncStatus";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2 } from "lucide-react";

const STATUS_STYLE = {
  success: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  retry: "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-600",
  skipped: "bg-blue-100 text-blue-700",
};

// Live snapshot of Tally sync health: how many records are pushed, which ones
// failed and why. Data and realtime wiring live in useTallySyncStatus.
export default function TallySyncStatusPanel() {
  const { t } = useI18n();
  const { counts, logs, agent, loading } = useTallySyncStatus();

  const stats = [
    { key: "success", label: t("tally.stat_synced"), icon: CheckCircle2, color: "text-emerald-600" },
    { key: "failed", label: t("tally.stat_failed"), icon: XCircle, color: "text-red-600" },
    { key: "retry", label: t("tally.stat_retry"), icon: AlertTriangle, color: "text-amber-600" },
    { key: "pending", label: t("tally.stat_pending"), icon: Clock, color: "text-slate-500" },
  ];

  const agentOnline = agent?.status === "connected";

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm font-semibold">{t("tally.live_title")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t("tally.live_desc")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Link to="/tally-sync">
            <Button variant="ghost" size="sm" className="text-xs">
              {t("action.view_all")} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs">
          <span className="inline-flex items-center gap-2 font-medium">
            <span className={`h-2 w-2 rounded-full ${agentOnline ? "bg-emerald-500" : "bg-red-500"}`} />
            {agentOnline ? t("tally.agent_connected") : t("tally.agent_disconnected")}
          </span>
          {agent?.last_seen && (
            <span className="text-muted-foreground">
              {t("tally.last_seen")}: {new Date(agent.last_seen).toLocaleString()}
            </span>
          )}
          {agent?.pending_count > 0 && (
            <span className="text-amber-600">{agent.pending_count} {t("tally.pending_jobs")}</span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {stats.map((s) => (
            <div key={s.key} className="rounded-lg border p-3 flex items-center gap-2">
              <s.icon className={`h-4 w-4 shrink-0 ${s.color}`} />
              <div>
                <div className="text-lg font-bold leading-none">{counts[s.key] || 0}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t("tally.no_activity")}</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize">
                    {log.entity_type}{" "}
                    <span className="font-mono text-xs font-normal text-muted-foreground">{log.entity_number || ""}</span>
                  </p>
                  {log.error_message && (
                    <p className="text-xs text-red-600 truncate" title={log.error_message}>
                      <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />
                      {log.error_message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(log.last_sync_timestamp || log.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <Badge variant="secondary" className={STATUS_STYLE[log.sync_status] || STATUS_STYLE.pending}>
                    {log.sync_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}