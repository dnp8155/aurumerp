import React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RepairTechnicianEditor({ technicians, onChange, readOnly }) {
  const rows = technicians || [];
  const update = (i, field, value) => onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const addRow = () => onChange([...rows, { name: "", phone: "" }]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.length === 0 && !readOnly && <p className="text-sm text-muted-foreground">No technicians assigned.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1"><Label className="text-xs">Name</Label><Input value={r.name || ""} onChange={e => update(i, "name", e.target.value)} disabled={readOnly} placeholder="Technician name" /></div>
          <div className="flex-1"><Label className="text-xs">Phone</Label><Input value={r.phone || ""} onChange={e => update(i, "phone", e.target.value)} disabled={readOnly} placeholder="Phone" /></div>
          {!readOnly && <Button variant="ghost" size="icon" onClick={() => removeRow(i)}><X className="h-4 w-4" /></Button>}
        </div>
      ))}
      {!readOnly && <Button variant="outline" size="sm" onClick={addRow}><Plus className="mr-2 h-4 w-4" /> Add Technician</Button>}
    </div>
  );
}