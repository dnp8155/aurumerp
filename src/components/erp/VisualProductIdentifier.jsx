import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { identifyProduct, recordRecognitionSelection, uploadCapturedImage, getRecognitionConfig } from "@/lib/visualIdentification";
import { Camera, Upload, Loader2, Search, RefreshCw, X, Check, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const STAGE = {
  IDLE: "idle",
  CAMERA: "camera",
  UPLOADING: "uploading",
  DETECTING: "detecting",
  RESULTS: "results",
};

/**
 * Reusable Visual Product Identification component.
 *
 * Props:
 * - open, onClose
 * - module: "pos" | "return" | "rental" | "repair" | "inventory"
 * - storeId
 * - onProductSelected(product)  // called with full Product record
 * - expectedSku (optional, for inventory verify)
 * - allowMultiple (default true) — allow confirming multiple detected objects
 */
export default function VisualProductIdentifier({
  open, onClose, module = "pos", storeId, onProductSelected, expectedSku, allowMultiple = true,
}) {
  const [stage, setStage] = useState(STAGE.IDLE);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [config, setConfig] = useState({ high_threshold: 98, medium_threshold: 90, enabled: true });
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState([]);
  const [selectedObjectIndices, setSelectedObjectIndices] = useState({});
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      getRecognitionConfig().then(c => c && setConfig(c)).catch(() => {});
      setStage(STAGE.IDLE);
      setResult(null);
      setError("");
      setCapturedUrl(null);
      setManualSearch("");
      setManualResults([]);
      setSelectedObjectIndices({});
    } else {
      stopCamera();
    }
     
  }, [open]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setError("");
    setStage(STAGE.CAMERA);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      // wait for video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      setError("Camera unavailable: " + (err.message || "permission denied") + ". Use file upload instead.");
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 540;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => handleImageBlob(blob), "image/jpeg", 0.9);
  };

  const onFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageBlob(file);
  };

  const handleImageBlob = async (blob) => {
    if (!blob) return;
    stopCamera();
    setStage(STAGE.UPLOADING);
    setError("");
    try {
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await uploadCapturedImage(file);
      setCapturedUrl(url);
      setStage(STAGE.DETECTING);
      const res = await identifyProduct({ imageUrl: url, module, storeId, expectedSku });
      if (res.error) {
        setError(res.error);
        setStage(STAGE.IDLE);
        return;
      }
      setResult(res);
      setStage(STAGE.RESULTS);
    } catch (err) {
      setError(err.message || "Identification failed");
      setStage(STAGE.IDLE);
    }
  };

  const retake = () => {
    setResult(null);
    setCapturedUrl(null);
    setError("");
    startCamera();
  };

  const confirmObject = async (obj, candidate) => {
    try {
      const product = await base44.entities.Product.get(candidate.product_id);
      const corrected = candidate.sku !== obj.candidates[0]?.sku;
      if (result?.log_id) {
        recordRecognitionSelection({
          logId: result.log_id,
          finalSku: candidate.sku,
          previousPredictionSku: obj.candidates[0]?.sku,
          corrected,
        });
      }
      onProductSelected?.(product);
      toast({ title: "Product confirmed", description: candidate.sku });
    } catch (err) {
      toast({ title: "Error fetching product", description: err.message, variant: "destructive" });
    }
  };

  const doManualSearch = async () => {
    const q = manualSearch.trim();
    if (!q) return;
    try {
      const res = await base44.entities.Product.filter({
        status: "active",
        $or: [
          { sku: { $regex: q, $options: "i" } },
          { name: { $regex: q, $options: "i" } },
          { barcode: { $regex: q, $options: "i" } },
        ],
      });
      setManualResults(res || []);
    } catch {
      setManualResults([]);
    }
  };

  const confirmManual = async (product) => {
    if (result?.log_id) {
      recordRecognitionSelection({
        logId: result.log_id,
        finalSku: product.sku,
        previousPredictionSku: result.objects?.[0]?.candidates?.[0]?.sku,
        corrected: true,
      });
    }
    onProductSelected?.(product);
    toast({ title: "Product selected manually", description: product.sku });
  };

  const renderConfidence = (conf) => {
    const level = conf >= config.high_threshold ? "high" : conf >= config.medium_threshold ? "medium" : "low";
    const colors = {
      high: "bg-emerald-100 text-emerald-700 border-emerald-300",
      medium: "bg-amber-100 text-amber-700 border-amber-300",
      low: "bg-red-100 text-red-700 border-red-300",
    };
    const labels = { high: "High Confidence", medium: "Medium — Confirm", low: "Low Confidence" };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colors[level]}`}>
        {conf}% · {labels[level]}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Visual Product Identification
          </DialogTitle>
        </DialogHeader>

        {!config.enabled && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> AI visual identification is disabled by admin. Use barcode or manual search.
          </div>
        )}

        {/* IDLE */}
        {stage === STAGE.IDLE && config.enabled && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Point the camera at one or more jewellery items. The AI will match them against your product catalogue.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={startCamera} className="h-20 flex-col">
                <Camera className="h-6 w-6 mb-1" /> Open Camera
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-20 flex-col">
                <Upload className="h-6 w-6 mb-1" /> Upload Image
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFileSelected} className="hidden" />
            {expectedSku && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                Inventory Verify mode — expected SKU: <strong>{expectedSku}</strong>
              </div>
            )}
          </div>
        )}

        {/* CAMERA */}
        {stage === STAGE.CAMERA && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{error}</p>}
            <div className="flex gap-2">
              <Button onClick={captureFrame} className="flex-1"><Camera className="mr-2 h-4 w-4" /> Capture</Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /></Button>
              <Button variant="ghost" onClick={() => { stopCamera(); setStage(STAGE.IDLE); }}><X className="h-4 w-4" /></Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFileSelected} className="hidden" />
          </div>
        )}

        {/* UPLOADING / DETECTING */}
        {(stage === STAGE.UPLOADING || stage === STAGE.DETECTING) && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            {capturedUrl ? (
              <img src={capturedUrl} alt="captured" className="h-40 rounded-lg object-cover border" />
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            )}
            <p className="text-sm font-medium">
              {stage === STAGE.UPLOADING ? "Uploading image..." : "Detecting products..."}
            </p>
            {stage === STAGE.DETECTING && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Matching against catalogue & verifying...
              </div>
            )}
          </div>
        )}

        {/* RESULTS */}
        {stage === STAGE.RESULTS && result && (
          <div className="space-y-4">
            {/* Inventory verify banner */}
            {result.verify && (
              <div className={`rounded-lg border p-3 flex items-center gap-2 ${result.verify.match ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                {result.verify.match ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <div className="text-sm">
                  <p className="font-semibold">{result.verify.match ? "MATCH — product verified" : "MISMATCH WARNING"}</p>
                  <p className="text-xs">Expected: {result.verify.expected_sku} · Detected: {result.verify.detected_sku || "none"} ({result.verify.confidence}%)</p>
                </div>
              </div>
            )}

            {result.objects?.length === 0 ? (
              <div className="rounded-lg bg-muted p-6 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">No products could be confidently identified.</p>
                <p className="text-xs text-muted-foreground mt-1">{result.message || "Try a clearer photo, scan the barcode, or search manually."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">{result.objects.length} object{result.objects.length > 1 ? "s" : ""} detected:</p>
                {result.objects.map((obj, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">{obj.label}</span>
                      {obj.candidates[0] && renderConfidence(obj.top_confidence)}
                    </div>
                    {obj.candidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No match found for this object.</p>
                    ) : (
                      <div className="space-y-2">
                        {obj.candidates.map((c, j) => (
                          <div key={j} className="flex items-center gap-3 rounded-md border p-2 hover:bg-muted/50">
                            <img src={c.image_url} alt="" className="h-12 w-12 rounded object-cover border" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{c.sku}</p>
                              <p className="text-[10px] text-muted-foreground">{c.category || ""} {c.dominant_color ? `· ${c.dominant_color}` : ""}</p>
                            </div>
                            <Button size="sm" onClick={() => confirmObject(obj, c)}>
                              <Check className="h-3 w-3 mr-1" /> Confirm
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fallbacks */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">FALLBACK OPTIONS</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={retake}><RefreshCw className="h-3 w-3 mr-1" /> Retake Image</Button>
                <Button variant="outline" size="sm" onClick={() => setManualSearch(" ")}><Search className="h-3 w-3 mr-1" /> Search SKU</Button>
              </div>

              {manualSearch !== "" && (
                <div className="rounded-lg border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by name, SKU, or barcode..."
                      value={manualSearch.trim()}
                      onChange={e => setManualSearch(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && doManualSearch()}
                      autoFocus
                    />
                    <Button size="sm" onClick={doManualSearch}><Search className="h-3 w-3" /></Button>
                  </div>
                  {manualResults.map(p => (
                    <div key={p.id} className="flex items-center gap-2 rounded-md border p-2">
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" /> : <Package className="h-8 w-8 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{p.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => confirmManual(p)}>Select</Button>
                    </div>
                  ))}
                  {manualSearch.trim() !== "" && manualResults.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No products found.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {error && stage !== STAGE.CAMERA && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}