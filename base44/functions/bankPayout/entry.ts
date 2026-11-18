import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

// Snapshots vendor bank details into the job so the agent has everything it
// needs without a second round-trip to load the vendor.
function buildBeneficiary(vendor: any, mode: string) {
  const useUpi = mode === 'UPI' && !!vendor.bank_upi_id;
  return {
    beneficiary_name: vendor.bank_account_name || vendor.name || '',
    beneficiary_account_number: useUpi ? '' : (vendor.bank_account_number || ''),
    beneficiary_ifsc: useUpi ? '' : (vendor.bank_ifsc_code || ''),
    beneficiary_upi: useUpi ? (vendor.bank_upi_id || '') : '',
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { po_id, mode, bank_provider, dry_run } = body;
    if (!po_id) return Response.json({ error: 'po_id is required' }, { status: 400 });

    const provider = (bank_provider || 'ICICI').toUpperCase();

    const po = await base44.entities.PurchaseOrder.get(po_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!po) return Response.json({ error: 'Purchase Order not found' }, { status: 404 });

    if (po.payment_status === 'paid') {
      return Response.json({ error: 'PO is already marked paid', po_number: po.po_number }, { status: 400 });
    }

    const payable = Number(po.payable_amount || po.total_with_gst || po.total_amount || 0);
    if (payable <= 0) return Response.json({ error: 'Payable amount is zero or missing' }, { status: 400 });

    if (!po.vendor_id) return Response.json({ error: 'PO has no vendor linked' }, { status: 400 });
    const vendor = await base44.entities.Vendor.get(po.vendor_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!vendor) return Response.json({ error: 'Vendor not found' }, { status: 404 });

    const hasBank = !!(vendor.bank_account_number && vendor.bank_ifsc_code && vendor.bank_account_name);
    const hasUpi = !!vendor.bank_upi_id;
    if (!hasBank && !hasUpi) {
      return Response.json(
        { error: 'Vendor bank details incomplete. Need account number + IFSC + holder name, OR a UPI ID.' },
        { status: 400 }
      );
    }

    const requestedMode = (mode || '').toUpperCase();
    const payoutMode = requestedMode === 'UPI' ? 'UPI'
      : requestedMode === 'NEFT' ? 'NEFT'
      : requestedMode === 'RTGS' ? 'RTGS'
      : 'IMPS';

    const beneficiary = buildBeneficiary(vendor, payoutMode);

    // Dry run — validate only, no job queued.
    if (dry_run) {
      return Response.json({
        dry_run: true,
        po_number: po.po_number,
        vendor_name: vendor.name,
        payable_amount: payable,
        mode: payoutMode,
        bank_provider: provider,
        bank_details_ok: true,
        using_upi: payoutMode === 'UPI' && hasUpi,
        using_bank: payoutMode !== 'UPI' || !hasUpi,
        beneficiary,
      });
    }

    // Prevent duplicate queued jobs for the same PO (one pending/retry at a time).
    const existing = await base44.asServiceRole.entities.BankPaymentJob
      .filter({ po_id: po.id, status: { $in: ['pending', 'processing', 'retry'] } }, { limit: 1 })
      .catch(() => ({ items: [] }));
    if (existing.items && existing.items.length > 0) {
      return Response.json(
        { error: 'A bank payment is already queued for this PO', job_id: existing.items[0].id, status: existing.items[0].status },
        { status: 400 }
      );
    }

    const payload = {
      po_number: po.po_number || po.id,
      vendor_name: vendor.name,
      amount: payable,
      mode: payoutMode,
      narration: 'Vendor payment for PO ' + (po.po_number || po.id),
      ...beneficiary,
    };

    const job = await base44.asServiceRole.entities.BankPaymentJob.create({
      po_id: po.id,
      po_number: po.po_number || '',
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      amount: payable,
      payment_mode: payoutMode,
      bank_provider: provider,
      ...beneficiary,
      narration: payload.narration,
      status: 'pending',
      retry_count: 0,
      queued_at: new Date().toISOString(),
      initiated_by: user.full_name || user.email || '',
      payload,
    });

    // Mark PO as in-flight so it leaves the "due" list until the agent reports back.
    await base44.asServiceRole.entities.PurchaseOrder.update(po.id, {
      payment_status: 'partial',
      payout_mode: payoutMode,
    }).catch(() => {});

    return Response.json({
      success: true,
      job_id: job.id,
      po_number: po.po_number,
      vendor_name: vendor.name,
      amount: payable,
      mode: payoutMode,
      bank_provider: provider,
      status: 'pending',
      message: 'Queued for the bank-bridge-agent. It will be delivered once the agent polls.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}