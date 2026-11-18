// In-app barcode engine — replicates the barcodeEngine backend function logic
// entirely client-side using the Base44 SDK. No external/backend dependency.
import { base44 } from "@/api/base44Client";

function calculateBarcode({ price, product, party, rule }) {
  const multiplier = rule.multiplier || 6;
  const divisor = rule.divisor || 3;

  const value = price * multiplier;
  const pValue = Math.round((value / divisor) * 100) / 100;

  let partNo;
  if (rule.rounding_method === "round") {
    partNo = Math.round(price);
  } else if (rule.rounding_method === "floor") {
    partNo = Math.floor(price);
  } else {
    partNo = Math.ceil(price);
  }

  const collectionShort = party.collection_code;
  const shortCode = product.short_code;
  const productName = product.product_name;
  const c1 = party.c1_code;
  const c2 = party.c2_code;
  const nameCode = rule.name_code || "$";

  const desPartNo = `${collectionShort}${shortCode}${partNo}`;
  const stockItemName = `${productName}${shortCode}${partNo}`;
  const pValueStr = String(pValue);
  const alias = `${collectionShort}${pValueStr}${nameCode}${shortCode}`;

  let stockGroup;
  if (rule.stock_group_format === "name_hyphen_code") {
    stockGroup = `${productName}-${product.product_code}`;
  } else if (rule.stock_group_format === "name_shortcode_code") {
    stockGroup = `${productName}${shortCode}${product.product_code}`;
  } else {
    stockGroup = `${productName}${partNo}`;
  }

  const description = `${c1}${partNo}${c2}`;
  const barcode = description;

  return {
    value, pValue, partNo, desPartNo, stockItemName, alias,
    stockGroup, description, barcode,
    collectionShort, shortCode, productName, c1, c2, nameCode,
  };
}

async function resolveRule(calculation_rule_id) {
  let rule = null;
  if (calculation_rule_id) {
    try { rule = await base44.entities.CalculationRule.get(calculation_rule_id); } catch { rule = null; }
  }
  if (!rule) {
    const rules = await base44.entities.CalculationRule.filter({ is_active: true });
    if (rules && rules.length > 0) rule = rules[0];
  }
  if (!rule) {
    rule = {
      id: "legacy", multiplier: 6, divisor: 3, rounding_method: "roundup",
      stock_group_format: "name_partno", name_code: "$", default_unit: "Pcs",
      rule_name: "Legacy Default",
    };
  }
  return rule;
}

