import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { parseCredentials, getAccessToken, searchProducts } from '../../shared/googleVision.js';

export default async function(req) {
  let base44, user;
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { image_url, module, store_id, expected_sku } = body;
    if (!image_url) return Response.json({ error: 'image_url is required' }, { status: 400 });

    const startedAt = Date.now();

    // Load admin config
    let config = {
      enabled: true,
      high_threshold: 70,
      medium_threshold: 50,
      provider: 'google_vision',
      logging_enabled: true,
      gcp_project_id: '',
      gcp_location: 'us-west1',
      gcp_product_set_id: '',
      gcp_product_category: 'general-v1',
    };
    try {
      const cfgRes = await base44.asServiceRole.entities.VisualRecognitionConfig.list('-created_date', 1);
      if (cfgRes && cfgRes.length > 0) config = { ...config, ...cfgRes[0] };
    } catch (e) { /* entity may not exist yet */ }

    if (!config.enabled) {
      return Response.json({ error: 'Visual identification is disabled by admin', disabled: true }, { status: 403 });
    }

    if (!config.gcp_project_id || !config.gcp_product_set_id) {
      return Response.json({
        error: 'Google Vision not configured. Set GCP Project ID and Product Set ID in Settings → AI Identification.',
        not_configured: true,
      }, { status: 400 });
    }

    const credsRaw = process.env.GOOGLE_VISION_CREDENTIALS;
    if (!credsRaw) {
      return Response.json({
        error: 'Google service account credentials not set. Add GOOGLE_VISION_CREDENTIALS in app secrets.',
        not_configured: true,
      }, { status: 400 });
    }

    const credentials = parseCredentials(credsRaw);
    const token = await getAccessToken(credentials);

    // Search the captured image against the product set
    const searchRes = await searchProducts(
      token, config.gcp_project_id, config.gcp_location,
      config.gcp_product_set_id, image_url, 10, config.gcp_product_category
    );

    const response = (searchRes.responses && searchRes.responses[0]) || {};
    if (response.error) {
      return Response.json({
        error: `Google Vision error: ${response.error.message}`,
        details: response.error,
      }, { status: 500 });
    }

    const results = (response.productSearchResults && response.productSearchResults.results) || [];

    // Extract product ids from result names (we used Base44 product id as Google productId)
    const productIds = results.map(r => {
      const name = (r.product && r.product.name) || '';
      return name.split('/').pop();
    }).filter(Boolean);

    // Fetch matched products from our DB
    const productMap = {};
    for (const pid of productIds) {
      try {
        const p = await base44.asServiceRole.entities.Product.get(pid);
        if (p) productMap[pid] = p;
      } catch (e) { /* skip */ }
    }

    // Build ranked candidates
    const candidates = results.map((r) => {
      const pid = ((r.product && r.product.name) || '').split('/').pop();
      const p = productMap[pid];
      if (!p) return null;
      const confidence = Math.round((r.score || 0) * 100);
      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        sub_category: p.sub_category,
        vertical: p.vertical,
        dominant_color: p.dominant_color,
        image_url: (p.images && p.images[0]) || null,
        confidence,
        reasoning: `Google Vision Product Search (score ${(r.score || 0).toFixed(3)})`,
      };
    }).filter(Boolean);

    // Product Search returns ranked matches for the whole image (not per-object segmentation)
    const top = candidates[0];
    let level = 'low';
    if (top) {
      if (top.confidence >= config.high_threshold) level = 'high';
      else if (top.confidence >= config.medium_threshold) level = 'medium';
    }
    const matchedObjects = candidates.length > 0 ? [{
      object_index: 1,
      label: 'Detected Products',
      candidates,
      top_confidence: top?.confidence || 0,
      confidence_level: level,
    }] : [];

    // Inventory verify
    let verifyResult = null;
    if (expected_sku) {
      const topMatch = candidates[0];
      verifyResult = {
        expected_sku,
        detected_sku: topMatch?.sku || null,
        match: topMatch?.sku === expected_sku,
        confidence: topMatch?.confidence || 0,
      };
    }

    const processingTime = Date.now() - startedAt;
    const topSku = candidates[0]?.sku || null;
    const topConf = candidates[0]?.confidence || 0;

    const logId = await safeLog(base44, user, module, store_id, image_url,
      matchedObjects.length, topSku, topConf, level, config.provider, processingTime,
      'success', expected_sku, verifyResult?.match ?? null);

    return Response.json({
      success: true,
      objects: matchedObjects,
      verify: verifyResult,
      log_id: logId,
      processing_time_ms: processingTime,
      candidate_pool_size: results.length,
    });
  } catch (error) {
    try {
      if (base44 && user) {
        await base44.asServiceRole.entities.VisualRecognitionLog.create({
          user_id: user.id,
          user_name: user.full_name || user.email,
          module: 'unknown',
          status: 'error',
          error_message: error.message,
          processing_time_ms: 0,
        });
      }
    } catch (e) { /* ignore */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function safeLog(base44, user, module, storeId, imageUrl, objCount, topSku, topConf, level, provider, processingTime, status, expectedSku, verifyMatch) {
  try {
    const created = await base44.asServiceRole.entities.VisualRecognitionLog.create({
      user_id: user.id,
      user_name: user.full_name || user.email,
      module: module || 'unknown',
      store_id: storeId || null,
      captured_image_url: imageUrl || null,
      detected_object_count: objCount || 0,
      top_candidate_sku: topSku || null,
      top_confidence: topConf || 0,
      confidence_level: level || 'low',
      provider: provider || 'google_vision',
      processing_time_ms: processingTime || 0,
      status: status || 'success',
      expected_sku: expectedSku || null,
      verify_match: verifyMatch ?? null,
    });
    return created?.id || null;
  } catch (e) { return null; }
}