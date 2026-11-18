import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, Building2, CheckCircle2, Loader2, RefreshCw, RotateCw, XCircle } from "lucide-react";

export default function TallyCoveragePanel({ refreshKey, onRetry }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("tallySync", { action: "coverage" });
      setData(res.data || null);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const totals = data?.totals || { synced: 0, outstanding: 0, problems: 0 };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{t("tally.coverage_title")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t("tally.coverage_desc")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {t("tally.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 py-4">{error}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm mb-4">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                {t("tally.company_posting_into")}:
                <span className={data?.company_active ? "font-medium text-foreground" : "font-medium text-amber-600"}>
                  {data?.company || t("tally.company_placeholder")}
                </span>
              </span>
              {data?.company_active && data?.agent_connected && !data?.company_known_to_tally && (
                <span className="inline-flex items-center gap-1.5 text-amber-600 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t("tally.company_unknown")}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {totals.synced} {t("tally.coverage_synced")} · {totals.outstanding} {t("tally.coverage_outstanding")} · {totals.problems} {t("tally.coverage_problems")}
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tally.coverage_type")}</TableHead>
                    <TableHead>{t("tally.coverage_kind")}</TableHead>
                    <TableHead>{t("tally.coverage_mapping")}</TableHead>
                    <TableHead className="text-right">{t("tally.coverage_synced")}</TableHead>
                    <TableHead className="text-right">{t("tally.coverage_outstanding")}</TableHead>
                    <TableHead className="text-right">{t("tally.coverage_problems")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.types || []).map((row) => (
                    <TableRow key={row.entity_type}>
                      <TableCell className="font-medium capitalize">{row.entity_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.record_kind === "master" ? t("tally.kind_master") : t("tally.kind_voucher")}
                      </TableCell>
                      <TableCell>
                        {row.mapping_ready ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {t("tally.map_ready")}
                          </Badge>
                        ) : (
                          <span className="inline-flex flex-col gap-0.5">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 gap-1 w-fit">
                              <XCircle className="h-3 w-3" /> {t("tally.map_incomplete")}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {t("tally.map_missing")}: {(row.missing || []).join(", ")}
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.synced}</TableCell>
                      <TableCell className="text-right">{row.outstanding}</TableCell>
                      <TableCell className={`text-right ${row.problems > 0 ? "text-red-600 font-medium" : ""}`}>{row.problems}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold mb-2">{t("tally.needs_attention")}</h4>
              {data?.recent_failures?.length ? (
                <div className="space-y-2">
                  {data.recent_failures.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-2.5">
                      <div className="min-w-0">
                        <div className="text-xs font-medium capitalize">
                          {log.entity_type} · {log.entity_number || "—"}
                          <Badge variant="secondary" className={`ml-2 ${log.sync_status === "blocked" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                            {log.sync_status === "blocked" ? t("tally.blocked") : t("tally.stat_failed")}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                          {(log.validation_errors && log.validation_errors.length > 0
                            ? log.validation_errors
                            : [log.error_message]
                          ).filter(Boolean).join(" ")}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => onRetry?.(log.id)}>
                        <RotateCw className="h-3.5 w-3.5 mr-1" /> {t("tally.stat_retry")}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("tally.no_failures")}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}