// Derive a short code from a product name (first letters of up to 2 words, uppercased)
function deriveShortCode(name) {
  if (!name) return "XX";
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "XX";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Auto-provision a BarcodeProductMaster from the Product entity (or from the code itself)
async function ensureProductMaster(product_code) {
  let products = await base44.entities.BarcodeProductMaster.filter({ product_code, status: "active" });
  if (products && products.length > 0) return products[0];
  // Try to derive from the Product entity
  try {
    const productRecords = await base44.entities.Product.filter({ sku: product_code });
    const p = productRecords && productRecords[0];
    const name = p?.name || product_code;
    const shortCode = p?.short_code || deriveShortCode(name);
    return await base44.entities.BarcodeProductMaster.create({
      product_code, product_name: name, short_code: shortCode, status: "active",
    });
  } catch {
    // Last resort: provision from the code itself
    return await base44.entities.BarcodeProductMaster.create({
      product_code, product_name: product_code, short_code: deriveShortCode(product_code), status: "active",
    });
  }
}

// Auto-provision a BarcodePartyMaster from the vendor / collection code
async function ensurePartyMaster(collection_code, vendor_code, vendor_name) {
  const code = collection_code || vendor_code || "GEN";
  const parties = await base44.entities.BarcodePartyMaster.filter({ collection_code: code, status: "active" });
  if (parties && parties.length > 0) return parties[0];
  const c1 = (code[0] || "G").toUpperCase();
  const c2 = (code[1] || "0").toUpperCase();
  return await base44.entities.BarcodePartyMaster.create({
    collection_code: code, party_name: vendor_name || code, c1_code: c1, c2_code: c2, status: "active",
  });
}

// Generate barcode(s). Returns { success, calculated, records } (and count when persisted).
// Throws Error with a readable message on validation failure.
export async function generateBarcode(params) {
  const {
    product_code, price, collection_code, store_code, calculation_rule_id,
    persist, purchase_date, source_transaction, quantity, vendor_code, vendor_name,
  } = params;

  if (!product_code || price === undefined || price === null) {
    throw new Error("Product code and price are required for barcode generation");
  }

  const qty = Math.max(1, Math.floor(quantity) || 1);

  const product = await ensureProductMaster(product_code);
  const party = await ensurePartyMaster(collection_code, vendor_code, vendor_name);

  let store = null;
  if (store_code) {
    const stores = await base44.entities.BarcodeStoreMaster.filter({ store_code, status: "active" });
    if (stores && stores.length > 0) store = stores[0];
  }

  const rule = await resolveRule(calculation_rule_id);
  const calculated = calculateBarcode({ price, product, party, rule });

  // Barcode format: selling price + purchase date (YYYYMMDD) + vendor code
  const dateStr = purchase_date ? String(purchase_date).replace(/-/g, "").slice(0, 8) : "";
  const baseBarcode = `${price}${dateStr}${vendor_code || ""}`;
  const batchId = Date.now().toString().slice(-6);

  const records = [];
  for (let i = 0; i < qty; i++) {
    const uniqueBarcode = i === 0 ? `${baseBarcode}-${batchId}` : `${baseBarcode}-${batchId}-${i + 1}`;
    records.push({
      barcode: uniqueBarcode,
      sku: calculated.desPartNo,
      product_code: product.product_code,
      product_name: product.product_name,
      short_code: product.short_code,
      price,
      value: calculated.value,
      p_value: calculated.pValue,
      part_no: calculated.partNo,
      collection_code: party.collection_code,
      des_part_no: calculated.desPartNo,
      party_name: party.party_name,
      vendor_code: vendor_code || "",
      vendor_name: vendor_name || "",
      store_code: store ? store.store_code : "",
      store_name: store ? store.store_name : "",
      stock_item_name: calculated.stockItemName,
      alias: calculated.alias,
      stock_group: calculated.stockGroup,
      description: calculated.description,
      c1_code: party.c1_code,
      c2_code: party.c2_code,
      name_code: rule.name_code || "$",
      unit: rule.default_unit || "Pcs",
      calculation_rule_id: rule.id,
      calculation_rule_name: rule.rule_name,
      purchase_date: purchase_date || null,
      source_transaction: source_transaction || "",
      legacy_barcode: uniqueBarcode,
      label_quantity: 1,
      status: "active",
    });
  }

  if (persist) {
    const created = await base44.entities.BarcodeRecord.bulkCreate(records);
    return { success: true, records: created, count: created.length, calculated };
  }

  return { success: true, calculated, records };
}

// Validate inputs without generating. Returns { valid, errors }.
export async function validateBarcode(params) {
  const { product_code, price, collection_code, store_code, calculation_rule_id } = params;
  const errors = [];

  if (!product_code) errors.push("Product code is required");
  if (price === undefined || price === null) errors.push("Price is required");
  if (!collection_code) errors.push("Collection code is required");

  if (product_code) {
    const products = await base44.entities.BarcodeProductMaster.filter({ product_code, status: "active" });
    if (!products || products.length === 0) errors.push(`Product not found: ${product_code}`);
  }
  if (collection_code) {
    const parties = await base44.entities.BarcodePartyMaster.filter({ collection_code, status: "active" });
    if (!parties || parties.length === 0) errors.push(`Collection/Party not found: ${collection_code}`);
  }
  if (store_code) {
    const stores = await base44.entities.BarcodeStoreMaster.filter({ store_code, status: "active" });
    if (!stores || stores.length === 0) errors.push(`Store not found: ${store_code}`);
  }

  let rule = null;
  if (calculation_rule_id) {
    try { rule = await base44.entities.CalculationRule.get(calculation_rule_id); } catch { errors.push("Calculation rule not found"); }
  }
  if (!rule) {
    const rules = await base44.entities.CalculationRule.filter({ is_active: true });
    if (!rules || rules.length === 0) errors.push("No active calculation rule found");
  }

  return { valid: errors.length === 0, errors };
}

// Scan a barcode. Returns { record } or throws if not found.
export async function scanBarcode(barcode) {
  if (!barcode) throw new Error("Barcode is required");
  const records = await base44.entities.BarcodeRecord.filter({ barcode });
  if (!records || records.length === 0) {
    throw new Error("Barcode not found");
  }
  return { record: records[0] };
}