# Pack CRX with key
# Usage: .\pack-crx.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Packing CRX with key ===" -ForegroundColor Cyan

# Get paths
$extensionDir = (Get-Location).Path
$keyPath = Join-Path $extensionDir "keys\private_key.pem"
$parentDir = Split-Path $extensionDir -Parent

# Check key exists
if (-not (Test-Path $keyPath)) {
    Write-Host "ERROR: Key not found at $keyPath" -ForegroundColor Red
    exit 1
}

Write-Host "Extension: $extensionDir" -ForegroundColor Green
Write-Host "Key: $keyPath" -ForegroundColor Green

# Step 1: Copy key outside extension folder
$tempKeyPath = Join-Path $parentDir "temp_key_$(Get-Date -Format 'yyyyMMddHHmmss').pem"
Write-Host "`nStep 1: Copying key outside extension folder..." -ForegroundColor Yellow
Copy-Item $keyPath $tempKeyPath -Force
Write-Host "Key copied to: $tempKeyPath" -ForegroundColor Gray

# Step 2: Move keys folder temporarily
$keysFolder = Join-Path $extensionDir "keys"
$tempKeysFolder = Join-Path $parentDir "temp_keys_$(Get-Date -Format 'yyyyMMddHHmmss')"
$keysMoved = $false

if (Test-Path $keysFolder) {
    Write-Host "`nStep 2: Moving keys folder temporarily..." -ForegroundColor Yellow
    Move-Item $keysFolder $tempKeysFolder -Force
    $keysMoved = $true
    Write-Host "Keys folder moved to: $tempKeysFolder" -ForegroundColor Gray
}

try {
    # Step 3: Remove old CRX
    $crxPath = Join-Path $extensionDir "auto-close-tabs.crx"
    if (Test-Path $crxPath) {
        Remove-Item $crxPath -Force
        Write-Host "`nStep 3: Removed old CRX file" -ForegroundColor Yellow
    }

    # Step 4: Pack extension using Chrome
    Write-Host "`nStep 4: Packing extension with Chrome..." -ForegroundColor Cyan
    
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
        throw "Chrome not found"
    }
    
    Write-Host "Using Chrome: $chromePath" -ForegroundColor Gray
    Write-Host "Extension dir: $extensionDir" -ForegroundColor Gray
    Write-Host "Key file: $tempKeyPath" -ForegroundColor Gray
    
    # Run Chrome to pack extension
    $process = Start-Process -FilePath $chromePath `
        -ArgumentList "--pack-extension=`"$extensionDir`"","--pack-extension-key=`"$tempKeyPath`"" `
        -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\chrome-pack-output.txt" `
        -RedirectStandardError "$env:TEMP\chrome-pack-error.txt"
    
    # Check if CRX was created
    Start-Sleep -Seconds 2
    
    if (Test-Path $crxPath) {
        $fileInfo = Get-Item $crxPath
        $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
        
        Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
        Write-Host "CRX file created: $crxPath" -ForegroundColor Green
        Write-Host "File size: $sizeKB KB" -ForegroundColor Green
        Write-Host "`nDone!" -ForegroundColor Cyan
    } else {
        Write-Host "`n=== WARNING ===" -ForegroundColor Yellow
        Write-Host "CRX file not found. Chrome may have created it in a different location." -ForegroundColor Yellow
        Write-Host "`nChecking for CRX files in parent directory..." -ForegroundColor Yellow
        
        $crxFiles = Get-ChildItem -Path $parentDir -Filter "*.crx" -ErrorAction SilentlyContinue
        if ($crxFiles) {
            Write-Host "Found CRX files:" -ForegroundColor Green
            foreach ($file in $crxFiles) {
                Write-Host "  - $($file.FullName)" -ForegroundColor Gray
            }
        }
        
        # Show Chrome output if available
        if (Test-Path "$env:TEMP\chrome-pack-error.txt") {
            $errorOutput = Get-Content "$env:TEMP\chrome-pack-error.txt" -ErrorAction SilentlyContinue
            if ($errorOutput) {
                Write-Host "`nChrome output:" -ForegroundColor Yellow
                $errorOutput | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
            }
        }
    }
    
} finally {
    # Step 5: Restore keys folder
    if ($keysMoved) {
        Write-Host "`nStep 5: Restoring keys folder..." -ForegroundColor Yellow
        if (Test-Path $keysFolder) {
            Remove-Item $keysFolder -Recurse -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $tempKeysFolder) {
            Move-Item $tempKeysFolder $keysFolder -Force
            Write-Host "Keys folder restored" -ForegroundColor Green
        }
    }
    
    # Remove temp key
    if (Test-Path $tempKeyPath) {
        Remove-Item $tempKeyPath -Force -ErrorAction SilentlyContinue
        Write-Host "Temp key removed" -ForegroundColor Green
    }
    
    # Cleanup temp files
    Remove-Item "$env:TEMP\chrome-pack-output.txt" -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\chrome-pack-error.txt" -ErrorAction SilentlyContinue
}



