$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $root
Set-Location $root

$archiveRoot = Join-Path $root "data\archive"
$sourceRoot = Join-Path $root "data\source-files"
$folders = @(
  $sourceRoot,
  (Join-Path $archiveRoot "raw"),
  (Join-Path $archiveRoot "meta")
)

foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$exePath = Join-Path $root "src-tauri\target\debug\content-summary-analyzer.exe"
if (Test-Path $exePath) {
  Start-Process -FilePath $exePath
  exit 0
}

Write-Host "Executable not found."
Write-Host "Run: npm run tauri:build"
exit 1
