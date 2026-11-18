import React from "react";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { executePricingRule, OPERATIONS, formatRuleSteps } from "@/lib/pricingEngine";

export default function PricingRuleBuilder({ steps, onChange, testPrice = 600, onTestPriceChange }) {
  const addStep = () => onChange([...steps, { sequence: steps.length + 1, operation: "multiply", operand: "" }]);
  const removeStep = (idx) => onChange(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sequence: i + 1 })));
  const moveStep = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[idx], newSteps[target]] = [newSteps[target], newSteps[idx]];
    onChange(newSteps.map((s, i) => ({ ...s, sequence: i + 1 })));
  };
  const updateStep = (idx, field, value) => {
    const newSteps = [...steps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    onChange(newSteps);
  };

  const result = executePricingRule(testPrice, steps);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Test Buy Price:</span>
        <Input type="number" value={testPrice} onChange={(e) => onTestPriceChange(Number(e.target.value))} className="w-32" />
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="text-center text-sm font-medium text-muted-foreground">Buy Price: ₹{testPrice}</div>
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Select value={step.operation} onValueChange={(v) => updateStep(idx, "operation", v)}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(OPERATIONS).map(([key, op]) => (
                  <SelectItem key={key} value={key}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" value={step.operand} onChange={(e) => updateStep(idx, "operand", e.target.value)} placeholder="Operand" className="w-32" />
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(idx, -1)} disabled={idx === 0}><ChevronUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}><ChevronDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStep(idx)}><X className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addStep}><Plus className="mr-1 h-3 w-3" /> Add Step</Button>
        <div className="text-center text-sm font-bold text-primary pt-2 border-t">
          Final Price: {result.valid ? `₹${result.price?.toLocaleString()}` : <span className="text-destructive">{result.error}</span>}
        </div>
      </div>
      {steps.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">Formula: Buy Price → {formatRuleSteps(steps)} → Final Price</div>
      )}
    </div>
  );
}