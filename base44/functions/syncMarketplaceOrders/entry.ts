import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const marketplace = body.marketplace; // "shopify" | "amazon"
    const daysBack = body.daysBack || 30;

    if (!marketplace || !['shopify', 'amazon'].includes(marketplace)) {
      return Response.json({ error: 'Invalid marketplace. Use "shopify" or "amazon".' }, { status: 400 });
    }

    // Fetch orders from the marketplace
    let externalOrders = [];
    if (marketplace === 'shopify') {
      const result = await fetchShopifyOrders(daysBack);
      if (result.error) return Response.json({ error: result.error }, { status: 502 });
      externalOrders = result.orders;
    } else {
      const result = await fetchAmazonOrders(daysBack);
      if (result.error) return Response.json({ error: result.error }, { status: 502 });
      externalOrders = result.orders;
    }

    // Upsert into Order entity
    let created = 0, updated = 0, skipped = 0;
    for (const ext of externalOrders) {
      if (!ext.marketplace_order_id) { skipped++; continue; }

      // Check if order already exists by marketplace_order_id
      const existing = await base44.asServiceRole.entities.Order.filter({
        marketplace_order_id: ext.marketplace_order_id,
        marketplace
      });

      const orderData = {
        ...ext,
        marketplace,
        last_synced_date: new Date().toISOString()
      };

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.Order.update(existing[0].id, orderData);
        updated++;
      } else {
        // Generate internal order number if not provided
        if (!orderData.order_number) {
          orderData.order_number = `${marketplace === 'shopify' ? 'SHP' : 'AMZ'}-${ext.marketplace_order_id}`;
        }
        await base44.asServiceRole.entities.Order.create(orderData);
        created++;
      }
    }

    return Response.json({
      success: true,
      marketplace,
      fetched: externalOrders.length,
      created,
      updated,
      skipped,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ─── Shopify ──────────────────────────────────────────────
async function fetchShopifyOrders(daysBack) {
  const shopDomain = secrets.get("SHOPIFY_SHOP_DOMAIN");
  const accessToken = secrets.get("SHOPIFY_ACCESS_TOKEN");

  if (!shopDomain || !accessToken) {
    return { error: "Shopify credentials not configured. Set SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN in Settings > Environment Variables." };
  }

  const createdAtMin = new Date(Date.now() - daysBack * 86400000).toISOString();
  const url = `https://${shopDomain}/admin/api/2024-01/orders.json?status=any&created_at_min=${createdAtMin}&limit=250`;

  try {
    const resp = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken }
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { error: `Shopify API error (${resp.status}): ${txt}` };
    }
    const data = await resp.json();
    const orders = (data.orders || []).map(mapShopifyOrder);
    return { orders };
  } catch (err) {
    return { error: `Shopify fetch failed: ${err.message}` };
  }
}

