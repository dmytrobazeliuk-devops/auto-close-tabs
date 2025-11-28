# PowerShell script to build ZIP archive for Chrome extension
# Usage: .\build-zip.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Building ZIP archive ===" -ForegroundColor Cyan

# Get current directory
$extensionDir = Get-Location
Write-Host "Extension directory: $extensionDir" -ForegroundColor Green

# Files to include
$filesToInclude = @(
    "manifest.json",
    "background.js",
    "popup.html",
    "popup.js",
    "stats.html",
    "stats.js",
    "icons\*.png"
)

# Remove old ZIP if exists
$zipPath = "auto-close-tabs.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
    Write-Host "Removed old ZIP file" -ForegroundColor Yellow
}

# Create temp directory for packaging
$tempDir = Join-Path $env:TEMP "auto-close-tabs-build-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-Host "Created temp directory: $tempDir" -ForegroundColor Gray

try {
    # Copy manifest
    Copy-Item "manifest.json" $tempDir -Force
    Write-Host "Copied manifest.json" -ForegroundColor Gray
    
    # Copy JS files
    Copy-Item "background.js" $tempDir -Force
    Copy-Item "popup.js" $tempDir -Force
    Copy-Item "stats.js" $tempDir -Force
    Write-Host "Copied JS files" -ForegroundColor Gray
    
    # Copy HTML files
    Copy-Item "popup.html" $tempDir -Force
    Copy-Item "stats.html" $tempDir -Force
    Write-Host "Copied HTML files" -ForegroundColor Gray
    
    # Copy icons directory
    $iconsDest = Join-Path $tempDir "icons"
    New-Item -ItemType Directory -Path $iconsDest -Force | Out-Null
    Copy-Item "icons\*.png" $iconsDest -Force
    Write-Host "Copied icons" -ForegroundColor Gray
    
    # Create ZIP archive
    Write-Host "`nCreating ZIP archive..." -ForegroundColor Cyan
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
    
    # Check file size
    $fileInfo = Get-Item $zipPath
    $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
    
    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host "ZIP file created: $zipPath" -ForegroundColor Green
    Write-Host "File size: $sizeKB KB" -ForegroundColor Green
    Write-Host "`nDone!" -ForegroundColor Cyan
    
} finally {
    # Cleanup temp directory
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
        Write-Host "Cleaned up temp directory" -ForegroundColor Gray
    }
}



