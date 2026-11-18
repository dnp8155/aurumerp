#!/usr/bin/env node
/**
 * Tally Bridge Agent  —  Aurum ERP ↔ TallyPrime
 * ---------------------------------------------------------------
 * Runs on the Windows server next to TallyPrime. Polls the Aurum ERP
 * cloud for pending Tally sync jobs, posts each XML envelope to the
 * local TallyPrime HTTP endpoint (default http://localhost:9000), and
 * reports the result back. Fully automatic — install once and leave it.
 *
 * Requires Node.js 18+ (built-in fetch). No npm dependencies.
 */

const fs = require('fs');
const path = require('path');

const AGENT_VERSION = '1.2.0';

// ---------- Config ----------
function loadConfig() {
  const cfgPath = path.join(__dirname, 'config.json');
  let fileCfg = {};
  try {
    fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    // config.json optional if env vars are used
  }
  return {
    BRIDGE_URL: process.env.TALLY_BRIDGE_URL || fileCfg.bridge_url || 'https://aurumerp.base44.app/functions/tallySync',
    BRIDGE_TOKEN: process.env.TALLY_BRIDGE_TOKEN || fileCfg.bridge_token || '',
    TALLY_URL: process.env.TALLY_URL || fileCfg.tally_url || 'http://localhost:9000',
    POLL_INTERVAL_SEC: Number(process.env.POLL_INTERVAL_SEC || fileCfg.poll_interval_sec) || 15,
    BATCH_SIZE: Number(process.env.BATCH_SIZE || fileCfg.batch_size) || 20,
    REQUEST_TIMEOUT_MS: Number(process.env.REQUEST_TIMEOUT_MS || fileCfg.request_timeout_ms) || 15000,
    TALLY_TIMEOUT_MS: Number(process.env.TALLY_TIMEOUT_MS || fileCfg.tally_timeout_ms) || 20000,
  };
}

const CFG = loadConfig();
if (!CFG.BRIDGE_TOKEN) {
  console.error('[FATAL] TALLY_BRIDGE_TOKEN not set. Add it to config.json or the TALLY_BRIDGE_TOKEN env var.');
  console.error('        Generate a long random string and set the SAME value in the app dashboard Secrets page.');
  process.exit(1);
}

// ---------- Tally posting ----------
function parseTallyResponse(body) {
  const ok = /<RESPONSE>[\s\S]*?(Success|Imported|Created)/i.test(body);
  const tallyRef =
    (body.match(/<VOUCHER[\s\S]*?REMOTEID="([^"]+)"/i) || [])[1] ||
    (body.match(/<NAME>([^<]+)<\/NAME>/i) || [])[1] || '';
  return { ok, tallyRef };
}

async function postToTally(envelope) {
  const res = await fetch(CFG.TALLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    body: envelope,
    signal: AbortSignal.timeout(CFG.TALLY_TIMEOUT_MS),
  });
  const body = await res.text();
  const { ok, tallyRef } = parseTallyResponse(body);
  return { ok, status: res.status, body, tallyRef };
}

async function testTally() {
  const probe =
    '<ENVELOPE><HEADER><TALLYREQUEST>Data</TALLYREQUEST></HEADER>' +
    '<BODY><DESC><STATICVARIABLES><SVCURRENTCOMPANY></SVCURRENTCOMPANY></STATICVARIABLES></DESC>' +
    '<DATA><TALLYMESSAGE></TALLYMESSAGE></DATA></BODY></ENVELOPE>';
  try {
    const res = await fetch(CFG.TALLY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      body: probe,
      signal: AbortSignal.timeout(8000),
    });
    return { connected: res.ok, status: res.status, body: (await res.text()).slice(0, 200) };
  } catch (e) {
    return { connected: false, status: 0, body: e.message };
  }
}

// Reads the list of companies (firms) open in the local TallyPrime so the ERP
// can offer a firm picker instead of asking for a hand-typed name.
function parseCompanies(body) {
  const names = new Set();
  let m;
  const attr = /<COMPANY[^>]*\bNAME="([^"]+)"/gi;
  while ((m = attr.exec(body)) !== null) if (m[1].trim()) names.add(m[1].trim());
  if (names.size === 0) {
    const child = /<COMPANY\b[\s\S]{0,300}?<NAME>([^<]+)<\/NAME>/gi;
    while ((m = child.exec(body)) !== null) if (m[1].trim()) names.add(m[1].trim());
  }
  if (names.size === 0) {
    // An inline-TDL export tags each field with its own XMLTAG, so company names
    // arrive as plain <NAME> tags with no <COMPANY> element wrapping them.
    const plain = /<NAME>([^<]+)<\/NAME>/gi;
    while ((m = plain.exec(body)) !== null) if (m[1].trim()) names.add(m[1].trim());
  }
  return Array.from(names).slice(0, 50);
}

// TallyPrime no longer ships the built-in "List of Companies" report that older
// Tally versions had, so the report has to be described inline in the request
// through TDL — Tally's documented way of exporting a report that does not exist.
const COMPANIES_QUERY =
  '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST>' +
  '<TYPE>Data</TYPE><ID>List of Companies</ID></HEADER>' +
  '<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>' +
  '<TDL><TDLMESSAGE>' +
  '<REPORT NAME="List of Companies" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">' +
  '<FORMS>List of Companies</FORMS></REPORT>' +
  '<FORM NAME="List of Companies" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">' +
  '<TOPPARTS>List of Companies</TOPPARTS><XMLTAG>"List of Companies"</XMLTAG></FORM>' +
  '<PART NAME="List of Companies" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">' +
  '<TOPLINES>List of Companies</TOPLINES><REPEAT>List of Companies : Collection of Companies</REPEAT>' +
  '<SCROLLED>Vertical</SCROLLED></PART>' +
  '<LINE NAME="List of Companies" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">' +
  '<LEFTFIELDS>Name</LEFTFIELDS></LINE>' +
  '<FIELD NAME="Name" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">' +
  '<SET>$Name</SET><XMLTAG>"NAME"</XMLTAG></FIELD>' +
  '<COLLECTION NAME="Collection of Companies" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">' +
  '<TYPE>Company</TYPE><FETCH>NAME</FETCH></COLLECTION>' +
  '</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>';

