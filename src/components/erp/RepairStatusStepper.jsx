import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FLOW = ["received", "diagnosing", "in_progress", "awaiting_parts", "ready_for_delivery", "delivered"];
const LABELS = {
  received: "Received", diagnosing: "Diagnosing", in_progress: "In Progress",
  awaiting_parts: "Awaiting Parts", ready_for_delivery: "Ready", delivered: "Delivered"
};

export default function RepairStatusStepper({ status }) {
  const isOffFlow = !STATUS_FLOW.includes(status);
  const currentIndex = STATUS_FLOW.indexOf(status);

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center overflow-x-auto scrollbar-hide">
        {STATUS_FLOW.map((s, i) => {
          const isComplete = !isOffFlow && i < currentIndex;
          const isCurrent = !isOffFlow && i === currentIndex;
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center min-w-[78px]">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                  isComplete && "bg-primary text-primary-foreground border-primary",
                  isCurrent && "bg-primary text-primary-foreground border-primary ring-4 ring-primary/20",
                  !isComplete && !isCurrent && "bg-background text-muted-foreground border-border"
                )}>
                  {isComplete ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn("mt-1.5 text-[11px] text-center whitespace-nowrap", (isComplete || isCurrent) ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {LABELS[s]}
                </span>
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div className={cn("flex-1 h-0.5 min-w-[16px] -mt-5", !isOffFlow && i < currentIndex ? "bg-primary" : "bg-border")} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {isOffFlow && (
        <p className="text-xs text-amber-600 mt-2 capitalize">Status: {status} (off standard flow)</p>
      )}
    </div>
  );
}