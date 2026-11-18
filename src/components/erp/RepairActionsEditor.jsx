import React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPES = [
  { value: "labor", label: "Labor" },
  { value: "part", label: "Part" },
  { value: "other", label: "Other" }
];

export default function RepairActionsEditor({ actions, onChange, readOnly }) {
  const rows = actions || [];

  const update = (i, field, value) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    if (field === "quantity" || field === "unit_cost") {
      next[i].total_cost = (Number(next[i].quantity) || 0) * (Number(next[i].unit_cost) || 0);
    }
    onChange(next);
  };

  const addRow = () => onChange([...rows, { description: "", type: "labor", quantity: 1, unit_cost: 0, total_cost: 0 }]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  const total = rows.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);

  return (
    <div className="space-y-3">
      {rows.length === 0 && !readOnly && (
        <p className="text-sm text-muted-foreground">No actions recorded. Add labor, parts, or other work done.</p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Select value={r.type} onValueChange={v => update(i, "type", v)} disabled={readOnly}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            {!readOnly && <Button variant="ghost" size="icon" onClick={() => removeRow(i)}><X className="h-4 w-4" /></Button>}
          </div>
          <Input placeholder="Description (e.g. Soldering, replacement spring)" value={r.description || ""} onChange={e => update(i, "description", e.target.value)} disabled={readOnly} />
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Qty</Label><Input type="number" min="0" value={r.quantity || 0} onChange={e => update(i, "quantity", Number(e.target.value))} disabled={readOnly} /></div>
            <div><Label className="text-xs">Unit ₹</Label><Input type="number" min="0" value={r.unit_cost || 0} onChange={e => update(i, "unit_cost", Number(e.target.value))} disabled={readOnly} /></div>
            <div><Label className="text-xs">Total</Label><div className="h-9 flex items-center px-3 rounded-md bg-muted/50 text-sm font-medium">₹{(r.total_cost || 0).toLocaleString()}</div></div>
          </div>
        </div>
      ))}
      {!readOnly && <Button variant="outline" size="sm" onClick={addRow}><Plus className="mr-2 h-4 w-4" /> Add Action</Button>}
      {rows.length > 0 && (
        <div className="flex justify-between text-sm font-medium pt-2 border-t">
          <span>Total Actions Cost:</span><span>₹{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}