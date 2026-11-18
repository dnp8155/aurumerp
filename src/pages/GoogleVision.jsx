import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Cloud, Camera, Settings, Image as ImageIcon, Scan, AlertTriangle, Check, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function GoogleVision() {
  const { t } = useI18n();
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 shrink-0">
          <Sparkles className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Google Vision — AI Product Identification</h1>
          <p className="text-muted-foreground mt-1">
            Apne product catalogue ke against photo se product auto-identify karne ka complete guide.
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" /> Configure in Settings</Link></Button>
        <Button variant="outline" size="sm" asChild><Link to="/cataloging"><ImageIcon className="mr-2 h-4 w-4" /> Add Reference Images</Link></Button>
        <Button variant="outline" size="sm" asChild><Link to="/pos"><Scan className="mr-2 h-4 w-4" /> Try in POS</Link></Button>
      </div>

      {/* What is it */}
      <Section icon={BookOpen} title="Ye feature kya karta hai?">
        <p>
          <strong>Google Vision Product Search</strong> ek AI engine hai jo aapke product photos ko
          aapke catalogue se match karta hai. User camera se product ki photo leta hai, AI us photo ko
          aapke saved reference images se compare karke top matching products dikhata hai — with confidence score.
        </p>
        <p>
          Ye feature in modules me available hai: <strong>POS</strong>, <strong>Returns</strong>,{" "}
          <strong>Rentals</strong>, <strong>Repairs</strong>, aur <strong>Inventory verification</strong>.
          Barcode scan nahi ho raha? Product label damage ho gaya? Photo se product identify karo.
        </p>
      </Section>

      {/* Setup Steps */}
      <Section icon={Cloud} title="Step 1 — Google Cloud Setup (Ek baar only)">
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">
              Google Cloud Console
            </a>{" "}
            me jaakar naya project create karo (ya existing use karo).
          </li>
          <li>
            <strong>Vision API</strong> enable karo (APIs & Services → Library → search "Vision API" → Enable).
          </li>
          <li>
            IAM → Service Accounts me jaakar naya service account banao. Role:{" "}
            <strong>Cloud Vision User</strong>.
          </li>
          <li>
            Us service account ke liye <strong>JSON key</strong> download karo (Keys tab → Add Key → JSON).
          </li>
          <li>
            App ke <strong>Settings → Secrets</strong> me jaakar ye JSON key paste karo as{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">GOOGLE_VISION_CREDENTIALS</code>.
          </li>
        </ol>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Ye JSON key confidential hai — kisi ke saath share mat karo. Ye already app me set hai: <code className="bg-amber-100 px-1 rounded">GOOGLE_VISION_CREDENTIALS</code>.</p>
        </div>
      </Section>

      {/* Configure in App */}
      <Section icon={Settings} title="Step 2 — App me Configuration">
        <p>
          <Link to="/settings" className="text-blue-600 underline">Settings</Link> page me jaakar{" "}
          <strong>AI Identification</strong> tab me ye fields bharo:
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-semibold">Field</th>
                <th className="text-left p-2 font-semibold">Value / Example</th>
                <th className="text-left p-2 font-semibold">Kya hai</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="p-2 font-medium">GCP Project ID</td><td className="p-2 font-mono text-xs">aurum-erp-123</td><td className="p-2 text-muted-foreground">Google Cloud project ka ID</td></tr>
              <tr><td className="p-2 font-medium">Product Set ID</td><td className="p-2 font-mono text-xs">aurum-catalog</td><td className="p-2 text-muted-foreground">Apna naam do, ye product group ka ID hai</td></tr>
              <tr><td className="p-2 font-medium">Location</td><td className="p-2 font-mono text-xs">us-west1</td><td className="p-2 text-muted-foreground">GCP region (default us-west1 rakho)</td></tr>
              <tr><td className="p-2 font-medium">Product Category</td><td className="p-2">apparel-v2</td><td className="p-2 text-muted-foreground">Jewellery/accessories ke liye <strong>apparel-v2</strong> best hai</td></tr>
            </tbody>
          </table>
        </div>
        <p>Fields bharkar <strong>"Create / Verify Product Set"</strong> button click karo. Ye Google pe aapka product group bana dega.</p>
        <p>Fir <strong>"Save Settings"</strong> click karo. <strong>"Test Connection"</strong> se verify karo.</p>
      </Section>

      {/* Reference Images */}
      <Section icon={ImageIcon} title="Step 3 — Reference Images Add Karo (Cataloging)">
        <p>
          AI tabhi kaam karega jab uske paas products ki photos hongi. Har product ke liye{" "}
          <Link to="/cataloging" className="text-blue-600 underline">Cataloging</Link> page me jaakar{" "}
          <strong>Reference Images</strong> section me photos upload karo.
        </p>
        <ul className="list-disc list-inside space-y-1.5">
          <li>Kam se kam <strong>3 photos</strong> per product — alag angles (front, back, left, right, closeup).</li>
          <li>Photos clear hon, background plain ho, lighting achhi ho.</li>
          <li>Upload karte hi photo automatically Google Vision me sync ho jaati hai.</li>
          <li>3+ photos hone par <span className="text-emerald-600 font-medium">AI Ready</span> badge dikhega.</li>
        </ul>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Google naye reference images ko index karne me <strong>~30 minutes</strong> lagta hai. Naya product add karke turant search nahi hoga — thoda wait karo.</p>
        </div>
      </Section>

      {/* Using AI Scan */}
      <Section icon={Camera} title="Step 4 — AI Scan Kaise Use Karein">
        <p>POS, Returns, Rentals, ya Repairs me <strong>camera icon</strong> / "AI Scan" button click karo:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li><strong>Open Camera</strong> ya <strong>Upload Image</strong> click karo.</li>
          <li>Product ki clear photo lo (ya file upload karo).</li>
          <li>AI photo ko catalogue me search karega — top matching products list honge with confidence %.</li>
          <li>Sahi product pe <strong>Confirm</strong> click karo. Product automatically add ho jaayega.</li>
        </ol>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold text-emerald-600 mb-1">High Confidence (≥70%)</p>
            <p className="text-xs text-muted-foreground">Green badge. Seedha confirm kar sakte ho.</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold text-amber-600 mb-1">Medium (50-69%)</p>
            <p className="text-xs text-muted-foreground">Yellow badge. Check karke confirm karo.</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs font-semibold text-red-600 mb-1">Low (&lt;50%)</p>
            <p className="text-xs text-muted-foreground">Red badge. Manual search ya barcode use karo.</p>
          </div>
        </div>
      </Section>

      {/* Inventory Verify */}
      <Section icon={Check} title="Inventory Verification Mode">
        <p>
          Inventory page me AI scan karne par aap ek <strong>Expected SKU</strong> bhi de sakte ho.
          AI detected product ko expected SKU se compare karega aur <strong>MATCH</strong> ya{" "}
          <strong>MISMATCH</strong> dikhayega — useful for stock audit / QC.
        </p>
      </Section>

      {/* Fallbacks */}
      <Section icon={ArrowRight} title="Fallback Options (AI fail ho to)">
        <p>Agar AI koi product identify nahi kar paata, to 3 fallback options:</p>
        <ul className="list-disc list-inside space-y-1.5">
          <li><strong>Retake Image</strong> — behtar lighting / angle se dobara photo lo.</li>
          <li><strong>Search SKU</strong> — naam, SKU, ya barcode se manually search karo.</li>
          <li><strong>Barcode Scan</strong> — traditional barcode scanner use karo.</li>
        </ul>
        <p>Admin Settings me configure kar sakte ho ki AI fail hone par default fallback kya ho (barcode / sku_search / manual).</p>
      </Section>

      {/* Troubleshooting */}
      <Section icon={AlertTriangle} title="Common Issues & Solutions">
        <div className="space-y-3">
          <Issue
            problem={'Error: "Google Vision not configured"'}
            solution="Settings → AI Identification me GCP Project ID aur Product Set ID bharo, Save karo."
          />
          <Issue
            problem={'Error: "Google service account credentials not set"'}
            solution="App Settings → Secrets me GOOGLE_VISION_CREDENTIALS me JSON key paste karo."
          />
          <Issue
            problem="Naya product search nahi ho raha"
            solution="Google ~30 min lagta hai indexing me. Wait karo, fir try karo."
          />
          <Issue
            problem="Confidence hamesha low aati hai"
            solution={'Reference images badhao (3+ alag angles). Photos clear lo, plain background. Product category "apparel-v2" try karo jewellery ke liye.'}
          />
          <Issue
            problem="Camera open nahi ho raha"
            solution="Browser me camera permission do. HTTPS chahiye (published app pe already hai). File upload as fallback use karo."
          />
        </div>
      </Section>

      {/* Summary */}
      <div className="rounded-xl bg-violet-50 border border-violet-200 p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-2"><Check className="h-5 w-5 text-violet-600" /> Quick Summary</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Google Cloud project + service account JSON key → App Secrets</li>
          <li>Settings → AI Identification: Project ID, Product Set ID, Category bharo → Create Product Set</li>
          <li>Cataloging me har product ke 3+ reference photos upload karo</li>
          <li>30 min wait karo (Google indexing)</li>
          <li>POS/Returns/Rentals/Repairs me camera icon se AI scan karo</li>
        </ol>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Icon className="h-5 w-5 text-violet-600" /> {title}
      </h2>
      <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
    </div>
  );
}

function Issue({ problem, solution }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium text-red-600 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {problem}
      </p>
      <p className="text-sm text-muted-foreground mt-1 flex items-start gap-2">
        <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" /> {solution}
      </p>
    </div>
  );
}