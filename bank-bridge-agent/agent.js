#!/usr/bin/env node
/**
 * Bank Bridge Agent  —  Aurum ERP ↔ Corporate Bank API (ICICI CIB / HDFC / Kotak)
 * ---------------------------------------------------------------------------
 * Runs on a Windows PC whose public IP is whitelisted in the bank's API portal.
 * Polls the Aurum ERP cloud for pending vendor-payment jobs, delivers each one
 * to the corporate bank's fund-transfer API, and reports the result back.
 *
 * WHY THIS EXISTS: ICICI/HDFC corporate APIs require the calling server's IP to
 * be whitelisted. Aurum ERP runs on Base44 cloud (IP you don't control), so the
 * bank would reject calls from it. This agent runs from YOUR whitelisted PC and
 * bridges the gap — exactly like the Tally Bridge Agent, but for bank payments.
 *
 * Requires Node.js 18+ (built-in fetch). No npm dependencies.
 *
 * >>> IMPORTANT <<<
 * The callBankPayment() function below is a SCAFFOLD. The exact ICICI CIB API
 * endpoints, auth flow, and request schema are provided in the SDK you download
 * from the ICICI developer portal after onboarding. Fill in that section once
 * you have your real credentials and the Integration Kit. Until then, the agent
 * runs but every payment will report "bank API not configured".
 */

const fs = require('fs');
const path = require('path');

const AGENT_VERSION = '1.0.0';

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
    BRIDGE_URL: process.env.BANK_BRIDGE_URL || fileCfg.bridge_url || 'https://aurumerp.base44.app/functions/bankPaymentBridge',
    BRIDGE_TOKEN: process.env.BANK_BRIDGE_TOKEN || fileCfg.bridge_token || '',
    BANK_PROVIDER: (process.env.BANK_PROVIDER || fileCfg.bank_provider || 'ICICI').toUpperCase(),
    POLL_INTERVAL_SEC: Number(process.env.POLL_INTERVAL_SEC || fileCfg.poll_interval_sec) || 20,
    BATCH_SIZE: Number(process.env.BATCH_SIZE || fileCfg.batch_size) || 10,
    REQUEST_TIMEOUT_MS: Number(process.env.REQUEST_TIMEOUT_MS || fileCfg.request_timeout_ms) || 15000,
    BANK_TIMEOUT_MS: Number(process.env.BANK_TIMEOUT_MS || fileCfg.bank_timeout_ms) || 30000,
    // ICICI CIB credentials (move to env vars in production)
    ICICI_CLIENT_ID: process.env.ICICI_CLIENT_ID || fileCfg.icici_client_id || '',
    ICICI_CLIENT_SECRET: process.env.ICICI_CLIENT_SECRET || fileCfg.icici_client_secret || '',
    ICICI_API_KEY: process.env.ICICI_API_KEY || fileCfg.icici_api_key || '',
    ICICI_API_BASE: process.env.ICICI_API_BASE || fileCfg.icici_api_base || 'https://apis.icicibank.com/v1/corporate-api',
  };
}

const CFG = loadConfig();
if (!CFG.BRIDGE_TOKEN) {
  console.error('[FATAL] BANK_BRIDGE_TOKEN not set. Add it to config.json or the BANK_BRIDGE_TOKEN env var.');
  console.error('        Generate a long random string and set the SAME value in the app dashboard Secrets page.');
  process.exit(1);
}

// ---------- Bank API call (ICICI CIB scaffold) ----------
// TODO(after onboarding): replace the body of this function with the real ICICI
// CIB API calls using the SDK/spec from your Integration Kit download. The
// shape below is a reasonable starting point for ICICI's OAuth + fund-transfer
// flow, but VERIFY every endpoint and field name against the official docs.
let cachedBankToken = null;
let cachedBankTokenExpiry = 0;

async function getIciciAccessToken() {
  const now = Date.now();
  if (cachedBankToken && now < cachedBankTokenExpiry) return cachedBankToken;
  // TODO: replace with the real ICICI token endpoint + grant. Typical flow:
  //   POST {ICICI_API_BASE}/oauth2/token
  //   body: grant_type=client_credentials, client_id, client_secret (or signed JWT)
  // The line below is a placeholder so the agent runs without crashing.
  throw new Error('ICICI CIB token endpoint not implemented — fill getIciciAccessToken() after onboarding.');
}

