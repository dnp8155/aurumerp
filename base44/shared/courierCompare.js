import { secrets } from "base44:runtime";
import {
  getToken as getShiprocketToken,
  getRates as shiprocketGetRates,
  createOrder as shiprocketCreateOrder,
  trackByAwb as shiprocketTrackByAwb,
} from "./shiprocket.js";

// ---------- Input validation ----------
export function validateQuoteInput(input) {
  const errors = [];
  if (!input.pickup_postcode) errors.push("pickup_postcode is required");
  if (!input.delivery_postcode) errors.push("delivery_postcode is required");
  const w = Number(input.weight);
  if (!w || w <= 0) errors.push("weight must be greater than 0");
  return errors;
}

export function validateBookInput(input) {
  const errors = [];
  if (!input.provider) errors.push("provider is required (shiprocket | bluedart | dtdc)");
  if (!input.order_data) errors.push("order_data is required");
  return errors;
}

// ---------- Shiprocket ----------
function normalizeShiprocketQuotes(data) {
  const couriers = data?.data?.available_courier_companies || [];
  return couriers.map((c) => ({
    provider: "shiprocket",
    courier_name: c.courier_name,
    service_name: c.courier_name,
    serviceable: true,
    rate: Number(c.rate) || null,
    currency: "INR",
    cod_available: !!c.cod,
    cod_charge: Number(c.cod_charges) || 0,
    estimated_delivery_days: c.estimated_delivery_days ? Number(c.estimated_delivery_days) : null,
    estimated_delivery_date: c.edd || null,
    rating: c.rating ? Number(c.rating) : null,
    provider_ref: String(c.courier_company_id),
  }));
}

async function shiprocketQuote(input) {
  const email = secrets.get("SHIPROCKET_EMAIL");
  const password = secrets.get("SHIPROCKET_PASSWORD");
  if (!email || !password) {
    return { provider: "shiprocket", status: "not_configured", message: "Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in Secrets.", quotes: [] };
  }
  try {
    const token = await getShiprocketToken();
    const data = await shiprocketGetRates(token, input);
    return { provider: "shiprocket", status: "ok", quotes: normalizeShiprocketQuotes(data) };
  } catch (e) {
    return { provider: "shiprocket", status: "error", message: e.message, quotes: [] };
  }
}

async function shiprocketBook(input) {
  const token = await getShiprocketToken();
  const result = await shiprocketCreateOrder(token, input.order_data);
  return {
    provider: "shiprocket",
    status: "ok",
    awb_code: result.awb_code || result.shipment_id || null,
    courier_name: result.courier_name || null,
    shiprocket_order_id: result.order_id || null,
    raw: result,
  };
}

async function shiprocketTrack(input) {
  const token = await getShiprocketToken();
  const result = await shiprocketTrackByAwb(token, input.awb);
  return { provider: "shiprocket", status: "ok", tracking: result };
}

