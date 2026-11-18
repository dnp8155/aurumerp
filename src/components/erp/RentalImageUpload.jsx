import React, { useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

/**
 * Uploads product condition photos privately (UploadPrivateFile).
 * Returns file_uri list via onChange. Used at rental handover & return.
 */
export default function RentalImageUpload({ images = [], onChange, label = "Product Condition Photos", max = 6 }) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    if (images.length + files.length > max) {
      toast({ title: `Max ${max} photos allowed`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uploaded.push(file_uri);
      }
      onChange([...images, ...uploaded]);
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground">{images.length}/{max}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Product ki condition photo le lo — return pe damage dispute me kaam aayega</p>
      <div className="flex flex-wrap gap-2">
        {images.map((uri, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
            <img src={uri} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {images.length < max && (
          <label className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Camera className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-0.5">Add</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  );
}