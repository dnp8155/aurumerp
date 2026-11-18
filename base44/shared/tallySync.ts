// Shared Tally sync engine: eligibility rules, idempotency hashing, queue scanning.
// Imported by base44/functions/tallySync/entry.ts.

export interface EntityConfig {
  entityName: string;          // Base44 entity collection name
  numberField: string;         // field holding the human-readable number
  eligibleStatuses: string[];  // record.status values eligible for posting (empty = always eligible)
  tallyType: string;           // key passed to buildVoucher
  hasTallySyncedFlag: boolean; // entity carries a `tally_synced` boolean
}

export const ENTITY_CONFIG: Record<string, EntityConfig> = {
  customer: { entityName: 'Customer', numberField: 'name', eligibleStatuses: [], tallyType: 'customer', hasTallySyncedFlag: false },
  vendor: { entityName: 'Vendor', numberField: 'name', eligibleStatuses: [], tallyType: 'vendor', hasTallySyncedFlag: false },
  product: { entityName: 'Product', numberField: 'sku', eligibleStatuses: [], tallyType: 'product', hasTallySyncedFlag: false },
  inventory: { entityName: 'Inventory', numberField: 'sku', eligibleStatuses: [], tallyType: 'inventory', hasTallySyncedFlag: false },
  sale: { entityName: 'Sale', numberField: 'sale_number', eligibleStatuses: ['completed'], tallyType: 'sale', hasTallySyncedFlag: true },
  purchase: { entityName: 'PurchaseOrder', numberField: 'po_number', eligibleStatuses: ['approved', 'partially_received', 'received'], tallyType: 'purchase', hasTallySyncedFlag: true },
  goodsreceipt: { entityName: 'GoodsReceipt', numberField: 'receipt_number', eligibleStatuses: ['qc_completed'], tallyType: 'goodsreceipt', hasTallySyncedFlag: false },
  payment: { entityName: 'Expense', numberField: 'expense_number', eligibleStatuses: [], tallyType: 'payment', hasTallySyncedFlag: false },
  receipt: { entityName: 'Transaction', numberField: 'transaction_number', eligibleStatuses: ['success'], tallyType: 'receipt', hasTallySyncedFlag: false },
  return: { entityName: 'Return', numberField: 'return_number', eligibleStatuses: ['completed'], tallyType: 'sale', hasTallySyncedFlag: false },
  expense: { entityName: 'Expense', numberField: 'expense_number', eligibleStatuses: [], tallyType: 'expense', hasTallySyncedFlag: false },
  transaction: { entityName: 'Transaction', numberField: 'transaction_number', eligibleStatuses: ['success'], tallyType: 'transaction', hasTallySyncedFlag: false },
  allocation: { entityName: 'Allocation', numberField: 'allocation_number', eligibleStatuses: ['dispatched', 'received'], tallyType: 'allocation', hasTallySyncedFlag: false },
  rental: { entityName: 'Rental', numberField: 'rental_number', eligibleStatuses: ['active', 'returned'], tallyType: 'rental', hasTallySyncedFlag: true },
  repair: { entityName: 'Repair', numberField: 'repair_number', eligibleStatuses: ['ready_for_delivery', 'delivered'], tallyType: 'repair', hasTallySyncedFlag: true },
};

export const QUEUE_ENTITY_TYPES = Object.keys(ENTITY_CONFIG);

// Deterministic non-crypto hash (djb2) of the fields that matter for the Tally payload.
export function hashRecord(record: any): string {
  const key = JSON.stringify({
    n: record.sale_number || record.po_number || record.receipt_number || record.repair_number || record.rental_number || record.allocation_number || record.expense_number || record.transaction_number || record.name || record.sku || record.id,
    t: record.total_amount || record.total_charge || record.total_payable || record.total_with_gst || 0,
    s: record.status || '',
    u: record.updated_date || record.created_date || '',
  });
  return hashString(key);
}

