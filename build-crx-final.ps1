# Final CRX build script using key from keys folder
# Usage: .\build-crx-final.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Building CRX file (Final) ===" -ForegroundColor Cyan

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
$extensionDir = (Get-Location).Path
Write-Host "Extension directory: $extensionDir" -ForegroundColor Green

# Check if private key exists
$keyPath = Join-Path $extensionDir "keys\private_key.pem"
if (-not (Test-Path $keyPath)) {
    Write-Host "ERROR: Private key not found at $keyPath" -ForegroundColor Red
    exit 1
}

Write-Host "Using private key: $keyPath" -ForegroundColor Green

# Copy key to temp location outside extension directory (Chrome requirement)
$parentDir = Split-Path $extensionDir -Parent
$tempKeyPath = Join-Path $parentDir "temp_private_key_$(Get-Random).pem"

Write-Host "Copying key to temp location: $tempKeyPath" -ForegroundColor Yellow
Copy-Item $keyPath $tempKeyPath -Force

# Temporarily move keys folder outside extension directory
$tempKeysPath = Join-Path $parentDir "temp_keys_backup_$(Get-Random)"
$keysFolder = Join-Path $extensionDir "keys"
$keysMoved = $false

if (Test-Path $keysFolder) {
    Write-Host "Temporarily moving keys folder out of extension directory..." -ForegroundColor Yellow
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
    
    # Build CRX using Chrome
    Write-Host "`nBuilding CRX file..." -ForegroundColor Cyan
    Write-Host "Extension: $extensionDir" -ForegroundColor Gray
    Write-Host "Key: $tempKeyPath" -ForegroundColor Gray
    
    # Use Start-Process to run Chrome and capture output
    $process = Start-Process -FilePath $chromePath -ArgumentList "--pack-extension=`"$extensionDir`"","--pack-extension-key=`"$tempKeyPath`"" -Wait -PassThru -NoNewWindow
    
    $buildSuccess = $process.ExitCode -eq 0
    
    # Check if CRX was created
    if (Test-Path "auto-close-tabs.crx") {
        $buildSuccess = $true
    }
    
} finally {
    # Restore keys folder
    if ($keysMoved) {
        Write-Host "Restoring keys folder..." -ForegroundColor Yellow
        if (Test-Path $keysFolder) {
            Remove-Item $keysFolder -Recurse -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $tempKeysPath) {
            Move-Item $tempKeysPath $keysFolder -Force
            Write-Host "Keys folder restored" -ForegroundColor Green
        }
    }
    
    # Remove temp key
    if (Test-Path $tempKeyPath) {
        Remove-Item $tempKeyPath -Force -ErrorAction SilentlyContinue
        Write-Host "Temp key removed" -ForegroundColor Green
    }
}

if ($buildSuccess -and (Test-Path "auto-close-tabs.crx")) {
    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host "CRX file created: auto-close-tabs.crx" -ForegroundColor Green
    
    # Check file size
    $fileInfo = Get-Item "auto-close-tabs.crx"
    $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
    Write-Host "File size: $sizeKB KB" -ForegroundColor Green
    
    Write-Host "`nDone!" -ForegroundColor Cyan
} else {
    Write-Host "`n=== ERROR ===" -ForegroundColor Red
    Write-Host "Failed to build CRX file." -ForegroundColor Red
    Write-Host "`nAlternative: Use Chrome UI method:" -ForegroundColor Yellow
    Write-Host "1. Open chrome://extensions/" -ForegroundColor White
    Write-Host "2. Enable Developer mode" -ForegroundColor White
    Write-Host "3. Click 'Pack extension'" -ForegroundColor White
    Write-Host "4. Extension: $extensionDir" -ForegroundColor White
    Write-Host "5. Key: $keyPath" -ForegroundColor White
    exit 1
}



