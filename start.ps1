# Launch script for Aetheris (PowerShell)
# Run with: powershell -ExecutionPolicy Bypass -File start.ps1

Set-Location -LiteralPath $PSScriptRoot

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Starting Aetheris Live Bridge Server" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

Write-Host "Launching live bridge server and opening dashboard in default browser..." -ForegroundColor Green
node live_bridge_server.mjs --open
