import * as XLSX from 'xlsx';

export function getEmptyMapping() {
  return {
    name: "Default Tally Mapping",
    tally_company: "",
    default_party_ledger: "Cash Customer",
    default_godown: "Main Store",
    default_uom: "Nos",
    cgst_ledger: "CGST",
    sgst_ledger: "SGST",
    igst_ledger: "IGST",
    round_off_ledger: "Round Off",
    default_expense_ledger: "Indirect Expenses",
    default_payment_ledger: "Cash",
    po_party_ledger: "",
    store_godown_map: "",
  };
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  return d.toISOString().split("T")[0];
}

function parseStoreGodownMap(mapStr) {
  const map = {};
  if (!mapStr) return map;
  for (const line of mapStr.split("\n")) {
    const parts = line.split("=").map(s => s?.trim());
    if (parts[0] && parts[1]) map[parts[0]] = parts[1];
  }
  return map;
}

function resolveGodown(storeName, mapping) {
  if (!storeName) return mapping.default_godown || "";
  const storeMap = parseStoreGodownMap(mapping.store_godown_map);
  return storeMap[storeName] || mapping.default_godown || "";
}

// ── Sales → Tally Sales Voucher ──
export function buildSalesSheet(sales, mapping = getEmptyMapping()) {
  const headers = [
    "Voucher Date", "Voucher Number", "Voucher Type", "Party Ledger Name",
    "GSTIN", "Item Name", "Quantity", "UOM", "Rate", "Discount Amount",
    "Taxable Amount", "CGST Rate (%)", "SGST Rate (%)", "IGST Rate (%)",
    "CGST Amount", "SGST Amount", "IGST Amount", "Total Amount", "Narration"
  ];
  const rows = [];
  const skipped = [];
  for (const s of sales) {
    const missing = [];
    if (!s.sale_number) missing.push("Sale Number");
    if (!s.sale_date) missing.push("Sale Date");
    if (!s.items?.length) missing.push("Line Items");
    if (missing.length > 0) {
      skipped.push({ id: s.id, number: s.sale_number || "(no number)", reason: missing.join(", ") + " missing" });
      continue;
    }
    for (const item of s.items) {
      const isInter = s.gst_type === "inter";
      const taxable = (item.quantity || 0) * (item.unit_price || 0) - (item.discount || 0);
      rows.push([
        fmtDate(s.sale_date),
        s.sale_number,
        "Sales",
        s.customer_name || mapping.default_party_ledger || "Cash Customer",
        s.customer_gstin || "",
        item.product_name || "",
        item.quantity || 0,
        mapping.default_uom || "Nos",
        item.unit_price || 0,
        item.discount || 0,
        taxable,
        isInter ? 0 : (item.gst_rate || 0),
        isInter ? 0 : (item.gst_rate || 0),
        isInter ? (item.gst_rate || 0) : 0,
        isInter ? 0 : (item.gst_amount || 0) / 2,
        isInter ? 0 : (item.gst_amount || 0) / 2,
        isInter ? (item.gst_amount || 0) : 0,
        item.total_price || 0,
        `Sale ${s.sale_number}`,
      ]);
    }
  }
  return { headers, rows, skipped, sheetName: "Sales Vouchers" };
}

// ── Purchase Orders → Tally Purchase Order Voucher ──
export function buildPurchaseOrderSheet(pos, mapping = getEmptyMapping()) {
  const headers = [
    "Voucher Date", "Voucher Number", "Voucher Type", "Party Ledger Name",
    "Party GSTIN", "Order Number", "Order Date", "Destination Godown",
    "Item Name", "Quantity", "UOM", "Rate", "Taxable Amount",
    "CGST Rate (%)", "SGST Rate (%)", "IGST Rate (%)",
    "CGST Amount", "SGST Amount", "IGST Amount", "Total Amount",
    "Terms of Delivery", "Narration"
  ];
  const rows = [];
  const skipped = [];
  for (const p of pos) {
    const missing = [];
    if (!p.po_number) missing.push("PO Number");
    if (!p.vendor_name) missing.push("Vendor Name");
    if (!p.items?.length) missing.push("Line Items");
    if (missing.length > 0) {
      skipped.push({ id: p.id, number: p.po_number || "(no number)", reason: missing.join(", ") + " missing" });
      continue;
    }
    const godown = resolveGodown(p.store_name, mapping);
    const voucherDate = fmtDate(p.approved_date || p.created_date);
    for (const item of p.items) {
      const isInter = p.gst_type === "inter";
      const taxable = item.taxable_amount || (item.quantity || 0) * (item.unit_price || 0);
      rows.push([
        voucherDate,
        p.po_number,
        "Purchase Order",
        p.vendor_name || mapping.po_party_ledger || "",
        p.vendor_gst_number || "",
        p.po_number,
        voucherDate,
        godown,
        item.product_name || "",
        item.quantity || 0,
        mapping.default_uom || "Nos",
        item.unit_price || 0,
        taxable,
        isInter ? 0 : (item.gst_rate || 0),
        isInter ? 0 : (item.gst_rate || 0),
        isInter ? (item.gst_rate || 0) : 0,
        isInter ? 0 : (item.gst_amount || 0) / 2,
        isInter ? 0 : (item.gst_amount || 0) / 2,
        isInter ? (item.gst_amount || 0) : 0,
        item.total_price || 0,
        p.notes || "",
        `PO ${p.po_number}`,
      ]);
    }
  }
  return { headers, rows, skipped, sheetName: "Purchase Orders" };
}

