# Tally Bridge Agent

A tiny Node.js script that runs **on your Windows server next to TallyPrime**.
It automatically pulls pending Tally sync jobs from the Aurum ERP cloud, posts
each one to your local TallyPrime HTTP endpoint (`http://localhost:9000`), and
reports the result back. No manual steps — install once and leave it running.

> The cloud ERP cannot reach `localhost:9000` on your server directly. This agent
> bridges that gap by polling the ERP, so your local Tally never needs to be
> exposed to the internet.

## Prerequisites

- **Node.js 18+** installed on the Windows server (`node -v`).
- **TallyPrime** running on the same machine with the **HTTP port enabled**
  (Gateway of Tally → Settings → Connectivity → `TallyPrime as Server` ON,
  port `9000`). Verify with a browser on the server:
  `http://localhost:9000` should respond.

## Setup

1. **Copy this folder** (`tally-bridge-agent/`) onto the Windows server, e.g. `C:\tally-bridge-agent\`.

2. **Set the bridge token** in the app dashboard:
   - Go to your app dashboard → **Secrets**.
   - Add a secret named `TALLY_BRIDGE_TOKEN` with a long random string
     (e.g. 32+ characters). Save it.

3. **Configure the agent** — copy `config.json.example` to `config.json` and edit:
   ```jsonc
   {
     "bridge_url": "https://aurumerp.base44.app/functions/tallySync",
     "bridge_token": "PASTE_THE_SAME_TOKEN_AS_IN_DASHBOARD",
     "tally_url": "http://localhost:9000",
     "poll_interval_sec": 15,
     "batch_size": 20
   }
   ```
   The `bridge_token` must match the `TALLY_BRIDGE_TOKEN` secret exactly.

4. **Test it manually**:
   ```bat
   cd C:\tally-bridge-agent
   node agent.js
   ```
   You should see:
   ```
   [agent] Tally Bridge Agent v1.0.0 starting
   [agent] ERP bridge : https://aurumerp.base44.app/functions/tallySync
   [agent] Tally URL  : http://localhost:9000
   [tally] connected (HTTP 200)
   [poll] N job(s) to deliver
   ```
   Press `Ctrl+C` to stop once confirmed.

## Run it permanently (as a Windows Service)

Use **NSSM** (Non-Sucking Service Manager) so the agent auto-starts and restarts
on crashes / reboots:

1. Download NSSM: https://nssm.cc/download and place `nssm.exe` somewhere in `PATH`.
2. Install the service (run as Administrator):
   ```bat
   nssm install TallyBridgeAgent "C:\Program Files\nodejs\node.exe" "C:\tally-bridge-agent\agent.js"
   nssm set TallyBridgeAgent AppDirectory "C:\tally-bridge-agent"
   nssm set TallyBridgeAgent AppStdout "C:\tally-bridge-agent\agent.log"
   nssm set TallyBridgeAgent AppStderr "C:\tally-bridge-agent\agent.log"
   nssm set TallyBridgeAgent Start SERVICE_AUTO_START
   nssm start TallyBridgeAgent
   ```
3. Check the log: `type C:\tally-bridge-agent\agent.log`

To manage it later:
```bat
nssm stop TallyBridgeAgent
nssm restart TallyBridgeAgent
nssm remove TallyBridgeAgent confirm
```

### Alternative: PM2
```bat
npm install -g pm2
pm2 start agent.js --name tally-bridge
pm2 save
pm2 startup
```

## How it works

1. ERP writes a sale/purchase/etc. → a **pending** TallySyncLog (with the Tally
   XML envelope) is created in the cloud.
2. This agent polls the ERP every `poll_interval_sec` seconds for pending jobs.
3. Each job's XML is POSTed to your local TallyPrime (`tally_url`).
4. The result (success/fail + Tally reference) is reported back; the ERP updates
   the log and marks the source record as synced.

Re-delivery is safe — TallyPrime dedupes by voucher number, so a job posted
twice updates the same voucher rather than creating a duplicate.

## Troubleshooting

- **`[tally] connected`, but `0 company(ies)`** — no company is open in
  TallyPrime. Open the company (Gateway of Tally → F3: Company) and the agent
  picks it up on its next check (within a minute). The console line
  `[tally] no company detected — …` states what Tally replied.
- **`[tally] unreachable`** — TallyPrime HTTP server is off. Enable
  "TallyPrime as Server" in Tally connectivity settings and confirm
  `http://localhost:9000` responds in a browser on the server.
- **`[poll] failed: Invalid bridge token`** — the `bridge_token` in
  `config.json` does not match the `TALLY_BRIDGE_TOKEN` secret in the dashboard.
- **`[poll] failed: fetch failed`** — the server has no internet access, or the
  `bridge_url` is wrong.
- In the ERP, open **Tally Auto Sync** → the connection card shows the agent's
  last-seen time and Tally reachability.