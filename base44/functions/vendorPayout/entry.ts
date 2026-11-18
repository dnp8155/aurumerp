import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const RZP_BASE = 'https://api.razorpay.com/v1';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { po_id, mode, dry_run } = body;

    if (!po_id) return Response.json({ error: 'po_id is required' }, { status: 400 });

    const keyId = secrets.get('RAZORPAYX_KEY_ID');
    const keySecret = secrets.get('RAZORPAYX_KEY_SECRET');
    if (!keyId || !keySecret) {
      return Response.json(
        { error: 'RazorpayX credentials not configured. Set RAZORPAYX_KEY_ID and RAZORPAYX_KEY_SECRET in the app Secrets.' },
        { status: 500 }
      );
    }

    const authHeader = 'Basic ' + btoa(keyId + ':' + keySecret);

    // Load PO
    const po = await base44.entities.PurchaseOrder.get(po_id);
    if (!po) return Response.json({ error: 'Purchase Order not found' }, { status: 404 });

    if (po.payment_status === 'paid') {
      return Response.json({ error: 'PO is already marked paid', po_number: po.po_number }, { status: 400 });
    }

    const payable = Number(po.payable_amount || po.total_with_gst || po.total_amount || 0);
    if (payable <= 0) {
      return Response.json({ error: 'Payable amount is zero or missing' }, { status: 400 });
    }

    // Load vendor
    if (!po.vendor_id) return Response.json({ error: 'PO has no vendor linked' }, { status: 400 });
    const vendor = await base44.entities.Vendor.get(po.vendor_id);
    if (!vendor) return Response.json({ error: 'Vendor not found' }, { status: 404 });

    // Validate bank details
    const hasBank = !!(vendor.bank_account_number && vendor.bank_ifsc_code && vendor.bank_account_name);
    const hasUpi = !!vendor.bank_upi_id;
    if (!hasBank && !hasUpi) {
      return Response.json(
        { error: 'Vendor bank details incomplete. Need account number + IFSC + holder name, OR a UPI ID.' },
        { status: 400 }
      );
    }

    const requestedMode = (mode || '').toUpperCase();
    const payoutMode = requestedMode === 'UPI'
      ? 'UPI'
      : requestedMode === 'NEFT'
        ? 'NEFT'
        : requestedMode === 'RTGS'
          ? 'RTGS'
          : 'IMPS'; // default

    // Dry run — validate only, no API calls
    if (dry_run) {
      return Response.json({
        dry_run: true,
        po_number: po.po_number,
        vendor_name: vendor.name,
        payable_amount: payable,
        mode: payoutMode,
        bank_details_ok: true,
        using_upi: payoutMode === 'UPI' && hasUpi,
        using_bank: payoutMode !== 'UPI' || !hasUpi
      });
    }

    // 1. Create or reuse RazorpayX contact
    let contactId = vendor.razorpay_contact_id;
    if (!contactId) {
      const contactRes = await fetch(`${RZP_BASE}/contacts`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vendor.name,
          type: 'vendor',
          contact: vendor.phone || '',
          email: vendor.email || ''
        }),
        signal: AbortSignal.timeout(15000)
      });
      const contactData: any = await contactRes.json();
      if (!contactData.id) {
        return Response.json({ error: 'RazorpayX contact creation failed', details: contactData }, { status: 502 });
      }
      contactId = contactData.id;
      await base44.entities.Vendor.update(vendor.id, { razorpay_contact_id: contactId });
    }

    // 2. Create or reuse fund account
    let fundAccountId = vendor.razorpay_fund_account_id;
    if (!fundAccountId) {
      const faBody: any = { contact_id: contactId };
      if (payoutMode === 'UPI' && hasUpi) {
        faBody.account_type = 'vpa';
        faBody.vpa = { address: vendor.bank_upi_id };
      } else {
        faBody.account_type = 'bank_account';
        faBody.bank_account = {
          name: vendor.bank_account_name,
          account_number: vendor.bank_account_number,
          ifsc: vendor.bank_ifsc_code
        };
      }
      const faRes = await fetch(`${RZP_BASE}/fund_accounts`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(faBody),
        signal: AbortSignal.timeout(15000)
      });
      const faData: any = await faRes.json();
      if (!faData.id) {
        return Response.json({ error: 'RazorpayX fund account creation failed', details: faData }, { status: 502 });
      }
      fundAccountId = faData.id;
      await base44.entities.Vendor.update(vendor.id, { razorpay_fund_account_id: fundAccountId });
    }

    // 3. Create payout (amount in paise)
    const payoutRes = await fetch(`${RZP_BASE}/payouts`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fund_account_id: fundAccountId,
        amount: Math.round(payable * 100),
        currency: 'INR',
        mode: payoutMode.toLowerCase(),
        purpose: 'vendor_bill',
        reference_id: po.po_number || po.id,
        narration: 'Vendor payment for PO ' + (po.po_number || po.id)
      }),
      signal: AbortSignal.timeout(20000)
    });
    const payoutData: any = await payoutRes.json();
    if (!payoutData.id) {
      return Response.json({ error: 'RazorpayX payout creation failed', details: payoutData }, { status: 502 });
    }

    // 4. Update PO
    await base44.entities.PurchaseOrder.update(po.id, {
      payment_status: 'paid',
      payout_id: payoutData.id,
      payout_status: payoutData.status,
      payout_date: new Date().toISOString(),
      payout_mode: payoutMode
    });

    // 5. Log BankTransaction
    await base44.entities.BankTransaction.create({
      transaction_date: new Date().toISOString().slice(0, 10),
      amount: payable,
      type: 'debit',
      description: 'Vendor payout — ' + vendor.name + ' (PO ' + (po.po_number || po.id) + ')',
      reference_number: payoutData.id,
      bank_account: vendor.bank_name || '',
      matched_entity_type: 'purchase_order',
      matched_entity_id: po.id,
      matched_entity_number: po.po_number || '',
      status: 'matched',
      notes: 'RazorpayX ' + payoutMode + ' payout'
    });

    return Response.json({
      success: true,
      payout_id: payoutData.id,
      payout_status: payoutData.status,
      po_number: po.po_number,
      vendor_name: vendor.name,
      amount: payable,
      mode: payoutMode
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}