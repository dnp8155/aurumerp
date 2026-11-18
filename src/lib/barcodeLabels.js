// A label prints a second (legacy-system) barcode image only when the stored
// legacy code differs from the current one, so labels stay compact otherwise.
export const hasSecondBarcode = (record) =>
  Boolean(record?.legacy_barcode) && record.legacy_barcode !== record.barcode;