# Celeste Tracker Startup Script
Write-Host ""
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "   Celeste Archipelago Tracker" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""

# Change to the script directory
Set-Location $PSScriptRoot

# Start the development server
npm run dev

# Keep window open if there's an error
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
