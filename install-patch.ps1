[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$FrontendRoot = Join-Path $ProjectRoot 'frontend'
if (-not (Test-Path -LiteralPath (Join-Path $FrontendRoot 'package.json'))) {
  throw "Could not find frontend/package.json under '$ProjectRoot'. Run this script from the repository root or pass -ProjectRoot."
}

$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FilesRoot = Join-Path $PatchRoot 'frontend'
$RelativeFiles = @(
  'src/app/api/medical-records/upload/route.ts',
  'src/components/dashboard/notification-panel.tsx'
)
$Missing = @($RelativeFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $FilesRoot $_) -PathType Leaf) })
if ($Missing.Count -gt 0) { throw "Patch is incomplete. Missing: $($Missing -join ', ')" }

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ProjectRoot ".family-care-hub-backup-$Stamp"
New-Item -ItemType Directory -Path $BackupRoot | Out-Null

foreach ($Relative in $RelativeFiles) {
  $Destination = Join-Path $FrontendRoot $Relative
  $Source = Join-Path $FilesRoot $Relative
  $DestinationDirectory = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null

  if (Test-Path -LiteralPath $Destination -PathType Leaf) {
    $BackupPath = Join-Path $BackupRoot $Relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $BackupPath) | Out-Null
    Copy-Item -LiteralPath $Destination -Destination $BackupPath
  }
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
  Write-Host "Updated: frontend/$Relative" -ForegroundColor Green
}

Write-Host "`nPatch applied. Existing versions (where present) were backed up to: $BackupRoot" -ForegroundColor Cyan
Write-Host 'No environment files, package files, migrations, or unrelated source files were changed.'
Write-Host "Next run from '$FrontendRoot': npx tsc --noEmit -p .; npm run lint; npm run build"