// ── Inventory → Tally Stock Item Master ──
export function buildInventorySheet(inventory, products, mapping = getEmptyMapping()) {
  const headers = [
    "Name", "Part No.", "Parent / Group", "Units",
    "Opening Balance (Quantity)", "Opening Balance (Value)",
    "GST Rate (%)", "Godown", "Category"
  ];
  const rows = [];
  const skipped = [];
  const productMap = {};
  for (const p of products) productMap[p.id] = p;
  for (const inv of inventory) {
    const product = productMap[inv.product_id];
    const name = inv.product_name || product?.name;
    if (!name) {
      skipped.push({ id: inv.id, number: inv.sku || "(no sku)", reason: "Missing product name" });
      continue;
    }
    const godown = resolveGodown(inv.store_name, mapping);
    rows.push([
      name,
      product?.sku || inv.sku || "",
      product?.category || "",
      mapping.default_uom || "Nos",
      inv.quantity || 0,
      0,
      product?.gst_rate || 3,
      godown,
      product?.vertical || "",
    ]);
  }
  return { headers, rows, skipped, sheetName: "Stock Items" };
}

// ── Expenses → Tally Journal Voucher ──
export function buildExpenseSheet(expenses, mapping = getEmptyMapping()) {
  const headers = [
    "Voucher Date", "Voucher Number", "Voucher Type", "Ledger Name",
    "Debit Amount", "Credit Amount", "GST Amount", "Total Amount",
    "Payment Mode", "Narration"
  ];
  const rows = [];
  const skipped = [];
  for (const e of expenses) {
    const missing = [];
    if (!e.expense_number) missing.push("Expense Number");
    if (!e.expense_date) missing.push("Expense Date");
    if (!e.amount) missing.push("Amount");
    if (missing.length > 0) {
      skipped.push({ id: e.id, number: e.expense_number || "(no number)", reason: missing.join(", ") + " missing" });
      continue;
    }
    rows.push([
      fmtDate(e.expense_date),
      e.expense_number,
      "Journal",
      e.vendor_name || e.category || mapping.default_expense_ledger || "Indirect Expenses",
      e.total_amount || e.amount || 0,
      0,
      e.gst_amount || 0,
      e.total_amount || e.amount || 0,
      e.payment_mode || "",
      e.description || "",
    ]);
  }
  return { headers, rows, skipped, sheetName: "Expenses" };
}

// ── Transactions → Tally Payment Voucher ──
export function buildTransactionSheet(transactions, mapping = getEmptyMapping()) {
  const headers = [
    "Voucher Date", "Voucher Number", "Voucher Type", "Party Ledger Name",
    "Amount", "Payment Mode", "Reference Number", "Narration"
  ];
  const rows = [];
  const skipped = [];
  for (const t of transactions) {
    const missing = [];
    if (!t.transaction_number) missing.push("Transaction Number");
    if (!t.amount) missing.push("Amount");
    if (!t.transaction_date) missing.push("Transaction Date");
    if (missing.length > 0) {
      skipped.push({ id: t.id, number: t.transaction_number || "(no number)", reason: missing.join(", ") + " missing" });
      continue;
    }
    rows.push([
      fmtDate(t.transaction_date),
      t.transaction_number,
      "Payment",
      t.customer_name || mapping.default_payment_ledger || "Cash",
      t.amount || 0,
      t.payment_method || "",
      t.reference_id || "",
      `Transaction ${t.transaction_number}`,
    ]);
  }
  return { headers, rows, skipped, sheetName: "Payments" };
}

// ── Generate and download XLSX ──
export function generateWorkbook(sheetsData, filename = "tally_export.xlsx") {
  const wb = XLSX.utils.book_new();
  for (const { sheetName, headers, rows } of sheetsData) {
    if (rows.length === 0) continue;
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  }
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}