# Automated Setup script for Aetheris (PowerShell)
# Run with: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Aetheris - Automated Setup (PowerShell)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Verify Node.js existence
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "[ERROR] Node.js is not found on PATH. Please install Node.js 18 or higher from https://nodejs.org/"
    exit 1
}

# 2. Check Node.js version >= 18
$nodeMajor = [int](node -e "console.log(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 18) {
    Write-Error "[ERROR] Node.js version 18 or higher is required. Found major version $nodeMajor."
    exit 1
}
Write-Host "[OK] Node.js version 18+ detected (v$nodeMajor)." -ForegroundColor Green

# 3. Check npm existence
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue) -and -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "[ERROR] npm is not found on PATH."
    exit 1
}
Write-Host "[OK] npm detected." -ForegroundColor Green

$npmExe = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }

# 4. Install dependencies
Write-Host "`n[1/4] Running npm install..." -ForegroundColor Yellow
& $npmExe install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 5. Compile TypeScript
Write-Host "`n[2/4] Compiling TypeScript (npm run compile)..." -ForegroundColor Yellow
& $npmExe run compile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 6. Build production bundles
Write-Host "`n[3/4] Building extension and webview (npm run build)..." -ForegroundColor Yellow
& $npmExe run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 7. Package VSIX extension
Write-Host "`n[4/4] Packaging extension (npm run package)..." -ForegroundColor Yellow
& $npmExe run package
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 8. Check VS Code CLI
$codeCmd = Get-Command code -ErrorAction SilentlyContinue
if ($codeCmd) {
    Write-Host "`n[INFO] VS Code CLI (code) detected. Installing VSIX extension..." -ForegroundColor Cyan
    & code --install-extension ai-activity-visualizer-1.0.0.vsix
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Extension successfully installed into Visual Studio Code." -ForegroundColor Green
    }
} else {
    Write-Host "`n[NOTE] VS Code CLI (code) not found on PATH." -ForegroundColor Gray
    Write-Host "To install in VS Code manually:" -ForegroundColor Gray
    Write-Host "  code --install-extension ai-activity-visualizer-1.0.0.vsix" -ForegroundColor Gray
    Write-Host "  or use 'Install from VSIX...' in the VS Code Extensions menu." -ForegroundColor Gray
}

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "   Setup completed successfully!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "To start the live bridge server and open the dashboard:"
Write-Host "  Run: .\start.ps1"
Write-Host "  Or:  npm start`n"
