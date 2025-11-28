# Manual CRX build script - creates CRX from ZIP using Chrome
# Usage: .\build-crx-manual.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Building CRX file (manual method) ===" -ForegroundColor Cyan

# First create ZIP
Write-Host "Step 1: Creating ZIP archive..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File "build-zip.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create ZIP archive" -ForegroundColor Red
    exit 1
}

# Check if Chrome is installed
$chromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chromePath = $null
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $chromePath = $path
        break
    }
}

if (-not $chromePath) {
    Write-Host "ERROR: Chrome not found" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 2: Instructions for manual CRX creation:" -ForegroundColor Yellow
Write-Host "1. Open Chrome and go to chrome://extensions/" -ForegroundColor White
Write-Host "2. Enable 'Developer mode' (toggle in top right)" -ForegroundColor White
Write-Host "3. Click 'Load unpacked' and select this directory" -ForegroundColor White
Write-Host "4. Or use the ZIP file: auto-close-tabs.zip" -ForegroundColor White
Write-Host "`nFor CRX creation, you can also use online tools or Chrome Web Store Developer Dashboard" -ForegroundColor Gray

Write-Host "`n=== ZIP Archive Ready ===" -ForegroundColor Green
Write-Host "File: auto-close-tabs.zip" -ForegroundColor Green
$zipInfo = Get-Item "auto-close-tabs.zip" -ErrorAction SilentlyContinue
if ($zipInfo) {
    $sizeKB = [math]::Round($zipInfo.Length / 1KB, 2)
    Write-Host "Size: $sizeKB KB" -ForegroundColor Green
}



