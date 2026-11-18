import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({ label, value, icon: Icon, trend, trendLabel, accent = "primary" }) {
  const accentClasses = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-heading font-bold tracking-tight text-foreground">{value}</p>
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                trend >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", accentClasses[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}