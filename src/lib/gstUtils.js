// Shared GST calculation utilities — used by PurchaseOrders, POS, and GST report
// Supports both GST-exclusive (GST added on top) and GST-inclusive (GST embedded in price) pricing

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

/**
 * Detect GST type (intra-state vs inter-state) based on vendor and company states
 * @param {string} vendorState - Vendor's billing state
 * @param {string} companyState - Company's GST registration state
 * @returns {"intra"|"inter"} - intra = CGST+SGST, inter = IGST
 */
export function detectGstType(vendorState, companyState) {
  if (!vendorState || !companyState) return "intra";
  return vendorState.trim().toLowerCase() === companyState.trim().toLowerCase() ? "intra" : "inter";
}

/**
 * Calculate GST breakdown for a given taxable amount
 * @param {number} subtotal - Taxable amount before GST
 * @param {number} gstRate - GST rate in % (e.g. 3 for 3%)
 * @param {"intra"|"inter"} gstType - intra = CGST+SGST, inter = IGST
 */
export function calculateGst(subtotal, gstRate, gstType) {
  const taxable = Number(subtotal) || 0;
  const rate = Number(gstRate) || 0;
  const totalGst = (taxable * rate) / 100;

  if (gstType === "inter") {
    return {
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: Math.round(totalGst * 100) / 100,
      total_gst_amount: Math.round(totalGst * 100) / 100,
    };
  }
  const half = Math.round((totalGst / 2) * 100) / 100;
  return {
    cgst_amount: half,
    sgst_amount: half,
    igst_amount: 0,
    total_gst_amount: Math.round(totalGst * 100) / 100,
  };
}

/**
 * Extract taxable/base amount from a total, depending on pricing type
 * @param {number} totalAmount - The total price (qty * unit_price)
 * @param {number} gstRate - GST rate in %
 * @param {"exclusive"|"inclusive"} pricingType - exclusive = GST on top, inclusive = GST embedded
 * @returns {number} - Taxable/base amount
 */
export function extractTaxableAmount(totalAmount, gstRate, pricingType) {
  const total = Number(totalAmount) || 0;
  const rate = Number(gstRate) || 0;
  if (pricingType === "inclusive" && rate > 0) {
    return total / (1 + rate / 100);
  }
  return total;
}

/**
 * Calculate GST for a single item, respecting inclusive/exclusive pricing
 * @param {number} itemTotal - Total price of the item (qty * unit_price)
 * @param {number} gstRate - GST rate in %
 * @param {"intra"|"inter"} gstType
 * @param {"exclusive"|"inclusive"} pricingType - default "exclusive"
 * @returns {object} - { taxable_amount, cgst_amount, sgst_amount, igst_amount, total_gst_amount }
 */
export function calculateItemGst(itemTotal, gstRate, gstType, pricingType = "exclusive") {
  const taxableAmount = extractTaxableAmount(itemTotal, gstRate, pricingType);
  const breakdown = calculateGst(taxableAmount, gstRate, gstType);
  return {
    ...breakdown,
    taxable_amount: Math.round(taxableAmount * 100) / 100,
  };
}

/**
 * Aggregate GST across multiple items with potentially different rates and pricing types
 * @param {Array} items - Array of items with { total_price, gst_rate, gst_pricing_type }
 * @param {"intra"|"inter"} gstType
 */
export function calculatePoGst(items, gstType) {
  let cgst = 0, sgst = 0, igst = 0, totalGst = 0, subtotalBeforeGst = 0;

  for (const item of items) {
    const itemTotal = Number(item.total_price) || 0;
    const itemGstRate = Number(item.gst_rate) || 0;
    const pricingType = item.gst_pricing_type || "exclusive";

    // For inclusive items, total_price includes GST — extract the taxable base
    const taxableAmount = extractTaxableAmount(itemTotal, itemGstRate, pricingType);
    subtotalBeforeGst += taxableAmount;

    const breakdown = calculateGst(taxableAmount, itemGstRate, gstType);
    cgst += breakdown.cgst_amount;
    sgst += breakdown.sgst_amount;
    igst += breakdown.igst_amount;
    totalGst += breakdown.total_gst_amount;
  }

  // total_with_gst = subtotal_before_gst + total_gst works for both modes:
  //   exclusive: taxable + GST = taxable * (1 + rate)
  //   inclusive: taxable + GST = (inclusive / (1+rate)) + (inclusive - inclusive/(1+rate)) = inclusive
  return {
    subtotal_before_gst: Math.round(subtotalBeforeGst * 100) / 100,
    cgst_amount: Math.round(cgst * 100) / 100,
    sgst_amount: Math.round(sgst * 100) / 100,
    igst_amount: Math.round(igst * 100) / 100,
    total_gst_amount: Math.round(totalGst * 100) / 100,
    total_with_gst: Math.round((subtotalBeforeGst + totalGst) * 100) / 100,
  };
}

/**
 * Format GST type for display
 */
export function formatGstType(gstType) {
  return gstType === "inter" ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)";
}

/**
 * Format pricing type for display
 */
export function formatPricingType(pricingType) {
  return pricingType === "inclusive" ? "Inclusive (GST embedded)" : "Exclusive (GST on top)";
}