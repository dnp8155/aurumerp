import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { buildVoucher, wrapEnvelope } from './tallyXml.ts';
import { verifyBridgeToken, getHeartbeat as getAgentHeartbeat, saveHeartbeat as saveAgentHeartbeat } from '../../shared/agentBridge.ts';
import {
  ENTITY_CONFIG, QUEUE_ENTITY_TYPES, MASTER_TYPES, hashRecord, isEligible, getLastLog, needsSync,
  fetchQueuePage, mappingToOpts, resolveCompany, DEFAULT_MAPPING,
  mappingFingerprint, validateForSync, isMappingReady, MAPPING_REQUIREMENTS,
  MAX_ATTEMPTS, RETRY_BACKOFF_MS,
} from '../../shared/tallySync.ts';

// Only these fields may be written into a mapping record (blocks arbitrary keys).
const MAPPING_FIELDS = [
  'name', 'tally_company', 'default_party_ledger', 'default_godown', 'default_uom',
  'cgst_ledger', 'sgst_ledger', 'igst_ledger', 'round_off_ledger',
  'default_expense_ledger', 'default_payment_ledger', 'po_party_ledger', 'store_godown_map',
];

function pickMapping(input: any): any {
  const out: any = {};
  for (const f of MAPPING_FIELDS) {
    if (input && typeof input[f] === 'string') out[f] = input[f].trim();
  }
  return out;
}

// The mapping vouchers post through: the active one, falling back to the newest
// record (mappings created before the active flag existed).
async function getMapping(base44: any): Promise<any> {
  const { items } = await base44.asServiceRole.entities.TallyMapping.filter({ active: true }, { sort: '-created_date', limit: 1 });
  if (items && items.length > 0) return items[0];
  const fallback = await base44.asServiceRole.entities.TallyMapping.list({ sort: '-created_date', limit: 1 });
  return (fallback.items && fallback.items[0]) || null;
}

// Mapping + per-record-type readiness used by the multi-company controls.
function mappingSummary(m: any): any {
  const perType = Object.keys(MAPPING_REQUIREMENTS).map((et) => ({ entity_type: et, ...isMappingReady(et, m) }));
  return {
    id: m.id,
    name: m.name || '',
    tally_company: m.tally_company || '',
    active: !!m.active,
    ready_types: perType.filter((r) => r.ready).length,
    total_types: perType.length,
    incomplete: perType.filter((r) => !r.ready).map((r) => ({ entity_type: r.entity_type, missing: r.missing })),
  };
}

async function writeLog(base44: any, entry: any): Promise<any> {
  return base44.asServiceRole.entities.TallySyncLog.create({
    entity_type: entry.entity_type,
    entity_id: entry.entity_id || '',
    entity_number: entry.entity_number || '',
    action: entry.action || 'create',
    company: entry.company || '',
    sync_status: entry.sync_status,
    error_message: entry.error_message || '',
    validation_errors: entry.validation_errors || [],
    mapping_hash: entry.mapping_hash || '',
    next_retry_at: entry.next_retry_at || '',
    last_sync_timestamp: new Date().toISOString(),
    tally_reference_id: entry.tally_reference_id || '',
    source_hash: entry.source_hash || '',
    retry_count: entry.retry_count || 0,
    payload: entry.payload || {},
  }).catch(() => null);
}

async function markSynced(base44: any, entityType: string, entityId: string): Promise<void> {
  const cfg = ENTITY_CONFIG[entityType];
  if (cfg && cfg.hasTallySyncedFlag && entityId) {
    await base44.asServiceRole.entities[cfg.entityName].update(entityId, { tally_synced: true }).catch(() => {});
  }
}