// Deterministic non-crypto hash (djb2) of an arbitrary string.
export function hashString(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export function isEligible(entityType: string, record: any): boolean {
  const cfg = ENTITY_CONFIG[entityType];
  if (!cfg) return false;
  if (cfg.eligibleStatuses.length === 0) return true;
  return cfg.eligibleStatuses.includes(record.status);
}

// Returns the most recent TallySyncLog for a given entity, or null.
export async function getLastLog(base44: any, entityType: string, entityId: string): Promise<any> {
  const { items } = await base44.asServiceRole.entities.TallySyncLog.filter(
    { entity_type: entityType, entity_id: entityId },
    { sort: '-created_date', limit: 1 }
  );
  return items && items.length > 0 ? items[0] : null;
}

// A record needs sync if: no success log exists, OR the latest log is failed/retry, OR
// the record changed since the last success (hash mismatch). Blocked records are
// re-checked only when the record or the mapping configuration changed.
export function needsSync(record: any, lastLog: any, mappingHash = ''): boolean {
  if (!lastLog) return true;
  if (lastLog.sync_status === 'failed' || lastLog.sync_status === 'retry' || lastLog.sync_status === 'pending') return true;
  if (lastLog.sync_status === 'blocked') {
    return lastLog.source_hash !== hashRecord(record) || (lastLog.mapping_hash || '') !== mappingHash;
  }
  if (lastLog.sync_status === 'success') {
    return lastLog.source_hash !== hashRecord(record);
  }
  return false;
}

// Fetch a page of recently-updated records for an entity type that likely need sync.
export async function fetchQueuePage(base44: any, entityType: string, limit = 25): Promise<any[]> {
  const cfg = ENTITY_CONFIG[entityType];
  if (!cfg) return [];
  try {
    const { items } = await base44.asServiceRole.entities[cfg.entityName].filter(
      {},
      { sort: '-updated_date', limit }
    );
    return items || [];
  } catch {
    return [];
  }
}

// The Tally firm (company) vouchers are posted into: the company explicitly
// selected from the connected agent wins, falling back to the mapping name for
// setups configured before firm selection existed.
export function resolveCompany(mapping: any): string {
  return (mapping && (mapping.tally_company || mapping.name)) || '';
}

// Defaults used when a mapping record has to be created on the fly
// (e.g. the user picks a Tally firm before ever saving a mapping).
export const DEFAULT_MAPPING: Record<string, any> = {
  name: 'Default Tally Mapping',
  tally_company: '',
  default_party_ledger: 'Cash Customer',
  default_godown: 'Main Store',
  default_uom: 'Nos',
  cgst_ledger: 'CGST',
  sgst_ledger: 'SGST',
  igst_ledger: 'IGST',
  round_off_ledger: 'Round Off',
  default_expense_ledger: 'Indirect Expenses',
  default_payment_ledger: 'Cash',
  po_party_ledger: '',
  store_godown_map: '',
};

// Resolve TallyMapping ledger opts for the XML builders.
export function mappingToOpts(mapping: any): any {
  return {
    salesLedger: mapping?.default_party_ledger || 'Sales',
    purchaseLedger: mapping?.po_party_ledger || 'Purchase',
    cgstLedger: mapping?.cgst_ledger || 'CGST',
    sgstLedger: mapping?.sgst_ledger || 'SGST',
    igstLedger: mapping?.igst_ledger || 'IGST',
    roundOffLedger: mapping?.round_off_ledger || 'Round Off',
    defaultGodown: mapping?.default_godown || 'Main Store',
    defaultUom: mapping?.default_uom || 'Nos',
  };
}

// ---------------------------------------------------------------------------
// Multi-company routing, mapping readiness and pre-dispatch validation
// ---------------------------------------------------------------------------

// A job is delivered at most this many times before it is parked as failed.
export const MAX_ATTEMPTS = 3;
// Wait between attempts so a TallyPrime outage does not burn the attempts at once.
export const RETRY_BACKOFF_MS = 60000;

export const MAPPING_FIELD_LABELS: Record<string, string> = {
  tally_company: 'Tally company (firm)',
  default_party_ledger: 'Sales / party ledger',
  po_party_ledger: 'Purchase party ledger',
  cgst_ledger: 'CGST ledger',
  sgst_ledger: 'SGST ledger',
  igst_ledger: 'IGST ledger',
  round_off_ledger: 'Round off ledger',
  default_godown: 'Default godown',
  default_uom: 'Default unit of measure',
  default_expense_ledger: 'Expense ledger',
  default_payment_ledger: 'Payment ledger',
};

// Which mapping masters each supported record type needs before it can be posted.
export const MAPPING_REQUIREMENTS: Record<string, string[]> = {
  sale: ['default_party_ledger', 'cgst_ledger', 'sgst_ledger', 'igst_ledger', 'default_uom'],
  purchase: ['po_party_ledger', 'cgst_ledger', 'sgst_ledger', 'igst_ledger', 'default_godown', 'default_uom'],
  goodsreceipt: ['po_party_ledger', 'default_godown', 'default_uom'],
  payment: ['default_expense_ledger', 'default_payment_ledger'],
  expense: ['default_expense_ledger', 'default_payment_ledger'],
  receipt: ['default_payment_ledger'],
  transaction: ['default_payment_ledger'],
  allocation: ['default_godown', 'default_uom'],
  inventory: ['default_uom'],
  rental: ['default_party_ledger'],
  repair: ['default_party_ledger'],
  customer: [],
  vendor: [],
  product: [],
};

// Which record kind each type posts as — shown in the coverage dashboard.
export const MASTER_TYPES = ['customer', 'vendor', 'product', 'inventory'];

// Mapping readiness for one record type: ready, or the human-readable labels missing.
export function isMappingReady(entityType: string, mapping: any): { ready: boolean; missing: string[]; missing_keys: string[] } {
  const required = MAPPING_REQUIREMENTS[entityType] || [];
  const missing_keys = required.filter((k) => !String(mapping?.[k] ?? '').trim());
  if (!resolveCompany(mapping)) missing_keys.unshift('tally_company');
  return {
    ready: missing_keys.length === 0,
    missing: missing_keys.map((k) => MAPPING_FIELD_LABELS[k] || k),
    missing_keys,
  };
}

// Fingerprint of the mapping + firm a job was queued against, so a configuration
// change re-validates records that were previously blocked.
export function mappingFingerprint(mapping: any, company: string): string {
  const parts = [
    company || '',
    ...Object.keys(MAPPING_FIELD_LABELS).map((k) => String(mapping?.[k] ?? '')),
    String(mapping?.store_godown_map || ''),
    String(mapping?.default_uom || ''),
  ];
  return hashString(parts.join('|'));
}

function has(v: any): boolean {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function num(v: any): number {
  return Number(v) || 0;
}

// Problems with the ERP record itself (independent of the mapping).
function recordProblems(entityType: string, record: any): string[] {
  const problems: string[] = [];
  const items = Array.isArray(record?.items) ? record.items : [];
  switch (entityType) {
    case 'sale':
      if (items.length === 0) problems.push('Record: sale has no line items.');
      if (num(record.total_amount) <= 0) problems.push('Record: sale total is zero.');
      break;
    case 'purchase':
      if (items.length === 0) problems.push('Record: purchase order has no line items.');
      if (num(record.total_amount) <= 0 && num(record.total_with_gst) <= 0) problems.push('Record: purchase total is zero.');
      if (!has(record.vendor_name)) problems.push('Record: vendor name is missing.');
      break;
    case 'goodsreceipt':
      if (items.length === 0) problems.push('Record: goods receipt has no line items.');
      break;
    case 'payment':
    case 'expense':
      if (num(record.total_amount) <= 0 && num(record.amount) <= 0) problems.push('Record: payment amount is zero.');
      break;
    case 'receipt':
    case 'transaction':
      if (num(record.amount) <= 0) problems.push('Record: receipt amount is zero.');
      break;
    case 'customer':
    case 'vendor':
      if (!has(record.name)) problems.push(`Record: ${entityType} name is missing.`);
      break;
    case 'product':
    case 'inventory':
      if (!has(record.sku) && !has(record.name) && !has(record.product_name)) problems.push('Record: item name / SKU is missing.');
      break;
    case 'allocation':
      if (items.length === 0) problems.push('Record: stock transfer has no line items.');
      break;
    case 'rental':
      if (!has(record.customer_name)) problems.push('Record: customer name is missing.');
      if (num(record.total_rental_charge) <= 0 && num(record.total_payable) <= 0) problems.push('Record: rental charge is zero.');
      break;
    case 'repair':
      if (!has(record.customer_name)) problems.push('Record: customer name is missing.');
      if (num(record.total_charge) <= 0) problems.push('Record: repair charge is zero.');
      break;
  }
  return problems;
}

// Validation that runs BEFORE a job is dispatched to the agent. Unsupported record
// types, incomplete mappings and incomplete records are reported (never dropped).
export function validateForSync(entityType: string, record: any, mapping: any): { ok: boolean; errors: string[] } {
  const cfg = ENTITY_CONFIG[entityType];
  if (!cfg) return { ok: false, errors: [`Unsupported record type: ${entityType}`] };
  const errors: string[] = [];
  if (!mapping) {
    errors.push('Mapping: no Tally company mapping is configured.');
  } else {
    if (!resolveCompany(mapping)) errors.push('Mapping: Tally company (firm) is not selected.');
    const { missing_keys } = isMappingReady(entityType, mapping);
    for (const key of missing_keys) {
      if (key === 'tally_company') continue; // already reported above
      errors.push(`Mapping: ${MAPPING_FIELD_LABELS[key] || key} is not set.`);
    }
  }
  if (!has(record?.[cfg.numberField])) errors.push(`Record: ${cfg.numberField} is missing.`);
  errors.push(...recordProblems(entityType, record));
  return { ok: errors.length === 0, errors };
}