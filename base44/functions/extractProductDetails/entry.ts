import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { image_url, vertical } = body;

    if (!image_url) return Response.json({ error: 'Image URL is required' }, { status: 400 });

    // STEP 1: Reference matching — check if this product was already cataloged
    // Query all products that have images, filtered by vertical for efficiency
    const allProducts = await base44.asServiceRole.entities.Product.list('-updated_date', 200);
    const referenceProducts = (allProducts || []).filter(p =>
      p.images && p.images.length > 0 &&
      (!vertical || p.vertical === vertical)
    );

    if (referenceProducts.length > 0) {
      // Build reference list with first image of each product (max 40 for efficiency)
      const references = referenceProducts.slice(0, 40).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.images[0]
      }));

      const matchPrompt = `You are an expert visual pattern recognition AI for jewelry products.
I will show you a QUERY image (first image) followed by REFERENCE product images.
Your job: find the EXACT or CLOSEST matching reference product.

ANALYZE THESE PATTERN FEATURES CAREFULLY:
1. SHAPE & SILHOUETTE: Overall form, curvature, proportions, edge profile
2. DESIGN PATTERN: Engraving style, motifs, decorative elements, surface texture
3. COLOR & PLATING: Base metal color, plating tone, gradient, finish type
4. STONE PLACEMENT: Stone type, count, arrangement pattern, size distribution
5. CRAFTSMANSHIP: Meenakari, kundan, filigree, embossing, stamping details
6. STRUCTURAL DETAILS: Joints, clasps, connectors, border styles

SCORING RULES:
- 0.90-1.0: EXACT same product (identical design, color, stones, pattern, size)
- 0.75-0.89: Very likely same product (same design, minor variation in color/finish)
- 0.60-0.74: Similar product (same type, different color/stones/pattern)
- 0.40-0.59: Same category but clearly different product
- 0.0-0.39: No reasonable match

Return the BEST match (highest confidence) even if confidence is moderate.
Always return a match_id if any reference is at least 0.40 confidence.

Return JSON with:
- match_id: The reference product ID (or null if truly no match)
- match_name: The matched product name (or null)
- match_sku: The matched product SKU (or null)
- confidence: 0-1 confidence score
- reason: Brief explanation of the match quality`;

      const referenceImageUrls = references.map(r => r.image);
      const allImages = [image_url, ...referenceImageUrls];

      const matchResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: matchPrompt,
        file_urls: allImages,
        response_json_schema: {
          type: "object",
          properties: {
            match_id: { type: "string" },
            match_name: { type: "string" },
            match_sku: { type: "string" },
            confidence: { type: "number" },
            reason: { type: "string" }
          },
          required: ["confidence", "reason"]
        }
      });

      // Lowered threshold to 0.70 for better auto-matching
      if (matchResult.match_id && matchResult.confidence >= 0.70) {
        const matchedProduct = referenceProducts.find(p => p.id === matchResult.match_id);
        if (matchedProduct) {
          return Response.json({
            ...buildExtractionFromProduct(matchedProduct),
            matched_existing: true,
            matched_product_id: matchedProduct.id,
            matched_sku: matchedProduct.sku,
            match_confidence: matchResult.confidence,
            match_reason: matchResult.reason
          });
        }
      }

      // Return likely match for medium confidence (0.55-0.70) so frontend can offer it
      if (matchResult.match_id && matchResult.confidence >= 0.55) {
        const likelyProduct = referenceProducts.find(p => p.id === matchResult.match_id);
        if (likelyProduct) {
          return Response.json({
            ...buildExtractionFromProduct(likelyProduct),
            matched_existing: true,
            matched_product_id: likelyProduct.id,
            matched_sku: likelyProduct.sku,
            match_confidence: matchResult.confidence,
            match_reason: matchResult.reason,
            likely_match: true
          });
        }
      }
    }

    // STEP 2: No match — do fresh AI extraction
    const isBangle = vertical === 'Bangles' || !vertical;

    const prompt = `You are an expert jewelry cataloger specializing in Indian artificial jewelry.
Analyze this product image in detail and extract ALL product attributes automatically.

${isBangle ? 'This is a BANGLE product. Identify the bangle type, material, plating, stones, pattern, finish, and size if visible.' : 'Identify the jewelry type, material, plating, stones, pattern, and finish.'}

Return a comprehensive JSON object with:
- product_name: A descriptive product name
- vertical: "Bangles" if it's a bangle/bracelet/kada, otherwise "Art Jewellery"
- category: Main category
- sub_category: Sub category
- dominant_color: Primary color name
- secondary_color: Secondary color or null
- color_hex: Hex code of dominant color
- material: Base material
- plating: Plating type
- bangle_type: For bangles only
- stones: Stone type
- pattern: Pattern style
- finish: Surface finish
- is_set: true if multiple bangles/pieces visible as a set
- size: Size if determinable
- estimated_weight: Estimated weight in grams if determinable
- confidence: Your confidence level 0-1

Only return valid JSON, no other text.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [image_url],
      response_json_schema: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          vertical: { type: "string", enum: ["Bangles", "Art Jewellery"] },
          category: { type: "string" },
          sub_category: { type: "string" },
          dominant_color: { type: "string" },
          secondary_color: { type: "string" },
          color_hex: { type: "string" },
          material: { type: "string" },
          plating: { type: "string" },
          bangle_type: { type: "string" },
          stones: { type: "string" },
          pattern: { type: "string" },
          finish: { type: "string" },
          is_set: { type: "boolean" },
          size: { type: "string" },
          estimated_weight: { type: "number" },
          confidence: { type: "number" }
        },
        required: ["product_name", "vertical", "category", "dominant_color", "color_hex", "material", "plating", "stones", "pattern", "finish", "is_set", "confidence"]
      }
    });

    return Response.json({
      ...result,
      matched_existing: false,
      match_confidence: 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Helper: build extraction-style response from a stored Product entity
function buildExtractionFromProduct(product) {
  const attrs = product.attributes || {};
  return {
    product_name: product.name,
    vertical: product.vertical,
    category: product.category,
    sub_category: product.sub_category || attrs.sub_category || "",
    dominant_color: product.dominant_color || attrs.color || "",
    secondary_color: attrs.secondary_color || "",
    color_hex: attrs.color_hex || "",
    material: attrs.material || "",
    plating: attrs.plating || "",
    bangle_type: attrs.bangle_type || (product.vertical === "Bangles" ? attrs.sub_category : ""),
    stones: attrs.stones || "",
    pattern: attrs.pattern || "",
    finish: attrs.finish || "",
    is_set: product.is_set || false,
    size: attrs.size || "",
    estimated_weight: product.weight || null,
    confidence: 1.0
  };
}