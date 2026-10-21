# Launch script for AI Activity Visualizer (PowerShell)
# Run with: powershell -ExecutionPolicy Bypass -File start.ps1

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Starting AI Activity Visualizer Live Bridge Server" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

Write-Host "Opening dashboard at http://127.0.0.1:5175/ in default browser..." -ForegroundColor Green
Start-Process "http://127.0.0.1:5175/"
node live_bridge_server.mjs
