import { base44 } from "@/api/base44Client";

/**
 * Invoke the server-side Visual Product Identification engine (Google Vision Product Search).
 * The captured image must already be uploaded (public URL) before calling.
 * Returns: { success, objects[], verify, log_id, processing_time_ms }
 */
export async function identifyProduct({ imageUrl, module, storeId, expectedSku }) {
  const res = await base44.functions.invoke("visualProductIdentification", {
    image_url: imageUrl,
    module,
    store_id: storeId,
    expected_sku: expectedSku,
  });
  return res.data;
}

/**
 * Record the user's final selection (correction data) against a recognition log.
 */
export async function recordRecognitionSelection({ logId, finalSku, previousPredictionSku, corrected }) {
  if (!logId) return;
  try {
    await base44.entities.VisualRecognitionLog.update(logId, {
      final_selected_sku: finalSku,
      previous_prediction_sku: previousPredictionSku || null,
      corrected: !!corrected,
      status: corrected ? "corrected" : "success",
    });
  } catch (e) {
    /* best-effort */
  }
}

/**
 * Get the current AI recognition config (single record, latest).
 */
export async function getRecognitionConfig() {
  const data = await base44.entities.VisualRecognitionConfig.list("-created_date", 1);
  return (data && data[0]) || null;
}

/**
 * Save recognition config (creates or updates the single record).
 */
export async function saveRecognitionConfig(config) {
  const existing = await getRecognitionConfig();
  if (existing) {
    return base44.entities.VisualRecognitionConfig.update(existing.id, config);
  }
  return base44.entities.VisualRecognitionConfig.create(config);
}

/**
 * Upload a captured image to public storage and return the URL.
 * (Public URL is required so Google Vision can fetch the image for recognition.)
 */
export async function uploadCapturedImage(file) {
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  return file_url;
}

/**
 * Create / verify the Google Cloud product set.
 */
export async function createGoogleProductSet() {
  const res = await base44.functions.invoke("googleVisionSync", { operation: "createProductSet" });
  return res.data;
}

/**
 * Sync a reference image to the Google product set (called after uploading to our DB).
 */
export async function syncReferenceImageToGoogle({ productId, productName, sku, category, imageId, imageUrl }) {
  const res = await base44.functions.invoke("googleVisionSync", {
    operation: "syncReferenceImage",
    product_id: productId,
    product_name: productName,
    sku,
    category,
    image_id: imageId,
    image_url: imageUrl,
  });
  return res.data;
}

/**
 * Remove a reference image from the Google product set.
 */
export async function removeReferenceImageFromGoogle({ productId, imageId }) {
  const res = await base44.functions.invoke("googleVisionSync", {
    operation: "removeReferenceImage",
    product_id: productId,
    image_id: imageId,
  });
  return res.data;
}

/**
 * Confidence level helper.
 */
export function confidenceLevel(confidence, { highThreshold = 70, mediumThreshold = 50 } = {}) {
  if (confidence >= highThreshold) return "high";
  if (confidence >= mediumThreshold) return "medium";
  return "low";
}