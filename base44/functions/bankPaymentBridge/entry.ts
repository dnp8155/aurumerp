import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { verifyBridgeToken, getHeartbeat, saveHeartbeat } from '../../shared/agentBridge.ts';

const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 60_000; // 1 min * attempt number

const AGENT_ENTITY = 'BankAgentStatus';
const TOKEN_SECRET = 'BANK_BRIDGE_TOKEN';

// On a successful bank transfer, finalize the PO + log a BankTransaction.
async function finalizeSuccess(base44: any, job: any, bankReferenceId: string): Promise<void> {
  await base44.asServiceRole.entities.PurchaseOrder.update(job.po_id, {
    payment_status: 'paid',
    payout_id: bankReferenceId,
    payout_status: 'success',
    payout_date: new Date().toISOString(),
    payout_mode: job.payment_mode,
  }).catch(() => {});

  await base44.asServiceRole.entities.BankTransaction.create({
    transaction_date: new Date().toISOString().slice(0, 10),
    amount: job.amount,
    type: 'debit',
    description: 'Vendor payout — ' + job.vendor_name + ' (PO ' + (job.po_number || '') + ')',
    reference_number: bankReferenceId,
    bank_account: job.bank_provider || '',
    matched_entity_type: 'purchase_order',
    matched_entity_id: job.po_id || '',
    matched_entity_number: job.po_number || '',
    status: 'matched',
    notes: job.bank_provider + ' ' + job.payment_mode + ' payout (bank-bridge-agent)',
  }).catch(() => {});
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ===== Agent webhook actions (bridge token, no user auth) =====
    if (action === 'agentPoll' || action === 'agentReport') {
      if (!verifyBridgeToken(TOKEN_SECRET, body.bridge_token)) {
        return Response.json({ error: 'Invalid or missing BANK_BRIDGE_TOKEN' }, { status: 401 });
      }
      await saveHeartbeat(base44, AGENT_ENTITY, {
        agent_version: body.agent_version || '',
        bank_connected: !!body.bank_connected,
        bank_provider: body.bank_provider || '',
        bank_response: (body.bank_response || '').slice(0, 500),
        pending_count: Number(body.pending_count) || 0,
        status: body.bank_connected ? 'connected' : 'disconnected',
      }).catch(() => {});

      if (action === 'agentPoll') {
        const limit = Math.min(Number(body.limit) || 20, 50);
        const provider = typeof body.bank_provider === 'string' ? body.bank_provider.toUpperCase() : '';
        const query: any = { status: { $in: ['pending', 'retry'] } };
        if (provider) query.bank_provider = provider;
        const { items } = await base44.asServiceRole.entities.BankPaymentJob
          .filter(query, { sort: 'queued_at', limit: limit * 3 });
        const now = Date.now();
        const jobs: any[] = [];
        for (const job of items || []) {
          // A retry still inside its backoff window is not due yet.
          if (job.next_retry_at && new Date(job.next_retry_at).getTime() > now) continue;
          jobs.push({
            job_id: job.id,
            po_id: job.po_id,
            po_number: job.po_number,
            vendor_name: job.vendor_name,
            amount: job.amount,
            payment_mode: job.payment_mode,
            bank_provider: job.bank_provider,
            beneficiary_name: job.beneficiary_name,
            beneficiary_account_number: job.beneficiary_account_number,
            beneficiary_ifsc: job.beneficiary_ifsc,
            beneficiary_upi: job.beneficiary_upi,
            narration: job.narration,
            retry_count: job.retry_count || 0,
            payload: job.payload || {},
          });
          if (jobs.length >= limit) break;
        }
        // Mark picked jobs as processing so the same job isn't delivered twice.
        if (jobs.length > 0) {
          await base44.asServiceRole.entities.BankPaymentJob.bulkUpdate(
            jobs.map((j) => ({ id: j.job_id, status: 'processing' }))
          ).catch(() => {});
        }
        return Response.json({ jobs, server_time: new Date().toISOString() });
      }

      // action === 'agentReport'
      const results = Array.isArray(body.results) ? body.results : [];
      const jobIds = results.map((r: any) => r.job_id).filter(Boolean);
      const { items: jobs } = jobIds.length > 0
        ? await base44.asServiceRole.entities.BankPaymentJob
            .filter({ id: { $in: jobIds } }, { limit: 50 })
            .catch(() => ({ items: [] }))
        : { items: [] };
      const jobsById: Record<string, any> = {};
      for (const job of jobs || []) jobsById[job.id] = job;

      const summary = { updated: 0, success: 0, failed: 0, retrying: 0 };
      const updates: any[] = [];
      const finalizeCalls: Promise<any>[] = [];
      for (const r of results) {
        const job = jobsById[r.job_id];
        if (!job) continue;
        const attempts = (Number(job.retry_count) || 0) + 1;
        const errorMessage = (r.error_message || '').slice(0, 1000);
        const update: any = {
          processed_at: new Date().toISOString(),
          bank_reference_id: r.bank_reference_id || '',
          retry_count: attempts,
        };

        if (r.sync_status === 'success') {
          update.status = 'success';
          update.error_message = '';
          update.next_retry_at = '';
          finalizeCalls.push(finalizeSuccess(base44, job, r.bank_reference_id || ''));
          summary.success++;
        } else if (attempts < MAX_ATTEMPTS) {
          update.status = 'retry';
          update.error_message = errorMessage;
          update.next_retry_at = new Date(Date.now() + RETRY_BACKOFF_MS * attempts).toISOString();
          summary.retrying++;
        } else {
          update.status = 'failed';
          update.error_message = `${errorMessage} (stopped after ${MAX_ATTEMPTS} attempts — retry manually)`.slice(0, 1000);
          update.next_retry_at = '';
          // Revert PO to unpaid so it reappears in the due list.
          finalizeCalls.push(
            base44.asServiceRole.entities.PurchaseOrder.update(job.po_id, { payment_status: 'unpaid' }).catch(() => {})
          );
          summary.failed++;
        }
        updates.push({ id: r.job_id, ...update });
        summary.updated++;
      }
      if (updates.length > 0) {
        await base44.asServiceRole.entities.BankPaymentJob.bulkUpdate(updates).catch(() => {});
      }
      await Promise.allSettled(finalizeCalls);
      return Response.json({ status: 'reported', summary });
    }

    // ===== Admin actions (user auth required) =====
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    if (action === 'status') {
      const hb = await getHeartbeat(base44, AGENT_ENTITY);
      if (!hb) return Response.json({ status: 'agent_not_seen', message: 'Bank Bridge Agent has not reported yet.' });
      const lastSeen = hb.last_seen ? new Date(hb.last_seen) : null;
      const stale = !lastSeen || (Date.now() - lastSeen.getTime() > 3 * 60 * 1000);
      return Response.json({
        status: stale ? 'agent_stale' : (hb.bank_connected ? 'connected' : 'agent_online_bank_offline'),
        agent_last_seen: hb.last_seen,
        bank_connected: !!hb.bank_connected,
        bank_provider: hb.bank_provider || '',
        agent_version: hb.agent_version || '',
        pending_count: hb.pending_count || 0,
        message: stale ? 'Agent has not reported in the last 3 minutes.' : (hb.bank_connected ? 'Agent online, bank API reachable.' : 'Agent online but bank API not reachable.'),
      });
    }

    if (action === 'coverage') {
      const hb = await getHeartbeat(base44, AGENT_ENTITY);
      const [pending, success, failed, retry] = await Promise.all([
        base44.asServiceRole.entities.BankPaymentJob.count({ status: 'pending' }).catch(() => 0),
        base44.asServiceRole.entities.BankPaymentJob.count({ status: 'success' }).catch(() => 0),
        base44.asServiceRole.entities.BankPaymentJob.count({ status: 'failed' }).catch(() => 0),
        base44.asServiceRole.entities.BankPaymentJob.count({ status: 'retry' }).catch(() => 0),
      ]);
      const recent = await base44.asServiceRole.entities.BankPaymentJob
        .filter({ status: { $in: ['failed', 'retry'] } }, { sort: '-processed_at', limit: 10 })
        .then((p: any) => p.items || []).catch(() => []);
      return Response.json({
        agent_last_seen: hb?.last_seen || null,
        bank_connected: !!(hb && hb.bank_connected),
        bank_provider: hb?.bank_provider || '',
        counts: { pending, success, failed, retry },
        recent_problems: recent,
      });
    }

    if (action === 'retry') {
      const jobId = body.job_id;
      if (!jobId) return Response.json({ error: 'job_id required' }, { status: 400 });
      const { items } = await base44.asServiceRole.entities.BankPaymentJob.filter({ id: jobId }, { limit: 1 });
      const job = items && items[0];
      if (!job) return Response.json({ error: 'job not found' }, { status: 404 });
      await base44.asServiceRole.entities.BankPaymentJob.update(jobId, {
        status: 'pending',
        error_message: '',
        next_retry_at: '',
        retry_count: 0,
        queued_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.PurchaseOrder.update(job.po_id, { payment_status: 'partial' }).catch(() => {});
      return Response.json({ status: 're-queued', job_id: jobId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}