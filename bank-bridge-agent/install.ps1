# Bank Bridge Agent installer — Aurum ERP
# Run on the whitelisted Windows PC. Creates the agent folder, copies the agent
# files (you must place agent.js / config / package.json here first), creates
# config.json from the example, and registers a Windows Scheduled Task to keep
# it running on logon.
#
# Usage:
#   1. Download agent.js, config.json.example, package.json into a folder.
#   2. In that folder, open PowerShell as admin and run:  .\install.ps1

$ErrorActionPreference = 'Stop'

$AgentDir = Join-Path $env:USERPROFILE 'bank-bridge-agent'
Write-Host "Installing Bank Bridge Agent to: $AgentDir"

if (-not (Test-Path $AgentDir)) { New-Item -ItemType Directory -Path $AgentDir | Out-Null }

# Copy the agent files shipped alongside this installer (if present).
foreach ($f in @('agent.js','config.json.example','package.json','README.md')) {
  $src = Join-Path $PSScriptRoot $f
  if (Test-Path $src) { Copy-Item $src $AgentDir -Force }
}

# Create config.json from the example if the user hasn't created one.
$cfg = Join-Path $AgentDir 'config.json'
if (-not (Test-Path $cfg)) {
  Copy-Item (Join-Path $AgentDir 'config.json.example') $cfg -Force
  Write-Host ""
  Write-Host "Created config.json. EDIT it now and fill in:" -ForegroundColor Yellow
  Write-Host "  - bridge_token        (same as BANK_BRIDGE_TOKEN in app Secrets)"
  Write-Host "  - icici_client_id / icici_client_secret / icici_api_key"
  Write-Host ""
}

# Verify Node.js 18+.
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) {
  Write-Host "Node.js not found. Install Node.js 18+ from https://nodejs.org then re-run." -ForegroundColor Red
  exit 1
}

# Register a Scheduled Task that starts the agent on logon.
$taskName = 'BankBridgeAgent'
$action = New-ScheduledTaskAction -Execute 'node' -Argument 'agent.js' -WorkingDirectory $AgentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host ""
Write-Host "Done. The agent will start on logon." -ForegroundColor Green
Write-Host "To start it now:  Start-ScheduledTask -TaskName $taskName"
Write-Host "To view logs:     Get-Content (Join-Path $AgentDir 'agent.log')"
Write-Host ""
Write-Host "Next: fill callBankPayment() in agent.js with the real ICICI CIB API calls"
Write-Host "      from your Integration Kit, then start the task." -ForegroundColor Cyan