// ---------- Blue Dart ----------
// Confirmed endpoint (DHL developer portal): Transit Time Finder returns ETA only.
// Blue Dart does NOT expose a live rate via public API; rate comes from negotiated rate card / Waybill.
async function blueDartGetJwt(base, consumerKey, consumerSecret) {
  const res = await fetch(`${base}/in/transportation/authenticator/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consumerKey, consumerSecret }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  return data.jwtToken || data.token || data.access_token || null;
}

async function blueDartQuote(input) {
  const loginId = secrets.get("BLUE_DART_LOGIN_ID");
  const licenceKey = secrets.get("BLUE_DART_LICENCE_KEY");
  const base = secrets.get("BLUE_DART_API_BASE") || "https://apigateway.bluedart.com";
  if (!loginId || !licenceKey) {
    return { provider: "bluedart", status: "not_configured", message: "Add BLUE_DART_LOGIN_ID and BLUE_DART_LICENCE_KEY in Secrets.", quotes: [] };
  }
  const consumerKey = secrets.get("BLUE_DART_CONSUMER_KEY");
  const consumerSecret = secrets.get("BLUE_DART_CONSUMER_SECRET");
  let jwt = null;
  if (consumerKey && consumerSecret) {
    try { jwt = await blueDartGetJwt(base, consumerKey, consumerSecret); } catch { jwt = null; }
  }
  const payload = {
    pinCodeFrom: String(input.pickup_postcode),
    pinCodeTo: String(input.delivery_postcode),
    productCode: "A",
    subProductCode: "P",
    pudate: `/Date(${Date.now()})/`,
    pickupTime: "16:00",
    profile: { LoginID: loginId, LicenceKey: licenceKey, Api_type: "S" },
  };
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers["JWTToken"] = jwt;
  try {
    const res = await fetch(`${base}/in/transportation/time-finder/v1`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    const edd = data?.expectedDeliveryDate || data?.ExpectedDeliveryDate || null;
    return {
      provider: "bluedart",
      status: "ok",
      quotes: [{
        provider: "bluedart",
        courier_name: "Blue Dart",
        service_name: "Apex / Surface",
        serviceable: !!edd,
        rate: null,
        currency: "INR",
        cod_available: false,
        cod_charge: 0,
        estimated_delivery_days: null,
        estimated_delivery_date: edd,
        provider_ref: "bluedart",
        note: "ETA via Blue Dart Transit Time Finder. Live rate not exposed by public API — apply negotiated rate card.",
      }],
    };
  } catch (e) {
    return { provider: "bluedart", status: "error", message: e.message, quotes: [] };
  }
}

async function blueDartBook() {
  return { provider: "bluedart", status: "pending_docs", message: "Blue Dart Waybill/booking API endpoint needs confirmation from your Blue Dart API docs before enabling booking." };
}

async function blueDartTrack() {
  return { provider: "bluedart", status: "pending_docs", message: "Blue Dart Tracking API endpoint needs confirmation from your Blue Dart API docs." };
}

// ---------- DTDC ----------
// Exact rate/serviceability + booking endpoints must be confirmed from the user's DTDC API docs.
async function dtdcQuote(input) {
  const devId = secrets.get("DTDC_DEVELOPER_ID");
  const devPin = secrets.get("DTDC_DEVELOPER_PIN");
  const base = secrets.get("DTDC_API_BASE");
  if (!devId || !devPin || !base) {
    return { provider: "dtdc", status: "not_configured", message: "Add DTDC_DEVELOPER_ID, DTDC_DEVELOPER_PIN and DTDC_API_BASE in Secrets.", quotes: [] };
  }
  return {
    provider: "dtdc",
    status: "pending_docs",
    message: "DTDC rate/serviceability endpoint path needs confirmation from your DTDC API docs. Credentials detected — share the exact rate endpoint + request shape to wire it.",
    quotes: [],
  };
}

async function dtdcBook() {
  return { provider: "dtdc", status: "pending_docs", message: "DTDC booking endpoint needs confirmation from your DTDC API docs before enabling booking." };
}

async function dtdcTrack() {
  return { provider: "dtdc", status: "pending_docs", message: "DTDC tracking endpoint needs confirmation from your DTDC API docs." };
}

// ---------- Aggregators ----------
export async function compareQuotes(input) {
  const [shiprocket, bluedart, dtdc] = await Promise.allSettled([
    shiprocketQuote(input),
    blueDartQuote(input),
    dtdcQuote(input),
  ]);
  return {
    shiprocket: shiprocket.value,
    bluedart: bluedart.value,
    dtdc: dtdc.value,
  };
}

export async function bookShipment(input) {
  if (input.provider === "shiprocket") return shiprocketBook(input);
  if (input.provider === "bluedart") return blueDartBook(input);
  if (input.provider === "dtdc") return dtdcBook(input);
  throw new Error(`Unknown provider: ${input.provider}`);
}

export async function trackShipment(input) {
  if (input.provider === "shiprocket") return shiprocketTrack(input);
  if (input.provider === "bluedart") return blueDartTrack(input);
  if (input.provider === "dtdc") return dtdcTrack(input);
  throw new Error(`Unknown provider: ${input.provider}`);
}