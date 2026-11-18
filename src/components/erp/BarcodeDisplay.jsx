import React from "react";
import { cn } from "@/lib/utils";

export default function BarcodeDisplay({ value, label, className }) {
  // Generate visual barcode bars from the value string
  const bars = value ? value.split("").map((char, i) => {
    const code = char.charCodeAt(0);
    const width = (code % 3) + 1;
    const isDark = (code + i) % 2 === 0;
    return { width, isDark, key: i };
  }) : [];

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <div className="flex items-end gap-px h-10 bg-white px-2 py-1 rounded border">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className={bar.isDark ? "bg-black" : "bg-white"}
            style={{ width: `${bar.width}px`, height: "100%" }}
          />
        ))}
      </div>
      <span className="text-xs font-mono font-medium tracking-wider text-foreground">{value}</span>
    </div>
  );
}