// Queue a single record for the Tally Bridge Agent to deliver.
// Validates the record + mapping first, then builds the Tally XML envelope and
// stores it as a pending job. Incomplete records are logged as `blocked` with
// their exact reasons instead of being silently dropped.
async function queueOne(base44: any, entityType: string, record: any, mapping: any, company: string, action = 'create'): Promise<any> {
  const cfg = ENTITY_CONFIG[entityType];
  if (!cfg) {
    return { entity_type: entityType, sync_status: 'unsupported', reasons: [`Unsupported record type: ${entityType}`] };
  }
  const entityId = record.id || '';
  const entityNumber = record[cfg.numberField] || '';
  const sourceHash = hashRecord(record);
  const mappingHash = mappingFingerprint(mapping, company);

  // Idempotency: skip if already successfully synced, or already waiting, for this
  // exact record content + mapping configuration.
  const lastLog = await getLastLog(base44, entityType, entityId).catch(() => null);
  if (lastLog && lastLog.sync_status === 'success' && lastLog.source_hash === sourceHash) {
    return { entity_type: entityType, entity_id: entityId, entity_number: entityNumber, sync_status: 'skipped', reason: 'already_synced', tally_reference_id: lastLog.tally_reference_id || '' };
  }
  if (lastLog && (lastLog.sync_status === 'pending' || lastLog.sync_status === 'retry')
    && lastLog.source_hash === sourceHash && (lastLog.mapping_hash || '') === mappingHash) {
    return { entity_type: entityType, entity_id: entityId, entity_number: entityNumber, sync_status: 'skipped', reason: 'already_queued' };
  }
  if (lastLog && lastLog.sync_status === 'blocked'
    && lastLog.source_hash === sourceHash && (lastLog.mapping_hash || '') === mappingHash) {
    return { entity_type: entityType, entity_id: entityId, entity_number: entityNumber, sync_status: 'skipped', reason: 'still_blocked', reasons: lastLog.validation_errors || [] };
  }

  // Validation before dispatch.
  const validation = validateForSync(entityType, record, mapping);
  if (!validation.ok) {
    await writeLog(base44, {
      entity_type: entityType, entity_id: entityId, entity_number: entityNumber, action, company,
      sync_status: 'blocked', source_hash: sourceHash, mapping_hash: mappingHash,
      error_message: validation.errors.join(' ').slice(0, 1000),
      validation_errors: validation.errors.slice(0, 10),
      payload: { tally_type: cfg.tallyType },
    });
    return { entity_type: entityType, entity_id: entityId, entity_number: entityNumber, sync_status: 'blocked', reasons: validation.errors };
  }

  const opts = mappingToOpts(mapping);
  const voucherXml = buildVoucher(cfg.tallyType, record, opts);
  const envelope = wrapEnvelope(voucherXml, company || '');

  await writeLog(base44, {
    entity_type: entityType, entity_id: entityId, entity_number: entityNumber, action, company,
    sync_status: 'pending', source_hash: sourceHash, mapping_hash: mappingHash,
    payload: { xml: envelope, tally_type: cfg.tallyType },
  });
  return { entity_type: entityType, entity_id: entityId, entity_number: entityNumber, sync_status: 'pending' };
}

// --- Agent heartbeat storage (singleton record in TallyAgentStatus) ---
const TALLY_AGENT_ENTITY = 'TallyAgentStatus';
const TALLY_TOKEN_SECRET = 'TALLY_BRIDGE_TOKEN';

// Local wrappers over the shared bridge helpers so call sites keep their
// existing signatures (entity + secret are fixed for this function).
async function getHeartbeat(base44: any): Promise<any> {
  return getAgentHeartbeat(base44, TALLY_AGENT_ENTITY);
}

async function saveHeartbeat(base44: any, status: any): Promise<void> {
  const existing = await getAgentHeartbeat(base44, TALLY_AGENT_ENTITY);
  const data = {
    agent_version: status.agent_version || '',
    tally_connected: !!status.tally_connected,
    tally_url: status.tally_url || '',
    tally_response: (status.tally_response || '').slice(0, 500),
    pending_count: Number(status.pending_count) || 0,
    // Company list comes from the agent; keep the last known list when a report
    // doesn't carry it (older agent versions, mid-poll reports).
    companies: Array.isArray(status.companies)
      ? status.companies.filter((c: any) => typeof c === 'string' && c.trim()).slice(0, 50)
      : (existing?.companies || []),
    status: status.tally_connected ? 'connected' : 'disconnected',
  };
  await saveAgentHeartbeat(base44, TALLY_AGENT_ENTITY, data, existing);
}

