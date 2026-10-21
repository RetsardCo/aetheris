@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo    AI Activity Visualizer - Automated Setup (Windows)
echo ======================================================

:: 1. Verify Node.js existence
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on PATH.
    echo Please install Node.js 18 or higher from https://nodejs.org/
    exit /b 1
)

:: 2. Verify Node.js version >= 18
for /f "tokens=1 delims=." %%a in ('node -e "console.log(process.versions.node.split('.')[0])"') do set NODE_MAJOR=%%a
if %NODE_MAJOR% lss 18 (
    echo [ERROR] Node.js version 18 or higher is required. Found major version %NODE_MAJOR%.
    echo Please update Node.js from https://nodejs.org/
    exit /b 1
)
echo [OK] Node.js version 18+ detected.

:: 3. Verify npm existence
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not found on PATH.
    exit /b 1
)
echo [OK] npm detected.

:: 4. Run clean dependency install
echo.
echo [1/4] Running npm install...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install failed.
    exit /b %ERRORLEVEL%
)

:: 5. Compile TypeScript
echo.
echo [2/4] Compiling TypeScript (npm run compile)...
call npm run compile
if %ERRORLEVEL% neq 0 (
    echo [ERROR] TypeScript compilation failed.
    exit /b %ERRORLEVEL%
)

:: 6. Build production bundles
echo.
echo [3/4] Building extension and webview (npm run build)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Bundle build failed.
    exit /b %ERRORLEVEL%
)

:: 7. Package VSIX extension
echo.
echo [4/4] Packaging extension (npm run package)...
call npm run package
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Packaging failed.
    exit /b %ERRORLEVEL%
)

:: 8. Optional VS Code CLI extension installation
where code >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo.
    echo [INFO] VS Code CLI 'code' detected. Installing VSIX extension...
    call code --install-extension ai-activity-visualizer-1.0.0.vsix
    if %ERRORLEVEL% equ 0 (
        echo [OK] Extension successfully installed into Visual Studio Code.
    ) else (
        echo [WARN] VS Code extension installation returned non-zero code. You can install manually.
    )
) else (
    echo.
    echo [NOTE] VS Code CLI 'code' not found on PATH.
    echo To install in VS Code manually:
    echo   code --install-extension ai-activity-visualizer-1.0.0.vsix
    echo   or use "Install from VSIX..." in the VS Code Extensions menu.
)

echo.
echo ======================================================
echo    Setup completed successfully!
echo ======================================================
echo To start the live bridge server and open the dashboard:
echo   Run: start.bat
echo   Or:  npm start
echo.
