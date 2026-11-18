import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { validateQuoteInput, validateBookInput, compareQuotes, bookShipment, trackShipment } from "../../shared/courierCompare.js";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "quote") {
      const { pickup_postcode, delivery_postcode, weight, cod, declared_value, length, breadth, height } = body;
      const errors = validateQuoteInput({ pickup_postcode, delivery_postcode, weight });
      if (errors.length) return Response.json({ error: errors.join("; ") }, { status: 400 });
      const results = await compareQuotes({ pickup_postcode, delivery_postcode, weight, cod, declared_value, length, breadth, height });
      return Response.json({ quote: results });
    }

    if (action === "book") {
      const { provider, order_data } = body;
      const errors = validateBookInput({ provider, order_data });
      if (errors.length) return Response.json({ error: errors.join("; ") }, { status: 400 });
      const result = await bookShipment({ provider, order_data });
      return Response.json({ booking: result });
    }

    if (action === "track") {
      const { provider, awb } = body;
      if (!provider || !awb) return Response.json({ error: "provider and awb are required" }, { status: 400 });
      const result = await trackShipment({ provider, awb });
      return Response.json({ tracking: result });
    }

    return Response.json({ error: "Unknown action. Use 'quote', 'book', or 'track'." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}