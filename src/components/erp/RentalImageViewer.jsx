import React, { useState, useEffect } from "react";
import { ImageOff, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Displays privately-stored rental photos by creating signed URLs.
 * Used in view/return dialogs to compare handover vs return condition.
 */
export default function RentalImageViewer({ images = [], label, onCompare }) {
  const [signedUrls, setSignedUrls] = useState({});
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!images || images.length === 0) return;
    let active = true;
    setLoading(true);
    (async () => {
      const urls = {};
      for (const uri of images) {
        if (signedUrls[uri]) continue;
        try {
          const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 3600 });
          if (active) urls[uri] = signed_url;
        } catch (e) { /* skip */ }
      }
      if (active) setSignedUrls(prev => ({ ...prev, ...urls }));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [images?.join(",")]);

  if (!images || images.length === 0) return null;

  return (
    <div>
      {label && <p className="text-sm font-medium mb-1.5">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {loading && <span className="text-xs text-muted-foreground">Loading photos...</span>}
        {images.map((uri, i) => (
          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border cursor-pointer hover:opacity-80" onClick={() => setLightbox(signedUrls[uri] || uri)}>
            {signedUrls[uri]
              ? <img src={signedUrls[uri]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-muted"><ImageOff className="h-4 w-4 text-muted-foreground" /></div>
            }
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="h-6 w-6" /></button>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}