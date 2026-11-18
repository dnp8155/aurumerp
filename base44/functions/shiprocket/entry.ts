import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { getToken, getRates, createOrder, trackByAwb } from "../../shared/shiprocket.js";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    const token = await getToken();

    if (action === "rates") {
      const { pickup_postcode, delivery_postcode, weight, cod, declared_value, length, breadth, height } = body;
      if (!pickup_postcode || !delivery_postcode) {
        return Response.json({ error: "pickup_postcode and delivery_postcode required" }, { status: 400 });
      }
      const result = await getRates(token, { pickup_postcode, delivery_postcode, weight, cod, declared_value, length, breadth, height });
      return Response.json({ rates: result });
    }

    if (action === "book") {
      const { order_data } = body;
      if (!order_data) return Response.json({ error: "order_data required" }, { status: 400 });
      const result = await createOrder(token, order_data);
      return Response.json({ order: result });
    }

    if (action === "track") {
      const { awb } = body;
      if (!awb) return Response.json({ error: "awb required" }, { status: 400 });
      const result = await trackByAwb(token, awb);
      return Response.json({ tracking: result });
    }

    return Response.json({ error: "Unknown action. Use 'rates', 'book', or 'track'." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}