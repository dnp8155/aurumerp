import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { image_url } = body;

    if (!image_url) return Response.json({ error: 'Image URL is required' }, { status: 400 });

    const prompt = `You are an expert at reading and extracting data from Indian business bills, invoices, and receipts.
Analyze this bill/invoice image carefully and extract ALL information visible.

Extract the following:
- bill_type: What kind of document is this? ("purchase_invoice", "expense_receipt", "tax_invoice", "bill_of_supply", "estimate")
- vendor_name: The seller/vendor/company name issuing the bill
- vendor_gst: GST number of the vendor if visible (format: 22AAAAA0000A1Z5), or null
- vendor_phone: Phone number if visible, or null
- vendor_address: Address if visible, or null
- bill_number: Invoice/bill number
- bill_date: Date on the bill (format: YYYY-MM-DD if determinable, or null)
- due_date: Due date if visible (format: YYYY-MM-DD), or null
- items: Array of line items, each with:
  - description: Product/service description
  - hsn: HSN/SAC code if visible, or null
  - quantity: Quantity (number)
  - unit: Unit of measurement (e.g. "Pcs", "Kg", "Box"), or null
  - unit_price: Price per unit (number)
  - total_price: Total price for this line (number)
- subtotal: Subtotal before tax (number)
- cgst: Central GST amount (number, 0 if not applicable)
- sgst: State GST amount (number, 0 if not applicable)
- igst: Integrated GST amount (number, 0 if not applicable)
- total_tax: Total tax amount (number)
- round_off: Round off adjustment if any (number, 0 if none)
- grand_total: Grand total amount (number)
- payment_terms: Payment terms if visible (e.g. "Net 30", "Advance"), or null
- notes: Any notes or terms on the bill, or null
- confidence: Your confidence level 0-1 in the extraction accuracy

If a field is not visible or unclear, use null (for strings) or 0 (for numbers). Do NOT guess or fabricate values.
Only return valid JSON, no other text.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [image_url],
      response_json_schema: {
        type: "object",
        properties: {
          bill_type: { type: "string" },
          vendor_name: { type: "string" },
          vendor_gst: { type: "string" },
          vendor_phone: { type: "string" },
          vendor_address: { type: "string" },
          bill_number: { type: "string" },
          bill_date: { type: "string" },
          due_date: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                hsn: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
                unit_price: { type: "number" },
                total_price: { type: "number" }
              }
            }
          },
          subtotal: { type: "number" },
          cgst: { type: "number" },
          sgst: { type: "number" },
          igst: { type: "number" },
          total_tax: { type: "number" },
          round_off: { type: "number" },
          grand_total: { type: "number" },
          payment_terms: { type: "string" },
          notes: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["bill_type", "vendor_name", "bill_number", "items", "subtotal", "total_tax", "grand_total", "confidence"]
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}