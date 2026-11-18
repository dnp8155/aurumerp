# Google Vision — AI Product Identification Guide

Aurum ERP me **Google Vision Product Search** integration ka complete documentation.
Ye feature photo se product auto-identify karta hai — POS, Returns, Rentals, Repairs, aur Inventory me.

---

## 📌 Feature Overview

| Module | Use Case |
|--------|----------|
| **POS** | Barcode nahi hai? Photo se product identify karke bill me add karo |
| **Returns** | Customer return me product photo se verify karo |
| **Rentals** | Rental item photo se identify karo |
| **Repairs** | Repair me aaye product ko photo se identify karo |
| **Inventory** | Stock audit me expected SKU vs detected SKU match karo |

---

## 🚀 Step 1 — Google Cloud Setup (Ek baar only)

### 1.1 Google Cloud Project banao
1. [Google Cloud Console](https://console.cloud.google.com) me jaao
2. Naya project create karo (ya existing use karo)
3. **Project ID** note karo (e.g. `aurum-erp-123`)

### 1.2 Vision API enable karo
```
APIs & Services → Library → search "Vision API" → Enable
```

### 1.3 Service Account banao
```
IAM & Admin → Service Accounts → Create Service Account
Role: Cloud Vision User
```

### 1.4 JSON Key download karo
```
Service Account → Keys tab → Add Key → JSON
```
Ek `.json` file download hogi — ye rakh lo.

### 1.5 App Secrets me paste karo
App ke **Settings → Secrets** me jaakar ye JSON key paste karo as:
```
Secret Name: GOOGLE_VISION_CREDENTIALS
Value: <poora JSON content>
```

> ⚠️ Ye JSON key confidential hai — kisi ke saath share mat karo.

---

## ⚙️ Step 2 — App me Configuration

**Settings** page → **AI Identification** tab me jaao aur ye fields bharo:

| Field | Example Value | Description |
|-------|--------------|-------------|
| GCP Project ID | `aurum-erp-123` | Google Cloud project ka ID |
| Product Set ID | `aurum-catalog` | Apna naam do (product group ID) |
| Location | `us-west1` | GCP region (default rakho) |
| Product Category | `apparel-v2` | Jewellery/accessories ke liye best |

### 2.1 Product Set banao
Fields bharkar **"Create / Verify Product Set"** button click karo.
Ye Google pe aapka product group bana dega.

### 2.2 Save & Test
- **Save Settings** click karo
- **Test Connection** se verify karo

### 2.3 Confidence Thresholds (optional)
| Threshold | Default | Meaning |
|-----------|---------|---------|
| High | ≥70% | Green badge — seedha confirm karo |
| Medium | ≥50% | Yellow badge — check karke confirm |
| Low | <50% | Red badge — manual search ya barcode |

> Google Vision scores (0-100) similarity scores hain, percentages nahi.
> Default high=70, medium=50 rakha gaya hai.

---

## 📸 Step 3 — Reference Images Add Karo (Cataloging)

AI tabhi kaam karega jab uske paas products ki photos hongi.

### 3.1 Cataloging page me jaao
Har product ke liye **Reference Images** section me photos upload karo.

### 3.2 Best practices
- Kam se kam **3 photos** per product
- Alag angles: front, back, left, right, closeup
- Clear photos, plain background, achhi lighting
- 3+ photos hone par **AI Ready** badge dikhega

### 3.3 Auto-sync
Upload karte hi photo automatically Google Vision me sync ho jaati hai.
Code flow:

```javascript
// ReferenceImageManager.jsx — upload flow
const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
const created = await base44.entities.ProductReferenceImage.create({
  product_id: product.id,
  sku: product.sku,
  product_name: product.name,
  image_url: file_url,
  image_type: imageType,        // front, back, left, right, closeup, angle, packaging
  is_primary: images.length === 0,
  uploaded_by: user?.full_name || "system",
  ai_recognition_status: "ready",
  status: "active",
});

// Auto-sync to Google Vision (best-effort, non-blocking)
syncReferenceImageToGoogle({
  productId: product.id,
  productName: product.name,
  sku: product.sku,
  category: product.category,
  imageId: created.id,
  imageUrl: file_url,
}).catch(err => console.error("Google Vision sync failed:", err));
```

> ⚠️ Google naye reference images ko index karne me **~30 minutes** lagta hai.
> Naya product add karke turant search nahi hoga — thoda wait karo.

---

## 📷 Step 4 — AI Scan Kaise Use Karein

### 4.1 User flow
POS, Returns, Rentals, ya Repairs me **camera icon** / "AI Scan" button click karo:

1. **Open Camera** ya **Upload Image** click karo
2. Product ki clear photo lo (ya file upload karo)
3. AI photo ko catalogue me search karega — top matching products list honge with confidence %
4. Sahi product pe **Confirm** click karo
5. Product automatically add ho jaayega

### 4.2 Code — identification call
```javascript
// src/lib/visualIdentification.js
export async function identifyProduct({ imageUrl, module, storeId, expectedSku }) {
  const res = await base44.functions.invoke("visualProductIdentification", {
    image_url: imageUrl,
    module,           // "pos" | "return" | "rental" | "repair" | "inventory"
    store_id: storeId,
    expected_sku: expectedSku,  // optional — inventory verify mode
  });
  return res.data;
}
```

### 4.3 Response structure
```javascript
{
  success: true,
  objects: [{
    object_index: 1,
    label: "Detected Products",
    top_confidence: 85,           // 0-100
    confidence_level: "high",    // high | medium | low
    candidates: [{
      product_id: "...",
      sku: "SKU-001",
      name: "Gold Bangle Set",
      category: "Bangles",
      dominant_color: "Gold",
      image_url: "https://...",
      confidence: 85,
      reasoning: "Google Vision Product Search (score 0.850)"
    }]
  }],
  verify: {                      // only if expected_sku was provided
    expected_sku: "SKU-001",
    detected_sku: "SKU-001",
    match: true,
    confidence: 85
  },
  log_id: "...",
  processing_time_ms: 1200
}
```

### 4.4 Confidence levels
| Level | Score | Badge Color | Action |
|-------|-------|-------------|--------|
| High | ≥70% | 🟢 Green | Seedha confirm karo |
| Medium | 50-69% | 🟡 Yellow | Check karke confirm karo |
| Low | <50% | 🔴 Red | Manual search ya barcode use karo |

---

## ✅ Inventory Verification Mode

Inventory page me AI scan karne par aap ek **Expected SKU** bhi de sakte ho.
AI detected product ko expected SKU se compare karega aur **MATCH** ya **MISMATCH** dikhayega.

```javascript
// Inventory verify — expected_sku pass karo
const result = await identifyProduct({
  imageUrl: capturedUrl,
  module: "inventory",
  storeId: store.id,
  expectedSku: "SKU-001"   // ye verify hoga
});

if (result.verify?.match) {
  console.log("✅ Product verified — correct item");
} else {
  console.log("❌ MISMATCH — wrong product!");
}
```

Use cases:
- Stock audit / physical verification
- QC me received goods verify karna
- Return me original product verify karna

---

## 🔄 Fallback Options (AI fail ho to)

Agar AI koi product identify nahi kar paata:

| Fallback | Description |
|----------|-------------|
| **Retake Image** | Behtar lighting / angle se dobara photo lo |
| **Search SKU** | Naam, SKU, ya barcode se manually search karo |
| **Barcode Scan** | Traditional barcode scanner use karo |

Admin Settings me configure kar sakte ho ki AI fail hone par default fallback kya ho:
```
Fallback Behavior: barcode | sku_search | manual
```

---

## 🏗️ Architecture — Code Structure

### Backend Functions
```
base44/functions/
├── visualProductIdentification/   # AI scan — photo se product match
│   └── entry.ts
├── googleVisionSync/               # Reference image sync + product set management
│   └── entry.ts
```

### Shared Library
```
base44/shared/
└── googleVision.js                 # Google Vision API helpers (auth, product set, search)
```

### Frontend
```
src/
├── lib/
│   └── visualIdentification.js     # SDK wrapper functions
├── components/erp/
│   ├── VisualProductIdentifier.jsx # Camera + upload + results UI dialog
│   ├── ReferenceImageManager.jsx   # Reference image upload in Cataloging
│   └── AiIdentificationSettings.jsx # Settings panel
└── pages/
    ├── GoogleVision.jsx            # Ye documentation page
    ├── Settings.jsx                # AI config tab
    └── Cataloging.jsx              # Reference image management
```

### Entities
```
VisualRecognitionConfig    # Admin config (thresholds, GCP settings)
VisualRecognitionLog      # Har scan ka log (confidence, module, result)
ProductReferenceImage     # Per-product reference images
```

---

## 🔑 Key SDK Functions

```javascript
// src/lib/visualIdentification.js

// 1. Product identify karo (photo se)
identifyProduct({ imageUrl, module, storeId, expectedSku })

// 2. Captured image upload karo (public URL chahiye Google Vision ke liye)
uploadCapturedImage(file)   // → { file_url }

// 3. Recognition config get/save
getRecognitionConfig()
saveRecognitionConfig(config)

// 4. Google product set banao
createGoogleProductSet()

// 5. Reference image sync
syncReferenceImageToGoogle({ productId, productName, sku, category, imageId, imageUrl })
removeReferenceImageFromGoogle({ productId, imageId })

// 6. User correction record karo
recordRecognitionSelection({ logId, finalSku, previousPredictionSku, corrected })

// 7. Confidence level helper
confidenceLevel(confidence, { highThreshold: 70, mediumThreshold: 50 })
// → "high" | "medium" | "low"
```

---

## 🐛 Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| `Error: "Google Vision not configured"` | Settings → AI Identification me GCP Project ID aur Product Set ID bharo, Save karo |
| `Error: "Google service account credentials not set"` | App Settings → Secrets me `GOOGLE_VISION_CREDENTIALS` me JSON key paste karo |
| Naya product search nahi ho raha | Google ~30 min lagta hai indexing me. Wait karo, fir try karo |
| Confidence hamesha low aati hai | Reference images badhao (3+ alag angles). Photos clear lo, plain background. Category `apparel-v2` try karo |
| Camera open nahi ho raha | Browser me camera permission do. HTTPS chahiye. File upload as fallback use karo |
| `Error: "Visual identification is disabled by admin"` | Settings me AI Identification toggle ON karo |
| Product Set create fail | GCP Project ID aur Product Set ID sahi bharo. Service account me `Cloud Vision User` role hona chahiye |

---

## 📊 Recognition Logs

Har AI scan ka log `VisualRecognitionLog` entity me save hota hai:

| Field | Description |
|-------|-------------|
| `module` | pos, return, rental, repair, inventory |
| `top_candidate_sku` | AI ka top match SKU |
| `top_confidence` | Confidence score (0-100) |
| `confidence_level` | high, medium, low, none |
| `final_selected_sku` | User ne final kaunsa select kiya |
| `corrected` | User ne AI result change kiya? (true/false) |
| `status` | success, error, corrected |
| `expected_sku` | Inventory verify mode me expected SKU |
| `verify_match` | Match hua ya nahi (true/false/null) |
| `processing_time_ms` | Processing time |

Logs Settings → AI Identification → "Recent Recognition Activity" section me dekh sakte ho.

---

## ✅ Quick Summary

1. **Google Cloud** project + service account JSON key → App Secrets (`GOOGLE_VISION_CREDENTIALS`)
2. **Settings** → AI Identification: Project ID, Product Set ID, Category bharo → Create Product Set
3. **Cataloging** me har product ke 3+ reference photos upload karo
4. **30 min wait** karo (Google indexing time)
5. **POS/Returns/Rentals/Repairs** me camera icon se AI scan karo
6. Confidence dekhke **Confirm** karo — ya fallback (barcode/manual) use karo

---

## 🔗 Related Pages

- **Settings** → `/settings` (AI Identification tab)
- **Cataloging** → `/cataloging` (Reference images)
- **POS** → `/pos` (AI scan try karo)
- **Google Vision Guide** → `/google-vision` (in-app documentation)