// Job counts per entity type, grouped in one request per status bucket.
async function aggregateByType(base44: any, query: any): Promise<Record<string, number>> {
  try {
    const { rows } = await base44.asServiceRole.entities.TallySyncLog.aggregate({ query, groupBy: 'entity_type' });
    const out: Record<string, number> = {};
    for (const r of rows || []) out[r.entity_type] = r.count || 0;
    return out;
  } catch {
    return {};
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ===== Agent webhook actions (no user auth — bridge token) =====
    if (action === 'agentPoll' || action === 'agentReport') {
      if (!verifyBridgeToken(TALLY_TOKEN_SECRET, body.bridge_token)) {
        return Response.json({ error: 'Invalid bridge token' }, { status: 401 });
      }
      // Record a heartbeat on every agent call.
      await saveHeartbeat(base44, {
        agent_version: body.agent_version,
        tally_connected: body.tally_connected,
        tally_url: body.tally_url,
        tally_response: body.tally_response,
        pending_count: body.pending_count,
        companies: body.companies,
      }).catch(() => {});

      if (action === 'agentPoll') {
        const limit = Math.min(Number(body.limit) || 20, 50);
        const { items } = await base44.asServiceRole.entities.TallySyncLog.filter(
          { sync_status: { $in: ['pending', 'retry'] } },
          { sort: 'created_date', limit: limit * 3 }
        );
        const now = Date.now();
        // Dedupe by entity (one job per entity, oldest first) to avoid double delivery.
        const seen = new Set<string>();
        const jobs: any[] = [];
        for (const log of items || []) {
          // A retry still inside its backoff window is not due yet — leave it queued.
          if (log.next_retry_at && new Date(log.next_retry_at).getTime() > now) continue;
          const key = `${log.entity_type}:${log.entity_id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          jobs.push({
            log_id: log.id,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            entity_number: log.entity_number,
            tally_type: log.payload?.tally_type || '',
            xml: log.payload?.xml || '',
            retry_count: log.retry_count || 0,
          });
          if (jobs.length >= limit) break;
        }
        return Response.json({ jobs, server_time: new Date().toISOString() });
      }

      // action === 'agentReport'
      const results = Array.isArray(body.results) ? body.results : [];
      const logIds = results.map((r: any) => r.log_id).filter(Boolean);
      // One batched read for every reported job — the stored job is authoritative
      // for the entity and the attempt count.
      const { items: logs } = logIds.length > 0
        ? await base44.asServiceRole.entities.TallySyncLog
            .filter({ id: { $in: logIds } }, { limit: 50 })
            .catch(() => ({ items: [] }))
        : { items: [] };
      const logsById: Record<string, any> = {};
      for (const log of logs || []) logsById[log.id] = log;

      const summary = { updated: 0, success: 0, failed: 0, retrying: 0 };
      const updates: any[] = [];
      for (const r of results) {
        const log = logsById[r.log_id];
        if (!log) continue;

        const attempts = (Number(log.retry_count) || 0) + 1;
        const errorMessage = (r.error_message || '').slice(0, 1000);
        const update: any = {
          last_sync_timestamp: new Date().toISOString(),
          tally_reference_id: r.tally_reference_id || '',
          retry_count: attempts,
        };

        if (r.sync_status === 'success') {
          update.sync_status = 'success';
          update.error_message = '';
          update.next_retry_at = '';
          await markSynced(base44, log.entity_type, log.entity_id);
          summary.success++;
        } else if (attempts < MAX_ATTEMPTS) {
          // Bounded auto-retry: the job stays recoverable and is re-polled after a backoff.
          update.sync_status = 'retry';
          update.error_message = errorMessage;
          update.next_retry_at = new Date(Date.now() + RETRY_BACKOFF_MS * attempts).toISOString();
          summary.retrying++;
        } else {
          update.sync_status = 'failed';
          update.error_message = `${errorMessage} (stopped after ${MAX_ATTEMPTS} attempts — retry manually)`.slice(0, 1000);
          update.next_retry_at = '';
          summary.failed++;
        }
        updates.push({ id: r.log_id, ...update });
        summary.updated++;
      }
      if (updates.length > 0) {
        await base44.asServiceRole.entities.TallySyncLog.bulkUpdate(updates).catch(() => {});
      }
      return Response.json({ status: 'reported', summary });
    }

    // ===== Admin actions (user auth required) =====
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const effectiveAction = action || 'sync';

    // ---- Agent status / connectivity test ----
    if (effectiveAction === 'test') {
      const hb = await getHeartbeat(base44);
      if (!hb) return Response.json({ status: 'agent_not_seen', message: 'Tally Bridge Agent has not reported yet. Install and start the agent on your Windows server.' });
      const lastSeen = hb.last_seen ? new Date(hb.last_seen) : null;
      const stale = !lastSeen || (Date.now() - lastSeen.getTime() > 3 * 60 * 1000);
      return Response.json({
        status: stale ? 'agent_stale' : (hb.tally_connected ? 'connected' : 'agent_online_tally_offline'),
        agent_last_seen: hb.last_seen,
        tally_connected: !!hb.tally_connected,
        tally_url: hb.tally_url || '',
        agent_version: hb.agent_version || '',
        message: stale ? 'Agent has not reported in the last 3 minutes.' : (hb.tally_connected ? 'Agent online, Tally reachable.' : 'Agent online but Tally not reachable.'),
      });
    }

    // ---- Readiness check ----
    if (effectiveAction === 'readiness') {
      const mapping = await getMapping(base44);
      const hb = await getHeartbeat(base44);
      const lastSeen = hb && hb.last_seen ? new Date(hb.last_seen) : null;
      const agentSeen = !!(lastSeen && (Date.now() - lastSeen.getTime() < 3 * 60 * 1000));
      const pendingJobs = await base44.asServiceRole.entities.TallySyncLog
        .count({ sync_status: { $in: ['pending', 'retry'] } }).catch(() => 0);
      const blockedJobs = await base44.asServiceRole.entities.TallySyncLog
        .count({ sync_status: 'blocked' }).catch(() => 0);
      const mappingCount = await base44.asServiceRole.entities.TallyMapping.list({ limit: 50 })
        .then((p: any) => (p.items || []).length).catch(() => 0);
      const saleReady = isMappingReady('sale', mapping);
      const checks: any = {
        agent_running: agentSeen,
        tally_connected: !!(hb && hb.tally_connected),
        mapping_configured: !!mapping,
        company_selected: !!(mapping && mapping.tally_company),
        ledgers: {
          sales: !!mapping && !!mapping.default_party_ledger,
          purchase: !!mapping && !!mapping.po_party_ledger,
          cgst: !!mapping && !!mapping.cgst_ledger,
          sgst: !!mapping && !!mapping.sgst_ledger,
          igst: !!mapping && !!mapping.igst_ledger,
        },
        default_godown: !!mapping && !!mapping.default_godown,
        default_uom: !!mapping && !!mapping.default_uom,
        sale_mapping_ready: saleReady.ready,
      };
      const ready = checks.agent_running && checks.tally_connected && checks.mapping_configured
        && checks.company_selected && checks.sale_mapping_ready;
      return Response.json({
        ready,
        checks,
        missing_for_sales: saleReady.missing,
        agent_last_seen: hb?.last_seen || null,
        agent_companies: (hb && hb.companies) || [],
        selected_company: (mapping && mapping.tally_company) || '',
        active_mapping: mapping ? { id: mapping.id, name: mapping.name || '' } : null,
        mapping_count: mappingCount,
        pending_jobs: pendingJobs,
        blocked_jobs: blockedJobs,
      });
    }

    // ---- Accounting coverage: what posts today, what is waiting, what is broken ----
    if (effectiveAction === 'coverage') {
      const mapping = await getMapping(base44);
      const hb = await getHeartbeat(base44);
      const company = resolveCompany(mapping);
      const [syncedRows, openRows, problemRows] = await Promise.all([
        aggregateByType(base44, { sync_status: 'success' }),
        aggregateByType(base44, { sync_status: { $in: ['pending', 'retry'] } }),
        aggregateByType(base44, { sync_status: { $in: ['failed', 'blocked'] } }),
      ]);
      const types = QUEUE_ENTITY_TYPES.map((et) => {
        const cfg = ENTITY_CONFIG[et];
        const readiness = isMappingReady(et, mapping);
        return {
          entity_type: et,
          tally_type: cfg.tallyType,
          record_kind: MASTER_TYPES.includes(et) ? 'master' : 'voucher',
          eligible_statuses: cfg.eligibleStatuses,
          mapping_ready: readiness.ready,
          missing: readiness.missing,
          synced: syncedRows[et] || 0,
          outstanding: openRows[et] || 0,
          problems: problemRows[et] || 0,
        };
      });
      const recentFailures = await base44.asServiceRole.entities.TallySyncLog
        .filter({ sync_status: { $in: ['failed', 'blocked'] } }, { sort: '-last_sync_timestamp', limit: 5 })
        .then((p: any) => p.items || [])
        .catch(() => []);
      const totals = types.reduce(
        (acc, r) => ({ synced: acc.synced + r.synced, outstanding: acc.outstanding + r.outstanding, problems: acc.problems + r.problems }),
        { synced: 0, outstanding: 0, problems: 0 }
      );
      return Response.json({
        company,
        mapping_name: mapping?.name || '',
        company_active: !!company,
        company_known_to_tally: !!(company && Array.isArray(hb?.companies) && hb.companies.includes(company)),
        agent_connected: !!(hb && hb.tally_connected),
        agent_companies: (hb && hb.companies) || [],
        totals,
        types,
        recent_failures: recentFailures,
      });
    }

    // ---- Companies (firms) available in the connected TallyPrime ----
    if (effectiveAction === 'companies') {
      const hb = await getHeartbeat(base44);
      const mapping = await getMapping(base44);
      const lastSeen = hb && hb.last_seen ? new Date(hb.last_seen) : null;
      return Response.json({
        companies: (hb && hb.companies) || [],
        selected_company: (mapping && mapping.tally_company) || '',
        tally_connected: !!(hb && hb.tally_connected),
        agent_seen: !!(lastSeen && (Date.now() - lastSeen.getTime() < 3 * 60 * 1000)),
      });
    }

    // ---- Multi-company mappings: list / save / activate / delete ----
    if (effectiveAction === 'mappings') {
      const { items } = await base44.asServiceRole.entities.TallyMapping.list({ sort: '-created_date', limit: 50 });
      const rows = (items || []).map(mappingSummary);
      return Response.json({ mappings: rows, active_count: rows.filter((r) => r.active).length });
    }

    if (effectiveAction === 'saveMapping') {
      const input = pickMapping(body.mapping || {});
      if (!input.name) return Response.json({ error: 'name required' }, { status: 400 });
      const targetId = typeof body.id === 'string' ? body.id : '';

      if (targetId) {
        const existing = await base44.asServiceRole.entities.TallyMapping.filter({ id: targetId }, { limit: 1 });
        if (!existing.items || existing.items.length === 0) return Response.json({ error: 'mapping not found' }, { status: 404 });
        await base44.asServiceRole.entities.TallyMapping.update(targetId, input);
      } else {
        await base44.asServiceRole.entities.TallyMapping.create({ ...DEFAULT_MAPPING, ...input, active: false });
        const { items } = await base44.asServiceRole.entities.TallyMapping.list({ sort: '-created_date', limit: 1 });
        if (items && items[0]) body.id = items[0].id;
      }
      // New/edited mappings become the routing target unless the user opts out.
      if (body.activate !== false && body.id) {
        await base44.asServiceRole.entities.TallyMapping.updateMany({ active: true }, { $set: { active: false } }).catch(() => {});
        await base44.asServiceRole.entities.TallyMapping.update(body.id, { active: true });
      }
      return Response.json({ status: 'saved', id: body.id });
    }

    if (effectiveAction === 'activateMapping') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      await base44.asServiceRole.entities.TallyMapping.updateMany({ active: true }, { $set: { active: false } }).catch(() => {});
      await base44.asServiceRole.entities.TallyMapping.update(id, { active: true });
      return Response.json({ status: 'activated', id });
    }

    if (effectiveAction === 'deleteMapping') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const { items } = await base44.asServiceRole.entities.TallyMapping.filter({ id }, { limit: 1 });
      const mapping = items && items[0];
      if (!mapping) return Response.json({ error: 'mapping not found' }, { status: 404 });
      await base44.asServiceRole.entities.TallyMapping.delete(id);
      // Deleting the routing target promotes the newest remaining mapping.
      if (mapping.active) {
        const { items: rest } = await base44.asServiceRole.entities.TallyMapping.list({ sort: '-created_date', limit: 1 });
        if (rest && rest[0]) await base44.asServiceRole.entities.TallyMapping.update(rest[0].id, { active: true }).catch(() => {});
      }
      return Response.json({ status: 'deleted', id });
    }

    // ---- Save the selected Tally firm (company) into the active mapping ----
    if (effectiveAction === 'setCompany') {
      const company = typeof body.company === 'string' ? body.company.trim() : '';
      if (!company) return Response.json({ error: 'company required' }, { status: 400 });
      const mapping = await getMapping(base44);
      if (mapping) {
        await base44.asServiceRole.entities.TallyMapping.update(mapping.id, { tally_company: company, active: true });
      } else {
        await base44.asServiceRole.entities.TallyMapping.create({ ...DEFAULT_MAPPING, tally_company: company, active: true });
      }
      return Response.json({ status: 'saved', selected_company: company });
    }

    // ---- Retry a failed/blocked log by id (re-queue from current source) ----
    if (effectiveAction === 'retry') {
      const logId = body.log_id;
      if (!logId) return Response.json({ error: 'log_id required' }, { status: 400 });
      const { items } = await base44.asServiceRole.entities.TallySyncLog.filter({ id: logId }, { limit: 1 });
      const log = items && items[0];
      if (!log) return Response.json({ error: 'log not found' }, { status: 404 });
      const cfg = ENTITY_CONFIG[log.entity_type];
      if (!cfg) return Response.json({ error: 'unsupported entity_type' }, { status: 400 });
      const { items: recs } = await base44.asServiceRole.entities[cfg.entityName].filter({ id: log.entity_id }, { limit: 1 });
      const record = recs && recs[0];
      if (!record) return Response.json({ error: 'source record not found' }, { status: 404 });
      const mapping = await getMapping(base44);
      const res = await queueOne(base44, log.entity_type, record, mapping, log.company || resolveCompany(mapping), 'retry');
      return Response.json(res);
    }

    // ---- Process the recovery queue: scan recent records and queue them ----
    if (effectiveAction === 'processQueue') {
      const mapping = await getMapping(base44);
      const company = body.company || resolveCompany(mapping);
      const mappingHash = mappingFingerprint(mapping, company);
      const types = Array.isArray(body.entity_types) && body.entity_types.length > 0 ? body.entity_types : QUEUE_ENTITY_TYPES;
      const perTypeLimit = Math.min(Number(body.limit) || 10, 25);
      const results: any[] = [];
      // Records that exist but are not at a posting stage are reported, not dropped.
      const deferred: any[] = [];
      for (const et of types) {
        const cfg = ENTITY_CONFIG[et];
        if (!cfg) {
          deferred.push({ entity_type: et, reason: 'Unsupported record type' });
          continue;
        }
        const records = await fetchQueuePage(base44, et, perTypeLimit);
        for (const rec of records) {
          if (!isEligible(et, rec)) {
            deferred.push({
              entity_type: et,
              entity_id: rec.id,
              entity_number: rec[cfg.numberField] || '',
              reason: `status "${rec.status || 'unknown'}" is not a posting stage`,
            });
            continue;
          }
          const lastLog = await getLastLog(base44, et, rec.id).catch(() => null);
          if (!needsSync(rec, lastLog, mappingHash)) continue;
          const res = await queueOne(base44, et, rec, mapping, company, 'queue');
          results.push(res);
        }
      }
      const summary = {
        processed: results.length,
        queued: results.filter(r => r.sync_status === 'pending').length,
        skipped: results.filter(r => r.sync_status === 'skipped').length,
        blocked: results.filter(r => r.sync_status === 'blocked').length,
        deferred: deferred.length,
      };
      return Response.json({ status: 'queued', summary, results, deferred });
    }

    // ---- Sync a single record (default) — queues for the agent ----
    const { entity_type, entity_id, company } = body;
    if (!entity_type || !entity_id) return Response.json({ error: 'entity_type and entity_id required' }, { status: 400 });
    const cfg = ENTITY_CONFIG[entity_type];
    if (!cfg) return Response.json({ error: 'unsupported entity_type' }, { status: 400 });
    const { items: recs } = await base44.asServiceRole.entities[cfg.entityName].filter({ id: entity_id }, { limit: 1 });
    const record = recs && recs[0];
    if (!record) return Response.json({ error: 'source record not found' }, { status: 404 });
    const mapping = await getMapping(base44);
    const res = await queueOne(base44, entity_type, record, mapping, company || resolveCompany(mapping), body.action || 'create');
    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}