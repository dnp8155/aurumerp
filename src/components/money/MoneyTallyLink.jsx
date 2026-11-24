import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function MoneyTallyLink({ tally }) {
  const stuck = tally?.stuck || 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Accounts (Tally) link</h3>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">Sends your sales and purchases to Tally so your books stay up to date.</p>
      {stuck > 0 ? (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm"><span className="font-semibold">{stuck} entries stuck</span> · The link needs your attention.</p>
          <Button asChild size="sm"><Link to="/tally-sync">Reconnect Tally</Link></Button>
        </div>
      ) : (
        <p className="text-sm text-emerald-600">All entries sent through. Tally is up to date.</p>
      )}
    </div>
  );
}