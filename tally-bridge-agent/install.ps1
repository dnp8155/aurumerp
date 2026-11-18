# Aurum ERP - Tally Bridge Agent installer (Windows)
# Usage:  irm <published install.ps1 url> | iex
# Installs the agent into C:\tally-bridge-agent and starts it.

$ErrorActionPreference = "Stop"

# Old Windows PowerShell defaults to TLS 1.0, which modern hosts refuse.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$AgentUrl = "https://base44.app/api/apps/6ab67b6426d6d79f38b501aa/files/mp/public/6ab67b6426d6d79f38b501aa/ed09e4f5f_tally-bridge-agent.js"
$Dir = "C:\tally-bridge-agent"

Write-Host "Aurum ERP - Tally Bridge Agent setup" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

Write-Host "1/4  Downloading agent.js ..."
$agentPath = Join-Path $Dir "agent.js"
try {
  Invoke-WebRequest -Uri $AgentUrl -OutFile $agentPath -UseBasicParsing
} catch {
  Write-Host "     Invoke-WebRequest failed, trying curl.exe ..." -ForegroundColor Yellow
  & curl.exe -L --fail -o $agentPath $AgentUrl
}

Write-Host "2/4  Bridge token"
$cfgPath = Join-Path $Dir "config.json"
$token = Read-Host "Paste your TALLY_BRIDGE_TOKEN (app dashboard > Secrets)"

if ([string]::IsNullOrWhiteSpace($token)) {
  if (Test-Path $cfgPath) {
    Write-Host "     No token entered - keeping the existing config.json." -ForegroundColor Yellow
  } else {
    Write-Host "     No token entered - cannot continue." -ForegroundColor Red
    return
  }
} else {
  $json = @"
{
  "bridge_url": "https://aurumerp.base44.app/functions/tallySync",
  "bridge_token": "$($token.Trim())",
  "tally_url": "http://localhost:9000",
  "poll_interval_sec": 15,
  "batch_size": 20
}
"@
  [System.IO.File]::WriteAllText($cfgPath, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "     config.json written." -ForegroundColor Green
}

Write-Host "3/4  Checking Node.js ..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "     Node.js not found. Install the LTS version from https://nodejs.org and run this command again." -ForegroundColor Red
  return
}
Write-Host ("     node " + (node -v))

Write-Host "4/4  Starting agent - press Ctrl+C to stop." -ForegroundColor Green
Set-Location $Dir
node agent.js