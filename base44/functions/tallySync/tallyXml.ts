// Tally Prime 9 XML voucher builders for HTTP import (port 9000).
// Tally's native HTTP interface accepts XML envelopes, not JSON.

export interface TallyLedgerOpts {
  salesLedger?: string;
  purchaseLedger?: string;
  cgstLedger?: string;
  sgstLedger?: string;
  igstLedger?: string;
  roundOffLedger?: string;
  defaultGodown?: string;
  defaultUom?: string;
}

const DEFAULTS: Required<TallyLedgerOpts> = {
  salesLedger: 'Sales',
  purchaseLedger: 'Purchase',
  cgstLedger: 'CGST',
  sgstLedger: 'SGST',
  igstLedger: 'IGST',
  roundOffLedger: 'Round Off',
  defaultGodown: 'Main Store',
  defaultUom: 'Nos',
};

function esc(s: any): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d: string | Date | undefined): string {
  const date = d ? (d instanceof Date ? d : new Date(d)) : new Date();
  if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function amt(n: number, negate = false): string {
  const v = Number(n) || 0;
  return (negate ? -v : v).toFixed(2);
}

function inventoryEntry(item: any): string {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.unit_price) || 0;
  const total = Number(item.total_price) || (qty * rate);
  const stockName = item.sku || item.product_name || 'Item';
  return `      <INVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${esc(stockName)}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <RATE>${amt(rate)}/Nos</RATE>
        <AMOUNT>${amt(total)}</AMOUNT>
        <ACTUALQTY>${qty} Nos</ACTUALQTY>
        <BILLEDQTY>${qty} Nos</BILLEDQTY>
      </INVENTORYENTRIES.LIST>`;
}

