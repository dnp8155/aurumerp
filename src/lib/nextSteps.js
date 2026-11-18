// Workflow map for <NextStepDialog />: after a successful step the user is shown
// where the process goes next and can jump straight to that page.
// Keys match the i18n entries "next.<key>.title" / ".msg" / ".cta".
export const NEXT_STEP_PATHS = {
  store: "/vendors",
  vendor: "/purchase-orders/new",
  purchase_order: "/goods-receipt",
  goods_receipt: "/cataloging",
  cataloging: "/barcode-engine",
  barcode: "/inventory",
  sale: "/pos",
  return: "/inventory",
  rental: "/rentals",
  repair: "/repairs",
  allocation: "/pallets",
  pallet: "/pallets",
  shipment_received: "/pos",
  order: "/allocations",
};