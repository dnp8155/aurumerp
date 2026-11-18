import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calculator, AlertTriangle, History, Check } from "lucide-react";
import PricingRuleBuilder from "./PricingRuleBuilder";
import { executePricingRule, formatRuleSteps, validateSteps } from "@/lib/pricingEngine";
import { useToast } from "@/components/ui/use-toast";

export default function PricingRuleManager({ vendor, open, onOpenChange, onSaved }) {
  const [rules, setRules] = useState([]);
  const [steps, setSteps] = useState([{ sequence: 1, operation: "multiply", operand: "" }]);
  const [ruleName, setRuleName] = useState("");
  const [testPrice, setTestPrice] = useState(600);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (vendor && open) loadRules(); }, [vendor, open]);

  const loadRules = async () => {
    if (!vendor) return;
    try {
      const data = await base44.entities.VendorPricingRule.filter({ vendor_id: vendor.id });
      setRules(data || []);
    } catch (err) {
      console.error("Failed to load rules", err);
    }
  };

  const activeRule = rules.find((r) => r.is_active);
  const inactiveRules = rules.filter((r) => !r.is_active).sort((a, b) => (b.version_number || 0) - (a.version_number || 0));

  const handleSave = () => {
    const validation = validateSteps(steps);
    if (!validation.valid) { toast({ title: "Invalid rule", description: validation.error, variant: "destructive" }); return; }
    setConfirmOpen(true);
  };

  const confirmSave = async () => {
    try {
      const user = await base44.auth.me();
      const nextVersion = (rules.length || 0) + 1;
      if (activeRule) {
        await base44.entities.VendorPricingRule.update(activeRule.id, { is_active: false, effective_to: new Date().toISOString().split("T")[0] });
      }
      await base44.entities.VendorPricingRule.create({
        vendor_id: vendor.id, vendor_name: vendor.name,
        rule_name: ruleName || `Rule V${nextVersion}`, version_number: nextVersion, is_active: true,
        steps: steps.map((s, i) => ({ ...s, sequence: i + 1, operand: Number(s.operand) })),
        effective_from: new Date().toISOString().split("T")[0],
        created_by: user?.full_name || user?.email || "Unknown", status: "active",
      });
      toast({ title: "✅ Pricing rule saved", description: `Version ${nextVersion} is now active for ${vendor.name}` });
      setConfirmOpen(false); setSteps([{ sequence: 1, operation: "multiply", operand: "" }]); setRuleName("");
      loadRules(); onSaved?.();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleActivate = async (rule) => {
    if (!confirm("Activate this rule version? This will deactivate the current active rule.")) return;
    try {
      if (activeRule) await base44.entities.VendorPricingRule.update(activeRule.id, { is_active: false, effective_to: new Date().toISOString().split("T")[0] });
      await base44.entities.VendorPricingRule.update(rule.id, { is_active: true, effective_from: new Date().toISOString().split("T")[0], effective_to: "" });
      toast({ title: "Rule activated", description: `V${rule.version_number} is now active` });
      loadRules(); onSaved?.();
    } catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Pricing Rule — {vendor?.name}</DialogTitle>
          </DialogHeader>
          {activeRule && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-700">Active: {activeRule.rule_name} (V{activeRule.version_number})</span>
                <span className="text-xs text-emerald-600">Since {activeRule.effective_from}</span>
              </div>
              <div className="text-sm">Formula: <span className="font-mono">{formatRuleSteps(activeRule.steps)}</span></div>
              <div className="text-xs text-muted-foreground">Created by {activeRule.created_by}</div>
            </div>
          )}
          <div className="space-y-3">
            <div><Label>Rule Name</Label><Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Standard Markup, Festive Pricing" /></div>
            <PricingRuleBuilder steps={steps} onChange={setSteps} testPrice={testPrice} onTestPriceChange={setTestPrice} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="mr-2 h-4 w-4" /> {showHistory ? "Hide" : "Show"} Version History ({inactiveRules.length})
          </Button>
          {showHistory && (
            <div className="space-y-2">
              {inactiveRules.length === 0 ? <p className="text-sm text-muted-foreground">No previous versions</p> : inactiveRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">V{rule.version_number} — {rule.rule_name}</span>
                    <p className="text-xs text-muted-foreground">{formatRuleSteps(rule.steps)} · {rule.effective_from} to {rule.effective_to || "now"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleActivate(rule)}>Activate</Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save New Version</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /> Confirm Rule Change</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">You are changing the pricing calculation rule for <strong>{vendor?.name}</strong>. This will apply to <strong>new purchases only</strong>. Existing purchases will remain unchanged.</p>
            <p className="text-sm">New rule: <span className="font-mono">{formatRuleSteps(steps)}</span></p>
            <p className="text-sm">Preview: ₹{testPrice} → ₹{executePricingRule(testPrice, steps).price?.toLocaleString()}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmSave}><Check className="mr-2 h-4 w-4" /> Confirm & Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}