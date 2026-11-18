import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Download, KeyRound, Terminal } from "lucide-react";

export default function TallyAgentSetupCard() {
  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Tally Bridge Agent — install once on your Windows server</h3>
          <Badge variant="secondary" className="ml-1">Recommended</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          The cloud ERP can't reach <code className="text-xs bg-muted px-1 rounded">localhost:9000</code> on your server
          directly. A tiny agent runs next to TallyPrime, pulls pending sync jobs, and posts them to local Tally — fully automatic.
        </p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <div>
              <div className="font-medium flex items-center gap-1.5"><Download className="h-4 w-4" /> Copy the agent folder</div>
              <p className="text-muted-foreground">Download the <code className="text-xs bg-muted px-1 rounded">tally-bridge-agent/</code> folder from your project to the Windows server (e.g. <code className="text-xs bg-muted px-1 rounded">C:\tally-bridge-agent\</code>). Needs Node.js 18+.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <div>
              <div className="font-medium flex items-center gap-1.5"><KeyRound className="h-4 w-4" /> Set the bridge token</div>
              <p className="text-muted-foreground">In the app dashboard → <b>Secrets</b>, add <code className="text-xs bg-muted px-1 rounded">TALLY_BRIDGE_TOKEN</code> (a long random string). Put the same value in <code className="text-xs bg-muted px-1 rounded">config.json</code> on the server.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
            <div>
              <div className="font-medium flex items-center gap-1.5"><Terminal className="h-4 w-4" /> Run it as a service</div>
              <p className="text-muted-foreground">Test with <code className="text-xs bg-muted px-1 rounded">node agent.js</code>, then install as a Windows Service via NSSM (see the agent's <code className="text-xs bg-muted px-1 rounded">README.md</code>). It auto-starts on reboot and restarts on crash.</p>
            </div>
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}