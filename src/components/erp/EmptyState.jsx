import React from "react";
import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {Icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}