function gstLedgerEntries(payload: any, opts: Required<TallyLedgerOpts>, isPurchase = false): string {
  const gstType = payload.gst_type || 'intra';
  const sign = isPurchase ? '' : '-';
  let xml = '';
  if (gstType === 'inter') {
    const igst = Number(payload.igst_amount) || 0;
    if (igst > 0) {
      xml += `      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(opts.igstLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isPurchase ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
        <AMOUNT>${sign}${amt(igst)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
    }
  } else {
    const cgst = Number(payload.cgst_amount) || 0;
    const sgst = Number(payload.sgst_amount) || 0;
    if (cgst > 0) {
      xml += `      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(opts.cgstLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isPurchase ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
        <AMOUNT>${sign}${amt(cgst)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
    }
    if (sgst > 0) {
      xml += `      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(opts.sgstLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${isPurchase ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
        <AMOUNT>${sign}${amt(sgst)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
    }
  }
  return xml;
}

export function buildSalesVoucher(payload: any, opts: TallyLedgerOpts = {}): string {
  const o = { ...DEFAULTS, ...opts };
  const party = payload.customer_name || 'Walk-in Customer';
  const total = Number(payload.total_amount) || 0;
  const date = fmtDate(payload.sale_date);
  const items = Array.isArray(payload.items) ? payload.items : [];

  let xml = `  <TALLYMESSAGE>
    <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERNUMBER>${esc(payload.sale_number || '')}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${esc(party)}</PARTYLEDGERNAME>
      <NARRATION>${esc(`Sale invoice ${payload.sale_number || ''} - ${payload.customer_phone || ''}`)}</NARRATION>`;

  for (const it of items) xml += '\n' + inventoryEntry(it);

  xml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(party)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${amt(total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;

  const taxable = Number(payload.subtotal_before_gst) || (total - (Number(payload.total_gst_amount) || Number(payload.tax_amount) || 0));
  xml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(o.salesLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amt(taxable)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;

  xml += '\n' + gstLedgerEntries(payload, o, false);

  xml += `
    </VOUCHER>
  </TALLYMESSAGE>`;
  return xml;
}

export function buildPurchaseVoucher(payload: any, opts: TallyLedgerOpts = {}): string {
  const o = { ...DEFAULTS, ...opts };
  const party = payload.vendor_name || 'Vendor';
  const total = Number(payload.total_amount) || Number(payload.total_with_gst) || 0;
  const date = fmtDate(payload.approved_date || payload.created_date);
  const items = Array.isArray(payload.items) ? payload.items : [];

  let xml = `  <TALLYMESSAGE>
    <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERNUMBER>${esc(payload.po_number || '')}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${esc(party)}</PARTYLEDGERNAME>
      <NARRATION>${esc(`Purchase order ${payload.po_number || ''} - ${payload.vendor_gst_number || ''}`)}</NARRATION>`;

  for (const it of items) xml += '\n' + inventoryEntry(it);

  xml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(party)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amt(total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;

  const taxable = Number(payload.subtotal_before_gst) || (total - (Number(payload.total_gst_amount) || Number(payload.tax_amount) || 0));
  xml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(o.purchaseLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${amt(taxable)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;

  xml += '\n' + gstLedgerEntries(payload, o, true);

  xml += `
    </VOUCHER>
  </TALLYMESSAGE>`;
  return xml;
}

export function buildPaymentVoucher(payload: any): string {
  const party = payload.vendor_name || 'Miscellaneous';
  const total = Number(payload.total_amount) || Number(payload.amount) || 0;
  const date = fmtDate(payload.expense_date);
  const bankLedger = payload.payment_mode === 'cash' ? 'Cash' : 'Bank';

  return `  <TALLYMESSAGE>
    <VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERNUMBER>${esc(payload.expense_number || '')}</VOUCHERNUMBER>
      <NARRATION>${esc(payload.description || payload.category || 'Expense')}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(party)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amt(total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(bankLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${amt(total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
  </TALLYMESSAGE>`;
}

export function buildReceiptVoucher(payload: any): string {
  const party = payload.customer_name || payload.store_name || 'Cash';
  const total = Number(payload.amount) || 0;
  const date = fmtDate(payload.transaction_date);
  const bankLedger = payload.payment_method === 'cash' ? 'Cash' : 'Bank';

  return `  <TALLYMESSAGE>
    <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERNUMBER>${esc(payload.transaction_number || '')}</VOUCHERNUMBER>
      <NARRATION>${esc(`Receipt ${payload.transaction_number || ''} via ${payload.payment_method || ''}`)}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(bankLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${amt(total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(party)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amt(total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
  </TALLYMESSAGE>`;
}

export function wrapEnvelope(tallyMessage: string, company: string): string {
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
    <VERSION>1</VERSION>
    <TALLYVERSION>9</TALLYVERSION>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${esc(company || '')}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
${tallyMessage}
    </DATA>
  </BODY>
</ENVELOPE>`;
}

export function buildCustomerMaster(payload: any): string {
  const name = payload.name || payload.customer_name || 'Customer';
  const gst = payload.gst_number || payload.gstin || '';
  const phone = payload.phone || payload.customer_phone || '';
  const addr = [payload.address, payload.city, payload.state, payload.pincode].filter(Boolean).join(' ');
  return `  <TALLYMESSAGE>
    <LEDGER NAME="${esc(name)}" RESERVEDNAME="">
      <PARENT>Sundry Debtors</PARENT>
      <ISGROUP>No</ISGROUP>
      <OPENINGBALANCE>0</OPENINGBALANCE>
      ${gst ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${esc(gst)}</PARTYGSTIN>` : ''}
      <LEDGERPHONE>${esc(phone)}</LEDGERPHONE>
      <LEDGERADDRESS>${esc(addr)}</LEDGERADDRESS>
    </LEDGER>
  </TALLYMESSAGE>`;
}

export function buildVendorMaster(payload: any): string {
  const name = payload.name || 'Vendor';
  const gst = payload.gst_number || '';
  const phone = payload.phone || '';
  const addr = [payload.billing_address_line1, payload.billing_address_city, payload.billing_address_state, payload.billing_address_pincode].filter(Boolean).join(' ');
  return `  <TALLYMESSAGE>
    <LEDGER NAME="${esc(name)}" RESERVEDNAME="">
      <PARENT>Sundry Creditors</PARENT>
      <ISGROUP>No</ISGROUP>
      <OPENINGBALANCE>0</OPENINGBALANCE>
      ${gst ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>${esc(gst)}</PARTYGSTIN>` : ''}
      <LEDGERPHONE>${esc(phone)}</LEDGERPHONE>
      <LEDGERADDRESS>${esc(addr)}</LEDGERADDRESS>
    </LEDGER>
  </TALLYMESSAGE>`;
}

export function buildStockItemMaster(payload: any, opts: TallyLedgerOpts = {}): string {
  const name = payload.sku || payload.product_name || payload.name || 'Item';
  const unit = payload.unit || 'Nos';
  const group = payload.stock_group || 'Goods';
  const opening = Number(payload.opening_stock) || 0;
  const rate = Number(payload.unit_price) || Number(payload.selling_price) || 0;
  return `  <TALLYMESSAGE>
    <STOCKITEM NAME="${esc(name)}">
      <PARENT>${esc(group)}</PARENT>
      <BASEUNITS>${esc(unit)}</BASEUNITS>
      ${opening ? `<OPENINGBALANCE>${opening} ${esc(unit)}</OPENINGBALANCE>` : ''}
      ${rate ? `<STANDARDPRICELIST><BASICRATE>${amt(rate)}</BASICRATE></STANDARDPRICELIST>` : ''}
    </STOCKITEM>
  </TALLYMESSAGE>`;
}

export function buildStockJournal(payload: any, opts: TallyLedgerOpts = {}): string {
  const o = { ...DEFAULTS, ...opts };
  const date = fmtDate(payload.transfer_date || payload.created_date);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const fromGodown = payload.from_store_name || o.defaultGodown || 'Main Store';
  const toGodown = payload.to_store_name || o.defaultGodown || 'Main Store';
  let entries = '';
  for (const it of items) {
    const name = it.sku || it.product_name || 'Item';
    const qty = Number(it.quantity) || 0;
    entries += `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${esc(name)}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <ACTUALQTY>${qty} ${esc(it.unit || o.defaultUom || 'Nos')}</ACTUALQTY>
        <BILLEDQTY>${qty} ${esc(it.unit || o.defaultUom || 'Nos')}</BILLEDQTY>
        <DESTINATIONGODOWN>${esc(toGodown)}</DESTINATIONGODOWN>
      </ALLINVENTORYENTRIES.LIST>
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${esc(name)}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <ACTUALQTY>${qty} ${esc(it.unit || o.defaultUom || 'Nos')}</ACTUALQTY>
        <BILLEDQTY>${qty} ${esc(it.unit || o.defaultUom || 'Nos')}</BILLEDQTY>
        <SOURCEGODOWN>${esc(fromGodown)}</SOURCEGODOWN>
      </ALLINVENTORYENTRIES.LIST>`;
  }
  return `  <TALLYMESSAGE>
    <VOUCHER VCHTYPE="Stock Journal" ACTION="Create" OBJVIEW="Inventory Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERNUMBER>${esc(payload.allocation_number || payload.transfer_number || '')}</VOUCHERNUMBER>
      <NARRATION>${esc(`Stock transfer ${payload.allocation_number || ''}`)}</NARRATION>
      ${entries}
    </VOUCHER>
  </TALLYMESSAGE>`;
}

export function buildServiceVoucher(payload: any, opts: TallyLedgerOpts = {}): string {
  const o = { ...DEFAULTS, ...opts };
  const party = payload.customer_name || 'Walk-in Customer';
  const total = Number(payload.total_charge) || Number(payload.total_payable) || Number(payload.total_amount) || 0;
  const date = fmtDate(payload.received_date || payload.rental_start_date || payload.created_date);
  const vchType = payload.entity_type === 'rental' ? 'Sales' : 'Sales';
  const num = payload.repair_number || payload.rental_number || '';
  const taxable = Number(payload.subtotal_before_gst) || total;
  return `  <TALLYMESSAGE>
    <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Invoice Voucher View">
      <DATE>${date}</DATE>
      <VOUCHERNUMBER>${esc(num)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${esc(party)}</PARTYLEDGERNAME>
      <NARRATION>${esc(`${payload.entity_type || 'service'} ${num} - ${payload.customer_phone || ''}`)}</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(party)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${amt(total)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${esc(o.salesLedger)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amt(taxable)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
  </TALLYMESSAGE>`;
}

export function buildVoucher(entityType: string, payload: any, opts: TallyLedgerOpts = {}): string {
  switch (entityType) {
    case 'sale': return buildSalesVoucher(payload, opts);
    case 'purchaseorder': case 'purchase': case 'goodsreceipt': return buildPurchaseVoucher(payload, opts);
    case 'expense': return buildPaymentVoucher(payload);
    case 'transaction':
      return payload.status === 'success' ? buildReceiptVoucher(payload) : buildPaymentVoucher(payload);
    case 'payment': return buildPaymentVoucher(payload);
    case 'receipt': return buildReceiptVoucher(payload);
    case 'customer': return buildCustomerMaster(payload);
    case 'vendor': return buildVendorMaster(payload);
    case 'product': case 'inventory': return buildStockItemMaster(payload, opts);
    case 'allocation': return buildStockJournal(payload, opts);
    case 'rental': case 'repair': return buildServiceVoucher({ ...payload, entity_type: entityType }, opts);
    default: return buildSalesVoucher(payload, opts);
  }
}