function mapShopifyOrder(o) {
  const items = (o.line_items || []).map(li => ({
    product_id: String(li.product_id || ""),
    sku: li.sku || "",
    product_name: li.name || li.title || "",
    quantity: li.quantity || 0,
    unit_price: Number(li.price || 0),
    total_price: Number(li.price || 0) * (li.quantity || 0),
    image_url: li.image_url || ""
  }));

  const subtotal = Number(o.subtotal_price || 0);
  const shipping = Number(o.total_shipping_price_set?.shop_money?.amount || o.total_shipping_price_set?.presentment_money?.amount || 0);
  const tax = Number(o.total_tax || 0);
  const total = Number(o.total_price || 0);

  const addr = o.shipping_address || {};
  const customer = o.customer || {};

  return {
    marketplace_order_id: String(o.id),
    order_number: o.name || `#${o.order_number}`,
    customer_name: [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Guest",
    customer_email: customer.email || o.email || "",
    customer_phone: customer.phone || addr.phone || "",
    shipping_address: [addr.address1, addr.address2].filter(Boolean).join(", "),
    shipping_city: addr.city || "",
    shipping_state: addr.province || "",
    shipping_pincode: addr.zip || "",
    items,
    subtotal,
    shipping_charge: shipping,
    tax_amount: tax,
    total_amount: total,
    payment_method: o.financial_status === "paid" ? "prepaid" : "cod",
    payment_status: o.financial_status === "paid" ? "paid" : "pending",
    fulfillment_status: mapShopifyFulfillment(o.fulfillment_status),
    channel: "marketplace",
    order_date: o.created_at,
    tracking_number: (o.fulfillments || [])[0]?.tracking_number || "",
    transporter: (o.fulfillments || [])[0]?.tracking_company || ""
  };
}

function mapShopifyFulfillment(status) {
  if (status === "fulfilled") return "delivered";
  if (status === "partial") return "packed";
  if (status === "unfulfilled") return "pending";
  return "pending";
}

// ─── Amazon SP-API ─────────────────────────────────────────
async function fetchAmazonOrders(daysBack) {
  const sellerId = secrets.get("AMAZON_SELLER_ID");
  const marketplaceId = secrets.get("AMAZON_MARKETPLACE_ID");
  const lwaClientId = secrets.get("AMAZON_LWA_CLIENT_ID");
  const lwaClientSecret = secrets.get("AMAZON_LWA_CLIENT_SECRET");
  const refreshToken = secrets.get("AMAZON_REFRESH_TOKEN");

  if (!sellerId || !marketplaceId || !lwaClientId || !lwaClientSecret || !refreshToken) {
    return { error: "Amazon SP-API credentials not configured. Set AMAZON_SELLER_ID, AMAZON_MARKETPLACE_ID, AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, and AMAZON_REFRESH_TOKEN in Settings > Environment Variables." };
  }

  // Step 1: Get LWA access token
  const tokenResp = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: lwaClientId,
      client_secret: lwaClientSecret,
      refresh_token: refreshToken
    })
  });
  if (!tokenResp.ok) {
    const txt = await tokenResp.text();
    return { error: `Amazon LWA token error (${tokenResp.status}): ${txt}` };
  }
  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token;

  // Step 2: Fetch orders
  const createdAfter = new Date(Date.now() - daysBack * 86400000).toISOString();
  const region = marketplaceId === "A21TJRUUN4KGV" ? "sellingpartnerapi-eu.amazon.com" : "sellingpartnerapi-na.amazon.com";
  const ordersUrl = `https://${region}/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${createdAfter}&MaxResultsPerPage=100`;

  const ordersResp = await fetch(ordersUrl, {
    headers: {
      "x-amz-access-token": accessToken,
      "x-amz-date": new Date().toUTCString()
    }
  });
  if (!ordersResp.ok) {
    const txt = await ordersResp.text();
    return { error: `Amazon Orders API error (${ordersResp.status}): ${txt}` };
  }
  const ordersData = await ordersResp.json();
  const rawOrders = ordersData.payload?.Orders || [];

  // Step 3: Map orders (items fetched lazily in real production; here we map summary)
  const orders = rawOrders.map(mapAmazonOrder);
  return { orders };
}

function mapAmazonOrder(o) {
  const total = Number(o.OrderTotal?.Amount || 0);
  const items = (o.OrderItems || []).map(oi => ({
    product_id: String(oi.ASIN || ""),
    sku: oi.SellerSKU || "",
    product_name: oi.Title || "",
    quantity: Number(oi.QuantityOrdered || 0),
    unit_price: Number(oi.ItemPrice?.Amount || 0) / (Number(oi.QuantityOrdered || 1) || 1),
    total_price: Number(oi.ItemPrice?.Amount || 0),
    image_url: ""
  }));

  return {
    marketplace_order_id: o.AmazonOrderId,
    order_number: o.AmazonOrderId,
    customer_name: o.BuyerInfo?.BuyerName || "Amazon Customer",
    customer_email: o.BuyerInfo?.BuyerEmail || "",
    customer_phone: "",
    shipping_address: [o.ShippingAddress?.AddressLine1, o.ShippingAddress?.AddressLine2].filter(Boolean).join(", "),
    shipping_city: o.ShippingAddress?.City || "",
    shipping_state: o.ShippingAddress?.StateOrRegion || "",
    shipping_pincode: o.ShippingAddress?.PostalCode || "",
    items,
    subtotal: total,
    shipping_charge: 0,
    tax_amount: 0,
    total_amount: total,
    payment_method: o.PaymentMethod === "COD" ? "cod" : "prepaid",
    payment_status: o.OrderStatus === "Canceled" ? "failed" : o.PaymentMethod === "COD" ? "pending" : "paid",
    fulfillment_status: mapAmazonFulfillment(o.OrderStatus),
    channel: "marketplace",
    order_date: o.PurchaseDate,
    tracking_number: "",
    transporter: ""
  };
}

function mapAmazonFulfillment(status) {
  const map = {
    "Pending": "pending",
    "Unshipped": "confirmed",
    "PartiallyShipped": "packed",
    "Shipped": "dispatched",
    "Canceled": "cancelled",
    "Delivered": "delivered"
  };
  return map[status] || "pending";
}