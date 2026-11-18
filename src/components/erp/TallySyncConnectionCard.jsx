import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, XCircle, Loader2, RadioTower, Settings2, Clock, Building2 } from "lucide-react";

export default function TallySyncConnectionCard({ readiness, onRecheck }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke("tallySync", { action: "test" });
      setTestResult(res.data);
      const st = res.data?.status;
      if (st === "connected") {
        toast({ title: "Agent online, Tally connected", description: "Automatic sync is active." });
      } else if (st === "agent_online_tally_offline") {
        toast({ title: "Agent online, Tally offline", description: "Start TallyPrime with HTTP server enabled.", variant: "destructive" });
      } else if (st === "agent_stale" || st === "agent_not_seen") {
        toast({ title: "Agent not running", description: "Install and start the Tally Bridge Agent on your Windows server.", variant: "destructive" });
      } else {
        toast({ title: "Connection error", description: res.data?.message || st, variant: "destructive" });
      }
    } catch (err) {
      setTestResult({ status: "error", message: err.message });
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const connected = testResult?.status === "connected";
  const agentOffline = testResult?.status === "agent_stale" || testResult?.status === "agent_not_seen" || (readiness && !readiness.checks?.agent_running);
  const tallyOffline = testResult?.status === "agent_online_tally_offline" || (readiness && readiness.checks?.agent_running && !readiness.checks?.tally_connected);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`h-11 w-11 rounded-full flex items-center justify-center ${connected ? "bg-emerald-100" : agentOffline ? "bg-amber-100" : tallyOffline ? "bg-orange-100" : "bg-slate-100"}`}>
              {testing ? <Loader2 className="h-5 w-5 animate-spin text-slate-600" /> :
                connected ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> :
                <RadioTower className="h-6 w-6 text-slate-600" />}
            </div>
            <div>
              <h3 className="font-semibold text-base">Bridge Agent Status</h3>
              {agentOffline ? (
                <p className="text-sm text-amber-600 mt-0.5">Tally Bridge Agent is not running. Install it on your Windows server (see setup below).</p>
              ) : tallyOffline ? (
                <p className="text-sm text-orange-600 mt-0.5">Agent is online but TallyPrime is not reachable. Enable Tally HTTP server on port 9000.</p>
              ) : connected ? (
                <p className="text-sm text-emerald-600 mt-0.5">Agent online, Tally connected — automatic sync active.</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Test the connection to verify the agent and Tally.</p>
              )}
              {(testResult?.agent_last_seen || readiness?.agent_last_seen) && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Last seen: {new Date(testResult?.agent_last_seen || readiness?.agent_last_seen).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRecheck}><Settings2 className="h-4 w-4 mr-2" /> Recheck readiness</Button>
            <Button size="sm" onClick={handleTest} disabled={testing}>
              {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : <RadioTower className="h-4 w-4 mr-2" />} Test connection
            </Button>
          </div>
        </div>

        {readiness?.checks && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <ReadinessChip ok={readiness.checks.agent_running} label="Agent running" />
            <ReadinessChip ok={readiness.checks.tally_connected} label="Tally connected" />
            <ReadinessChip ok={readiness.checks.mapping_configured} label="Mapping" />
            <ReadinessChip ok={readiness.checks.ledgers?.sales} label="Sales ledger" />
            <ReadinessChip ok={readiness.checks.ledgers?.cgst} label="CGST ledger" />
            <ReadinessChip ok={readiness.checks.default_godown} label="Godown" />
            <ReadinessChip ok={readiness.checks.company_selected} label={t("tally.selected_company")} />
          </div>
        )}

        {readiness && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> {t("tally.company_posting_into")}:
              <span className={readiness.selected_company ? "font-medium text-foreground" : "font-medium text-amber-600"}>
                {readiness.selected_company || t("tally.company_placeholder")}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {t("tally.pending_jobs")}:
              <span className="font-medium text-foreground">{readiness.pending_jobs ?? 0}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadinessChip({ ok, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}