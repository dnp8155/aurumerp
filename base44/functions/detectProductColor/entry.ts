import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { image_url } = body;

    if (!image_url) return Response.json({ error: 'Image URL is required' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this product image and identify the dominant color(s) of the jewelry/accessory item. Return a JSON object with: primary_color (the most dominant color name), secondary_color (second most prominent, or null), and color_hex (hex code of the primary color). Only return valid JSON, no other text.`,
      file_urls: [image_url],
      response_json_schema: {
        type: "object",
        properties: {
          primary_color: { type: "string" },
          secondary_color: { type: "string" },
          color_hex: { type: "string" }
        },
        required: ["primary_color", "color_hex"]
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}