# Bank Bridge Agent — Aurum ERP ↔ Corporate Bank API

Delivers Aurum ERP vendor payouts to your corporate bank's fund-transfer API
(ICICI CIB / HDFC / Kotak) from a Windows PC whose public IP is whitelisted in
the bank's developer portal.

## Why this exists

ICICI, HDFC and Kotak corporate APIs reject calls from any server whose IP
isn't whitelisted. Aurum ERP runs on Base44 cloud — an IP you don't control and
the bank won't whitelist. So the cloud can't call the bank directly. This agent
runs on **your** whitelisted PC and bridges ERP → bank, exactly like the
Tally Bridge Agent bridges ERP → TallyPrime.

```
ERP (cloud)  ──pending job──►  Bank Bridge Agent (your PC, whitelisted)  ──►  Bank API
ERP (cloud)  ◄──result report──  Bank Bridge Agent  ◄──response──  Bank API
```

## Setup

1. **Whitelist your PC's public IP** in the bank's developer portal (ICICI: ask
   your relationship manager for the "API Banking" IP-whitelist form). Use a
   static public IP or a business broadband line with fixed IP.

2. **Install Node.js 18+** on that PC (https://nodejs.org).

3. **Generate a bridge token** — any long random string (e.g. `node -e
   "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - Put the **same** value in the app dashboard → **Secrets** as
     `BANK_BRIDGE_TOKEN`.
   - Put it in `config.json` below as `bridge_token`.

4. **Copy `config.json.example` → `config.json`** and fill in:
   - `bridge_token` (from step 3)
   - `icici_client_id`, `icici_client_secret`, `icici_api_key` (from ICICI's API
     Banking onboarding)

5. **Fill `callBankPayment()` in `agent.js`** with the real ICICI CIB API calls
   from the Integration Kit SDK you download after onboarding. The function is
   clearly marked with `TODO` comments. Until you do this, the agent runs but
   every payment reports "bank API not configured".

6. **Run it:**
   ```powershell
   node agent.js
   ```

7. **Keep it running** — run it in a terminal that stays open, or set up a
   Windows scheduled task / NSSM service to auto-start on boot.

## How it works

Every 20s the agent polls the ERP bridge for pending `BankPaymentJob` records
(routed by `bank_provider`). For each job it calls the bank's fund-transfer API,
then reports success (with the bank UTR/RRN) or failure back to the ERP. The
ERP then updates the Purchase Order's `payment_status` to `paid` and writes a
`BankTransaction` ledger entry automatically.

Failed payments auto-retry up to 5 times with backoff; after that they're marked
`failed` and the PO reverts to `unpaid` so it shows back up in the due list.
Retry manually from the Vendor Payouts page.

## Security

- The bridge token authenticates the agent to the ERP bridge — never commit
  `config.json` to git.
- Bank credentials stay on your PC; the ERP cloud never sees them.
- The agent only ever reads pending jobs and reports results — it cannot modify
  other ERP data.