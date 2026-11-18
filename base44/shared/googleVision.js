// Google Vision Product Search API helpers — shared by visualProductIdentification & googleVisionSync.
// Uses Web Crypto API (Deno) for RS256 JWT signing to mint OAuth2 access tokens from a service account.

/**
 * Mint an OAuth2 access token from a Google service account JSON.
 */
export async function getAccessToken(credentials, scope = "https://www.googleapis.com/auth/cloud-vision") {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: credentials.private_key_id };
  const payload = {
    iss: credentials.client_email,
    scope,
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${b64url(header)}.${b64url(payload)}`;

  // Import the PKCS#8 private key
  const pem = (credentials.private_key || "")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsigned}.${sigB64}`;

  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google auth failed (${res.status}): ${errText}`);
  }
  const token = await res.json();
  return token.access_token;
}

export function parseCredentials(raw) {
  try {
    const creds = JSON.parse(raw);
    if (!creds.client_email || !creds.private_key) {
      throw new Error("Missing client_email or private_key");
    }
    return creds;
  } catch (e) {
    throw new Error("GOOGLE_VISION_CREDENTIALS is not valid service account JSON: " + e.message);
  }
}

const BASE = "https://vision.googleapis.com/v1";

export async function visionRequest(path, method, token, body) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Google Vision API error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export function productPath(projectId, location, productId) {
  return `projects/${projectId}/locations/${location}/products/${productId}`;
}

export function productSetPath(projectId, location, productSetId) {
  return `projects/${projectId}/locations/${location}/productSets/${productSetId}`;
}

/**
 * Create a product set if it doesn't already exist.
 */
export async function ensureProductSet(token, projectId, location, productSetId, displayName) {
  try {
    const existing = await visionRequest(
      `/projects/${projectId}/locations/${location}/productSets/${productSetId}`,
      "GET",
      token
    );
    return { created: false, productSet: existing };
  } catch (e) {
    // not found — create it
  }
  const created = await visionRequest(
    `/projects/${projectId}/locations/${location}/productSets?productSetId=${productSetId}`,
    "POST",
    token,
    { displayName: displayName || productSetId }
  );
  return { created: true, productSet: created };
}

/**
 * Create a product if it doesn't exist and add it to the product set (idempotent).
 */
export async function ensureProduct(token, projectId, location, productSetId, productId, displayName, description, productCategory) {
  const category = productCategory || "general-v1";
  let product;
  try {
    product = await visionRequest(
      `/projects/${projectId}/locations/${location}/products/${productId}`,
      "GET",
      token
    );
  } catch (e) {
    product = await visionRequest(
      `/projects/${projectId}/locations/${location}/products?productId=${productId}`,
      "POST",
      token,
      {
        displayName: displayName || productId,
        description: description || "",
        productCategory: category,
      }
    );
  }
  // Add to product set (idempotent)
  try {
    await visionRequest(
      `/projects/${projectId}/locations/${location}/productSets/${productSetId}:addProduct`,
      "POST",
      token,
      { product: productPath(projectId, location, productId) }
    );
  } catch (e) {
    // already in set — ignore
  }
  return product;
}

/**
 * Add a reference image to a product.
 */
export async function addReferenceImage(token, projectId, location, productId, imageId, imageUrl) {
  return visionRequest(
    `/projects/${projectId}/locations/${location}/products/${productId}/referenceImages?referenceImageId=${imageId}`,
    "POST",
    token,
    { uri: imageUrl }
  );
}

/**
 * Remove a reference image.
 */
export async function deleteReferenceImage(token, projectId, location, productId, imageId) {
  return visionRequest(
    `/projects/${projectId}/locations/${location}/products/${productId}/referenceImages/${imageId}`,
    "DELETE",
    token
  );
}

/**
 * Search an image against the product set.
 */
export async function searchProducts(token, projectId, location, productSetId, imageUrl, maxResults = 10, productCategory = "general-v1") {
  const body = {
    requests: [
      {
        image: { source: { imageUri: imageUrl } },
        features: [{ type: "PRODUCT_SEARCH", maxResults }],
        imageContext: {
          productSearchParams: {
            productSet: productSetPath(projectId, location, productSetId),
            productCategories: [productCategory],
          },
        },
      },
    ],
  };
  return visionRequest(`/images:annotate`, "POST", token, body);
}