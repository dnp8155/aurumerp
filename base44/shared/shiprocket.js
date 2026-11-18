import { secrets } from "base44:runtime";

const BASE_URL = "https://apiv2.shiprocket.in";

export async function getToken() {
  const email = secrets.get("SHIPROCKET_EMAIL");
  const password = secrets.get("SHIPROCKET_PASSWORD");
  if (!email || !password) {
    throw new Error("Shiprocket credentials not configured. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in dashboard → Secrets.");
  }
  const res = await fetch(`${BASE_URL}/v1/external/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket login failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error("Shiprocket login: no token in response");
  return data.token;
}

export async function getRates(token, params) {
  const body = {
    pickup_postcode: String(params.pickup_postcode),
    delivery_postcode: String(params.delivery_postcode),
    weight: Number(params.weight) || 0.5,
    cod: params.cod ? 1 : 0,
    declared_value: Number(params.declared_value) || 500,
    length: Number(params.length) || 10,
    breadth: Number(params.breadth) || 10,
    height: Number(params.height) || 10,
  };
  const res = await fetch(`${BASE_URL}/v1/external/courier/serviceability/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket rates failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data;
}

export async function createOrder(token, orderData) {
  const res = await fetch(`${BASE_URL}/v1/external/orders/create_adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(orderData),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket create order failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data;
}

export async function trackByAwb(token, awb) {
  const res = await fetch(`${BASE_URL}/v1/external/courier/track/awb/${awb}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket track failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data;
}