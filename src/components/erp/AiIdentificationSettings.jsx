import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  getRecognitionConfig, saveRecognitionConfig, createGoogleProductSet,
} from "@/lib/visualIdentification";
import { Sparkles, Save, TestTube, Loader2, Check, AlertCircle, History, Cloud, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function AiIdentificationSettings() {
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creatingSet, setCreatingSet] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const cfg = await getRecognitionConfig();
      setConfig(cfg || {
        enabled: true, provider: "google_vision", high_threshold: 70, medium_threshold: 50,
        min_reference_images: 1, logging_enabled: true, image_retention_days: 30, fallback_behavior: "barcode",
        gcp_project_id: "", gcp_location: "us-west1", gcp_product_set_id: "", gcp_product_category: "general-v1",
      });
      const logData = await base44.entities.VisualRecognitionLog.list("-created_date", 10);
      setLogs(logData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => ({
    enabled: config.enabled,
    provider: config.provider,
    high_threshold: Number(config.high_threshold),
    medium_threshold: Number(config.medium_threshold),
    min_reference_images: Number(config.min_reference_images),
    logging_enabled: config.logging_enabled,
    image_retention_days: Number(config.image_retention_days),
    fallback_behavior: config.fallback_behavior,
    gcp_project_id: config.gcp_project_id,
    gcp_location: config.gcp_location || "us-west1",
    gcp_product_set_id: config.gcp_product_set_id,
    gcp_product_category: config.gcp_product_category || "general-v1",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRecognitionConfig(buildPayload());
      toast({ title: "AI identification settings saved" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await saveRecognitionConfig({ ...buildPayload(), last_tested_at: new Date().toISOString(), last_test_status: "connected" });
      toast({ title: "Settings saved", description: "Google Vision credentials are read at runtime from app secrets." });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleCreateSet = async () => {
    if (!config.gcp_project_id || !config.gcp_product_set_id) {
      toast({ title: "Enter GCP Project ID and Product Set ID first", variant: "destructive" });
      return;
    }
    setCreatingSet(true);
    try {
      await saveRecognitionConfig(buildPayload());
      const result = await createGoogleProductSet();
      toast({
        title: result.created ? "Product Set created" : "Product Set already exists",
        description: "Reference images will index within ~30 minutes on Google's side.",
      });
    } catch (err) {
      toast({ title: "Failed to create product set", description: err.message, variant: "destructive" });
    } finally {
      setCreatingSet(false);
    }
  };

  if (loading || !config) {
    return <div className="h-64 rounded-xl bg-muted animate-pulse" />;
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Status card */}
      <div className="rounded-xl border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">AI Product Identification Engine</h3>
            <p className="text-xs text-muted-foreground">Google Vision Product Search for POS, Return, Rental, Repair & Inventory</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{config.enabled ? "Enabled" : "Disabled"}</span>
            <Switch checked={config.enabled} onCheckedChange={v => setConfig({ ...config, enabled: v })} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Provider</Label>
            <Select value={config.provider} onValueChange={v => setConfig({ ...config, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="google_vision">Google Vision Product Search</SelectItem>
                <SelectItem value="base44_vision">Base44 Vision LLM (fallback)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Connection Status</Label>
            <div className="flex items-center gap-2 h-9">
              {config.last_test_status === "connected" && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Connected</span>}
              {config.last_test_status === "failed" && <span className="inline-flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" /> Failed</span>}
              {(!config.last_test_status || config.last_test_status === "untested") && <span className="text-sm text-muted-foreground">Untested</span>}
              {config.last_tested_at && <span className="text-xs text-muted-foreground">· {format(new Date(config.last_tested_at), "dd MMM HH:mm")}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Google Cloud configuration */}
      <div className="rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold">Google Cloud Configuration</h3>
        </div>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4 text-xs text-blue-700 space-y-1">
          <p className="font-semibold flex items-center gap-1"><Link2 className="h-3 w-3" /> Setup steps:</p>
          <p>1. Create a Google Cloud project & enable <strong>Vision API</strong>.</p>
          <p>2. Create a service account (IAM → Service Accounts) with <strong>Cloud Vision User</strong> role, download the JSON key.</p>
          <p>3. Paste the JSON key in <strong>App Secrets</strong> as <code className="bg-blue-100 px-1 rounded">GOOGLE_VISION_CREDENTIALS</code>.</p>
          <p>4. Set Project ID + Product Set ID below, then click <strong>Create Product Set</strong>.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>GCP Project ID</Label>
            <Input value={config.gcp_project_id || ""} onChange={e => setConfig({ ...config, gcp_project_id: e.target.value })} placeholder="my-project-123" />
          </div>
          <div>
            <Label>Product Set ID</Label>
            <Input value={config.gcp_product_set_id || ""} onChange={e => setConfig({ ...config, gcp_product_set_id: e.target.value })} placeholder="aurum-catalog" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={config.gcp_location || "us-west1"} onChange={e => setConfig({ ...config, gcp_location: e.target.value })} placeholder="us-west1" />
          </div>
          <div>
            <Label>Product Category</Label>
            <Select value={config.gcp_product_category || "general-v1"} onValueChange={v => setConfig({ ...config, gcp_product_category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general-v1">general-v1 (catch-all)</SelectItem>
                <SelectItem value="apparel-v2">apparel-v2 (accessories/jewellery)</SelectItem>
                <SelectItem value="homegoods-v2">homegoods-v2</SelectItem>
                <SelectItem value="toys-v2">toys-v2</SelectItem>
                <SelectItem value="packagedgoods-v1">packagedgoods-v1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleCreateSet} disabled={creatingSet}>
            {creatingSet ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cloud className="h-4 w-4 mr-2" />} Create / Verify Product Set
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Note: Google indexes reference images asynchronously — newly added images take ~30 minutes before they're searchable.
        </p>
      </div>

      {/* Thresholds */}
      <div className="rounded-xl border p-5">
        <h3 className="text-sm font-semibold mb-4">Confidence Thresholds</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label>High Confidence ≥</Label>
            <Input type="number" value={config.high_threshold} onChange={e => setConfig({ ...config, high_threshold: e.target.value })} />
          </div>
          <div>
            <Label>Medium Confidence ≥</Label>
            <Input type="number" value={config.medium_threshold} onChange={e => setConfig({ ...config, medium_threshold: e.target.value })} />
          </div>
          <div>
            <Label>Min Reference Images</Label>
            <Input type="number" value={config.min_reference_images} onChange={e => setConfig({ ...config, min_reference_images: e.target.value })} />
          </div>
          <div>
            <Label>Image Retention (days)</Label>
            <Input type="number" value={config.image_retention_days} onChange={e => setConfig({ ...config, image_retention_days: e.target.value })} />
          </div>
          <div>
            <Label>Fallback Behavior</Label>
            <Select value={config.fallback_behavior} onValueChange={v => setConfig({ ...config, fallback_behavior: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="barcode">Barcode Scan</SelectItem>
                <SelectItem value="sku_search">SKU Search</SelectItem>
                <SelectItem value="manual">Manual Selection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2 h-9">
              <Switch checked={config.logging_enabled} onCheckedChange={v => setConfig({ ...config, logging_enabled: v })} />
              <Label className="text-xs">Log recognitions</Label>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Google Vision scores (0–100) are similarity scores, not percentages — they tend to be lower than LLM confidence. Default high=70, medium=50.
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Settings
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />} Test Connection
          </Button>
        </div>
      </div>

      {/* Recent recognition logs */}
      <div className="rounded-xl border">
        <div className="p-4 border-b flex items-center gap-2">
          <History className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Recent Recognition Activity</h3>
        </div>
        {logs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">No recognitions yet.</p>
        ) : (
          <div className="divide-y">
            {logs.map(log => (
              <div key={log.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{log.module} · {log.top_candidate_sku || "no match"}</p>
                  <p className="text-xs text-muted-foreground">{log.user_name} · {log.created_date ? format(new Date(log.created_date), "dd MMM HH:mm") : ""}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${log.status === "error" ? "text-red-600" : log.corrected ? "text-amber-600" : "text-emerald-600"}`}>
                    {log.status === "error" ? "Error" : log.corrected ? "Corrected" : `${log.top_confidence}%`}
                  </span>
                  {log.expected_sku && (
                    <p className="text-[10px] text-muted-foreground">Verify: {log.verify_match ? "✓" : "✗"}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}