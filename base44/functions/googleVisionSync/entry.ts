import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  parseCredentials, getAccessToken, ensureProductSet, ensureProduct,
  addReferenceImage, deleteReferenceImage
} from '../../shared/googleVision.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { operation } = body;

    // Load config
    let config = {
      gcp_project_id: '',
      gcp_location: 'us-west1',
      gcp_product_set_id: '',
      gcp_product_category: 'general-v1',
    };
    try {
      const cfgRes = await base44.asServiceRole.entities.VisualRecognitionConfig.list('-created_date', 1);
      if (cfgRes && cfgRes.length > 0) config = { ...config, ...cfgRes[0] };
    } catch (e) { /* entity may not exist yet */ }

    if (!config.gcp_project_id) {
      return Response.json({ error: 'GCP Project ID not configured. Set it in Settings → AI Identification.' }, { status: 400 });
    }

    const credsRaw = process.env.GOOGLE_VISION_CREDENTIALS;
    if (!credsRaw) {
      return Response.json({ error: 'Google service account credentials not set.' }, { status: 400 });
    }

    const credentials = parseCredentials(credsRaw);
    const token = await getAccessToken(credentials);

    if (operation === 'createProductSet') {
      if (!config.gcp_product_set_id) {
        return Response.json({ error: 'Product Set ID not configured.' }, { status: 400 });
      }
      const result = await ensureProductSet(
        token, config.gcp_project_id, config.gcp_location,
        config.gcp_product_set_id, 'Aurum ERP Catalog'
      );
      return Response.json({ success: true, ...result });
    }

    if (operation === 'syncReferenceImage') {
      const { product_id, product_name, sku, category, image_id, image_url } = body;
      if (!product_id || !image_id || !image_url) {
        return Response.json({ error: 'product_id, image_id, image_url are required' }, { status: 400 });
      }
      if (!config.gcp_product_set_id) {
        return Response.json({ error: 'Product Set ID not configured.' }, { status: 400 });
      }
      // Ensure product exists in the set (using configured product category)
      await ensureProduct(
        token, config.gcp_project_id, config.gcp_location, config.gcp_product_set_id,
        product_id, product_name, `${sku || ''} | ${category || ''}`, config.gcp_product_category
      );
      // Add the reference image
      const refResult = await addReferenceImage(
        token, config.gcp_project_id, config.gcp_location,
        product_id, image_id, image_url
      );
      return Response.json({ success: true, referenceImage: refResult });
    }

    if (operation === 'removeReferenceImage') {
      const { product_id, image_id } = body;
      if (!product_id || !image_id) {
        return Response.json({ error: 'product_id, image_id are required' }, { status: 400 });
      }
      try {
        await deleteReferenceImage(token, config.gcp_project_id, config.gcp_location, product_id, image_id);
        return Response.json({ success: true });
      } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Unknown operation: ' + operation }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}