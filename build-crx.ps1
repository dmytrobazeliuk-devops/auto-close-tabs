# PowerShell script to build CRX file for Chrome extension
# Usage: .\build-crx.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Building CRX file ===" -ForegroundColor Cyan

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
    Write-Host "ERROR: Chrome not found. Please install Chrome or specify path manually." -ForegroundColor Red
    exit 1
}

Write-Host "Found Chrome at: $chromePath" -ForegroundColor Green

# Get current directory
$extensionDir = Get-Location
Write-Host "Extension directory: $extensionDir" -ForegroundColor Green

# Check if private key exists (use absolute path)
$keyPath = Join-Path $extensionDir "keys\private_key.pem"
if (-not (Test-Path $keyPath)) {
    Write-Host "ERROR: Private key not found at $keyPath" -ForegroundColor Red
    exit 1
}

Write-Host "Using private key: $keyPath" -ForegroundColor Green

# Copy key to temp location outside extension directory
$parentDir = Split-Path $extensionDir -Parent
$tempKeyPath = Join-Path $parentDir "temp_private_key.pem"
$keysFolder = Join-Path $extensionDir "keys"
$keyCopied = $false

if (Test-Path $keyPath) {
    Write-Host "Copying private key to temp location..." -ForegroundColor Yellow
    Copy-Item $keyPath $tempKeyPath -Force
    $keyCopied = $true
    Write-Host "Key copied to: $tempKeyPath" -ForegroundColor Green
}

# Temporarily move keys folder outside extension directory
$tempKeysPath = Join-Path $extensionDir "..\temp_keys_backup"
$keysMoved = $false

if (Test-Path $keysFolder) {
    Write-Host "Temporarily moving keys folder out of extension directory..." -ForegroundColor Yellow
    if (Test-Path $tempKeysPath) {
        Remove-Item $tempKeysPath -Recurse -Force
    }
    Move-Item $keysFolder $tempKeysPath -Force
    $keysMoved = $true
    Write-Host "Keys folder moved temporarily" -ForegroundColor Green
}

$buildSuccess = $false

try {
    # Remove old CRX if exists
    if (Test-Path "auto-close-tabs.crx") {
        Remove-Item "auto-close-tabs.crx" -Force
        Write-Host "Removed old CRX file" -ForegroundColor Yellow
    }

    # Verify temp key exists
    if (-not (Test-Path $tempKeyPath)) {
        Write-Host "ERROR: Temp key file not found at $tempKeyPath" -ForegroundColor Red
        exit 1
    }
    
    # Build CRX using Chrome with temp key path
    Write-Host "`nBuilding CRX file..." -ForegroundColor Cyan
    $resolvedKeyPath = (Resolve-Path $tempKeyPath).Path
    Write-Host "Using key path: $resolvedKeyPath" -ForegroundColor Gray
    Write-Host "Key file exists: $(Test-Path $resolvedKeyPath)" -ForegroundColor Gray
    
    # Use forward slashes for Chrome
    $chromeKeyPath = $resolvedKeyPath -replace '\\', '/'
    & $chromePath --pack-extension="$extensionDir" --pack-extension-key="$chromeKeyPath"
    
    $buildSuccess = $LASTEXITCODE -eq 0
} finally {
    # Restore keys folder
    if ($keysMoved) {
        Write-Host "Restoring keys folder..." -ForegroundColor Yellow
        if (Test-Path $keysFolder) {
            Remove-Item $keysFolder -Recurse -Force
        }
        Move-Item $tempKeysPath $keysFolder -Force
        Write-Host "Keys folder restored" -ForegroundColor Green
    }
    
    # Remove temp key
    if ($keyCopied -and (Test-Path $tempKeyPath)) {
        Remove-Item $tempKeyPath -Force
        Write-Host "Temp key removed" -ForegroundColor Green
    }
}

if ($buildSuccess) {
    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host "CRX file created: auto-close-tabs.crx" -ForegroundColor Green
    
    # Check file size
    $fileInfo = Get-Item "auto-close-tabs.crx" -ErrorAction SilentlyContinue
    if ($fileInfo) {
        $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
        Write-Host "File size: $sizeKB KB" -ForegroundColor Green
    }
    
    Write-Host "`nDone!" -ForegroundColor Cyan
} else {
    Write-Host "`n=== ERROR ===" -ForegroundColor Red
    Write-Host "Failed to build CRX file. Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
