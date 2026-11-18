import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'generate') {
      return await handleGenerate(base44, body, user);
    } else if (action === 'validate') {
      return await handleValidate(base44, body);
    } else if (action === 'scan') {
      return await handleScan(base44, body);
    } else {
      return Response.json({ message: 'Invalid action. Use: generate, validate, scan' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ message: error.message }, { status: 500 });
  }
}

async function handleGenerate(base44, body, user) {
  const { product_code, price, collection_code, store_code, calculation_rule_id, persist, purchase_date, source_transaction, quantity, vendor_code, vendor_name } = body;

  if (!product_code || price === undefined || !collection_code) {
  return Response.json({ message: 'product_code, price, and collection_code are required' }, { status: 400 });
  }

  const qty = Math.max(1, Math.floor(quantity) || 1);

  const products = await base44.entities.BarcodeProductMaster.filter({ product_code, status: 'active' });
  if (!products || products.length === 0) {
  return Response.json({ message: `Product not found for code: ${product_code}` }, { status: 400 });
  }
  const product = products[0];

  const parties = await base44.entities.BarcodePartyMaster.filter({ collection_code, status: 'active' });
  if (!parties || parties.length === 0) {
  return Response.json({ message: `Party/Collection not found for code: ${collection_code}` }, { status: 400 });
  }
  const party = parties[0];

  let store = null;
  if (store_code) {
    const stores = await base44.entities.BarcodeStoreMaster.filter({ store_code, status: 'active' });
    if (stores && stores.length > 0) store = stores[0];
  }

  let rule = null;
  if (calculation_rule_id) {
    try { rule = await base44.entities.CalculationRule.get(calculation_rule_id); } catch (e) { rule = null; }
  }
  if (!rule) {
    const rules = await base44.entities.CalculationRule.filter({ is_active: true });
    if (rules && rules.length > 0) {
      rule = rules[0];
    }
  }
  if (!rule) {
    rule = { id: 'legacy', multiplier: 6, divisor: 3, rounding_method: 'roundup', stock_group_format: 'name_partno', name_code: '$', default_unit: 'Pcs', rule_name: 'Legacy Default' };
  }

  const calculated = calculateBarcode({ price, product, party, rule });

  // Generate `qty` barcodes — use timestamp-based unique suffix to avoid duplicate checks
  const baseBarcode = calculated.barcode;
  const batchId = Date.now().toString().slice(-6);

  const records = [];
  for (let i = 0; i < qty; i++) {
    // First barcode uses base, rest get unique batch suffix
    const uniqueBarcode = i === 0 ? `${baseBarcode}-${batchId}` : `${baseBarcode}-${batchId}-${i + 1}`;

    records.push({
      barcode: uniqueBarcode,
      sku: calculated.desPartNo,
      product_code: product.product_code,
      product_name: product.product_name,
      short_code: product.short_code,
      price: price,
      value: calculated.value,
      p_value: calculated.pValue,
      part_no: calculated.partNo,
      collection_code: party.collection_code,
      des_part_no: calculated.desPartNo,
      party_name: party.party_name,
      vendor_code: vendor_code || '',
      vendor_name: vendor_name || '',
      store_code: store ? store.store_code : '',
      store_name: store ? store.store_name : '',
      stock_item_name: calculated.stockItemName,
      alias: calculated.alias,
      stock_group: calculated.stockGroup,
      description: calculated.description,
      c1_code: party.c1_code,
      c2_code: party.c2_code,
      name_code: rule.name_code || '$',
      unit: rule.default_unit || 'Pcs',
      calculation_rule_id: rule.id,
      calculation_rule_name: rule.rule_name,
      purchase_date: purchase_date || null,
      source_transaction: source_transaction || '',
      legacy_barcode: uniqueBarcode,
      label_quantity: 1,
      status: 'active'
    });
  }

  if (persist) {
    const created = await base44.entities.BarcodeRecord.bulkCreate(records);
    return Response.json({ success: true, records: created, count: created.length, calculated });
  }

  return Response.json({ success: true, calculated, records });
}

function calculateBarcode({ price, product, party, rule }) {
  const multiplier = rule.multiplier || 6;
  const divisor = rule.divisor || 3;

  const value = price * multiplier;
  const pValue = Math.round((value / divisor) * 100) / 100;

  let partNo;
  if (rule.rounding_method === 'round') {
    partNo = Math.round(price);
  } else if (rule.rounding_method === 'floor') {
    partNo = Math.floor(price);
  } else {
    partNo = Math.ceil(price);
  }

  const collectionShort = party.collection_code;
  const shortCode = product.short_code;
  const productName = product.product_name;
  const c1 = party.c1_code;
  const c2 = party.c2_code;
  const nameCode = rule.name_code || '$';

  const desPartNo = `${collectionShort}${shortCode}${partNo}`;
  const stockItemName = `${productName}${shortCode}${partNo}`;
  const pValueStr = Number.isInteger(pValue) ? String(pValue) : String(pValue);
  const alias = `${collectionShort}${pValueStr}${nameCode}${shortCode}`;

  let stockGroup;
  if (rule.stock_group_format === 'name_hyphen_code') {
    stockGroup = `${productName}-${product.product_code}`;
  } else if (rule.stock_group_format === 'name_shortcode_code') {
    stockGroup = `${productName}${shortCode}${product.product_code}`;
  } else {
    stockGroup = `${productName}${partNo}`;
  }

  const description = `${c1}${partNo}${c2}`;
  const barcode = description;

  return { value, pValue, partNo, desPartNo, stockItemName, alias, stockGroup, description, barcode, collectionShort, shortCode, productName, c1, c2, nameCode };
}

async function handleValidate(base44, body) {
  const { product_code, price, collection_code, store_code, calculation_rule_id } = body;
  const errors = [];

  if (!product_code) errors.push('Product code is required');
  if (price === undefined || price === null) errors.push('Price is required');
  if (!collection_code) errors.push('Collection code is required');

  if (product_code) {
    const products = await base44.entities.BarcodeProductMaster.filter({ product_code, status: 'active' });
    if (!products || products.length === 0) errors.push(`Product not found: ${product_code}`);
  }

  if (collection_code) {
    const parties = await base44.entities.BarcodePartyMaster.filter({ collection_code, status: 'active' });
    if (!parties || parties.length === 0) errors.push(`Collection/Party not found: ${collection_code}`);
  }

  if (store_code) {
    const stores = await base44.entities.BarcodeStoreMaster.filter({ store_code, status: 'active' });
    if (!stores || stores.length === 0) errors.push(`Store not found: ${store_code}`);
  }

  let rule = null;
  if (calculation_rule_id) {
    try {
      rule = await base44.entities.CalculationRule.get(calculation_rule_id);
    } catch (e) {
      errors.push('Calculation rule not found');
    }
  }
  if (!rule) {
    const rules = await base44.entities.CalculationRule.filter({ is_active: true });
    if (!rules || rules.length === 0) errors.push('No active calculation rule found');
  }

  return Response.json({ valid: errors.length === 0, errors });
}

async function handleScan(base44, body) {
  const { barcode } = body;
  if (!barcode) return Response.json({ message: 'Barcode is required' }, { status: 400 });

  const records = await base44.entities.BarcodeRecord.filter({ barcode });
  if (!records || records.length === 0) {
    return Response.json({ message: 'Barcode not found', barcode }, { status: 404 });
  }

  return Response.json({ record: records[0] });
}