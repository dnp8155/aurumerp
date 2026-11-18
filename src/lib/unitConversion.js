// Unit conversion helpers for Bangles: Box → Dozen → Nos

export const DOZENS_PER_BOX_OPTIONS = [4, 5];

/**
 * Calculate total nos (pieces) for a PO item based on unit, quantity, and dozens_per_box
 * - nos: qty
 * - dozen: qty × 12
 * - box: qty × dozens_per_box × 12
 */
export function calcTotalNos(item) {
  const qty = Number(item.quantity) || 0;
  switch (item.unit) {
    case "dozen":
      return qty * 12;
    case "box":
      return qty * (Number(item.dozens_per_box) || 4) * 12;
    default:
      return qty;
  }
}

/**
 * Calculate total price for a PO item
 * - nos/dozen: unit_price is per nos → total = totalNos × unit_price
 * - box: unit_price is per box → total = quantity × unit_price
 */
export function calcItemTotalPrice(item) {
  const unitPrice = Number(item.unit_price) || 0;
  if (item.unit === "box") {
    return (Number(item.quantity) || 0) * unitPrice;
  }
  return calcTotalNos(item) * unitPrice;
}

/**
 * Calculate per-nos price for display
 * - nos/dozen: unit_price is already per nos
 * - box: divide box price by nos per box
 */
export function calcPerNosPrice(item) {
  if (item.unit === "box") {
    const nosPerBox = (Number(item.dozens_per_box) || 4) * 12;
    if (nosPerBox === 0) return 0;
    return (Number(item.unit_price) || 0) / nosPerBox;
  }
  return Number(item.unit_price) || 0;
}

/**
 * Determine if a product is a bangles product
 * Checks Product entity vertical first, falls back to name heuristic
 */
export function isBanglesProduct(productCode, productName, products) {
  if (products && productCode) {
    const record = products.find((p) => p.sku === productCode);
    if (record?.vertical === "Bangles") return true;
    if (record?.vertical === "Art Jewellery") return false;
  }
  if (productName) {
    const name = productName.toLowerCase();
    if (name.includes("bangle") || name.includes("kada") || name.includes("chudi") || name.includes("valay")) return true;
  }
  return false;
}