async function callBankPayment(job) {
  // job fields available:
  //   job.po_number, job.vendor_name, job.amount, job.payment_mode (IMPS/NEFT/RTGS/UPI),
  //   job.beneficiary_name, job.beneficiary_account_number, job.beneficiary_ifsc,
  //   job.beneficiary_upi, job.narration
  //
  // Expected return: { ok: boolean, bankReferenceId: string, raw: string }
  try {
    const token = await getIciciAccessToken();
    // TODO: replace with the real ICICI CIB fund-transfer endpoint + schema.
    // Typical (VERIFY against your SDK):
    //   POST {ICICI_API_BASE}/payments/transfer
    //   headers: Authorization: Bearer <token>, X-IBM-Client-Id: <client_id>
    //   body: {
    //     paymentMode: job.payment_mode,
    //     amount: job.amount,
    //     beneficiaryName: job.beneficiary_name,
    //     accountNumber: job.beneficiary_account_number,
    //     ifsc: job.beneficiary_ifsc,
    //     vpa: job.beneficiary_upi,           // for UPI mode
    //     narration: job.narration,
    //     clientRef: job.po_number
    //   }
    //   response: { UTR/RRN, status, ... }
    throw new Error('ICICI CIB fund-transfer endpoint not implemented — fill callBankPayment() after onboarding.');
  } catch (e) {
    return { ok: false, bankReferenceId: '', raw: e.message };
  }
}

// Lightweight reachability probe reported as the agent heartbeat.
async function testBank() {
  try {
    if (!CFG.ICICI_CLIENT_ID || !CFG.ICICI_CLIENT_SECRET) {
      return { connected: false, status: 0, body: 'ICICI credentials not set in config.json' };
    }
    // TODO: hit a real ICICI health/balance endpoint once implemented.
    return { connected: false, status: 0, body: 'Bank probe pending ICICI CIB implementation' };
  } catch (e) {
    return { connected: false, status: 0, body: e.message };
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
let bankConnected = false;
let bankResponse = '';
let lastBankTest = 0;

async function pollOnce() {
  const now = Date.now();
  if (now - lastBankTest > 60000) {
    const t = await testBank();
    bankConnected = t.connected;
    bankResponse = t.body.slice(0, 250);
    lastBankTest = now;
    console.log(`[bank] ${bankConnected ? 'connected' : 'not reachable'} — ${bankResponse}`);
  }

  let jobs = [];
  try {
    const data = await callBridge({
      action: 'agentPoll',
      bridge_token: CFG.BRIDGE_TOKEN,
      agent_version: AGENT_VERSION,
      bank_provider: CFG.BANK_PROVIDER,
      bank_connected: bankConnected,
      bank_response: bankResponse,
      limit: CFG.BATCH_SIZE,
    });
    jobs = data.jobs || [];
  } catch (e) {
    console.error(`[poll] failed: ${e.message}`);
    return;
  }

  if (jobs.length === 0) return; // nothing pending

  console.log(`[poll] ${jobs.length} payment job(s) to deliver`);
  const results = [];
  for (const job of jobs) {
    const r = await callBankPayment(job);
    results.push({
      job_id: job.job_id,
      sync_status: r.ok ? 'success' : 'failed',
      bank_reference_id: r.bankReferenceId || '',
      error_message: r.ok ? '' : (r.raw || 'Unknown bank error').slice(0, 300),
    });
    console.log(`  PO ${job.po_number} -> ${job.vendor_name} ${job.amount} ${job.payment_mode}: ${r.ok ? 'OK ' + r.bankReferenceId : 'FAIL ' + r.raw}`);
  }

  try {
    await callBridge({
      action: 'agentReport',
      bridge_token: CFG.BRIDGE_TOKEN,
      agent_version: AGENT_VERSION,
      bank_provider: CFG.BANK_PROVIDER,
      bank_connected: bankConnected,
      bank_response: bankResponse,
      pending_count: jobs.length,
      results,
    });
  } catch (e) {
    console.error(`[report] failed: ${e.message}`);
  }
}

// ---------- Run ----------
console.log(`[agent] Bank Bridge Agent v${AGENT_VERSION} starting`);
console.log(`[agent] ERP bridge   : ${CFG.BRIDGE_URL}`);
console.log(`[agent] Bank provider: ${CFG.BANK_PROVIDER}`);
console.log(`[agent] Poll every   : ${CFG.POLL_INTERVAL_SEC}s, batch ${CFG.BATCH_SIZE}`);

pollOnce().catch((e) => console.error('[loop]', e.message));
setInterval(() => {
  pollOnce().catch((e) => console.error('[loop]', e.message));
}, CFG.POLL_INTERVAL_SEC * 1000);