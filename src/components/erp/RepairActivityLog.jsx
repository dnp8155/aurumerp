import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { History } from "lucide-react";
import { format } from "date-fns";

export default function RepairActivityLog({ repairId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await base44.entities.AuditTrail.filter(
          { entity_type: "Repair", entity_id: repairId },
          { sort: "-created_date", limit: 20 }
        );
        setLogs(res.items || []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    if (repairId) load();
  }, [repairId]);

  if (loading) return <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Loading activity...</p></div>;

  return (
    <div className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><History className="h-4 w-4" /> Activity Log</h3>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <div className="space-y-0">
          {logs.map((log, idx) => (
            <div key={log.id} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 ${log.action === "create" ? "bg-emerald-500" : log.action === "update" ? "bg-blue-500" : log.action === "sync" ? "bg-purple-500" : "bg-muted-foreground"}`} />
                {idx < logs.length - 1 && <div className="w-px flex-1 bg-border min-h-[24px]" />}
              </div>
              <div className="pb-3 flex-1">
                <p className="font-medium capitalize">{log.action} {log.details ? `— ${log.details}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {log.created_date ? format(new Date(log.created_date), "dd MMM yyyy, HH:mm") : ""}
                  {log.user_name ? ` · by ${log.user_name}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}