async function fetchCompanies() {
  try {
    const res = await fetch(CFG.TALLY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      body: COMPANIES_QUERY,
      signal: AbortSignal.timeout(CFG.TALLY_TIMEOUT_MS),
    });
    const body = await res.text();
    if (!res.ok) {
      companiesDiagnostic = `Tally HTTP ${res.status}: ${body.slice(0, 250)}`;
      console.error(`[companies] ${companiesDiagnostic}`);
      return [];
    }
    const companies = parseCompanies(body);
    if (companies.length === 0) {
      const lineError = (body.match(/<LINEERROR>([\s\S]*?)<\/LINEERROR>/i) || [])[1];
      companiesDiagnostic = lineError
        ? `Tally refused the company list: ${lineError.replace(/\s+/g, ' ').trim().slice(0, 250)}`
        : 'Tally returned no company — open a company in TallyPrime, then reload.';
      console.error(`[companies] ${companiesDiagnostic}`);
    } else {
      companiesDiagnostic = '';
    }
    return companies;
  } catch (e) {
    companiesDiagnostic = `Tally unreachable: ${e.message}`;
    console.error(`[companies] ${e.message}`);
    return [];
  }
}

// ---------- ERP bridge calls ----------
async function callBridge(payload) {
  const res = await fetch(CFG.BRIDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(CFG.REQUEST_TIMEOUT_MS),
  });
  return res.json();
}

// ---------- Main loop ----------
let tallyConnected = false;
let tallyCompanies = [];
let companiesDiagnostic = '';
let tallyResponse = '';
let lastTallyTest = 0;

async function pollOnce() {
  const now = Date.now();
  if (now - lastTallyTest > 60000) {
    const t = await testTally();
    tallyConnected = t.connected;
    tallyCompanies = tallyConnected ? await fetchCompanies() : [];
    tallyResponse = tallyCompanies.length > 0
      ? `Company open in Tally: ${tallyCompanies.join(', ')}`
      : (companiesDiagnostic || `HTTP ${t.status}: ${(t.body || '').slice(0, 250)}`);
    lastTallyTest = now;
    console.log(`[tally] ${tallyConnected ? 'connected' : 'unreachable'} (HTTP ${t.status}), ${tallyCompanies.length} company(ies)`);
    if (tallyCompanies.length > 0) console.log(`[tally] company open: ${tallyCompanies.join(', ')}`);
    else console.warn(`[tally] no company detected — ${tallyResponse}`);
  }

  let jobs = [];
  try {
    const data = await callBridge({
      action: 'agentPoll',
      bridge_token: CFG.BRIDGE_TOKEN,
      agent_version: AGENT_VERSION,
      tally_connected: tallyConnected,
      tally_url: CFG.TALLY_URL,
      tally_response: tallyResponse,
      companies: tallyCompanies,
      limit: CFG.BATCH_SIZE,
    });
    jobs = data.jobs || [];
  } catch (e) {
    console.error(`[poll] failed: ${e.message}`);
    return;
  }

  if (jobs.length === 0) return; // nothing pending

  console.log(`[poll] ${jobs.length} job(s) to deliver`);
  const results = [];
  for (const job of jobs) {
    try {
      const r = await postToTally(job.xml);
      results.push({
        log_id: job.log_id,
        entity_type: job.entity_type,
        entity_id: job.entity_id,
        retry_count: job.retry_count || 0,
        sync_status: r.ok ? 'success' : 'failed',
        tally_reference_id: r.tallyRef,
        error_message: r.ok ? '' : `Tally ${r.status}: ${r.body.slice(0, 300)}`,
      });
      console.log(`  ${job.entity_type} ${job.entity_number || job.log_id}: ${r.ok ? 'OK' : 'FAIL'}`);
    } catch (e) {
      results.push({
        log_id: job.log_id,
        entity_type: job.entity_type,
        entity_id: job.entity_id,
        retry_count: (job.retry_count || 0) + 1,
        sync_status: 'failed',
        error_message: `Network error: ${e.message}`,
      });
      console.error(`  ${job.entity_type} ${job.entity_number || job.log_id}: ERR ${e.message}`);
    }
  }

  try {
    await callBridge({
      action: 'agentReport',
      bridge_token: CFG.BRIDGE_TOKEN,
      agent_version: AGENT_VERSION,
      tally_connected: tallyConnected,
      tally_url: CFG.TALLY_URL,
      tally_response: tallyResponse,
      companies: tallyCompanies,
      results,
    });
  } catch (e) {
    console.error(`[report] failed: ${e.message}`);
  }
}

// ---------- Run ----------
console.log(`[agent] Tally Bridge Agent v${AGENT_VERSION} starting`);
console.log(`[agent] ERP bridge : ${CFG.BRIDGE_URL}`);
console.log(`[agent] Tally URL  : ${CFG.TALLY_URL}`);
console.log(`[agent] Poll every : ${CFG.POLL_INTERVAL_SEC}s, batch ${CFG.BATCH_SIZE}`);

// immediate first poll, then on interval
pollOnce().catch((e) => console.error('[loop]', e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error('[loop]', e.message));
}, CFG.POLL_INTERVAL_SEC * 1000);