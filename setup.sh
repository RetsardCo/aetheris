#!/usr/bin/env bash
set -e

echo "======================================================"
echo "   AI Activity Visualizer - Automated Setup (UNIX)"
echo "======================================================"

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not found on PATH."
    echo "Please install Node.js 18 or higher from https://nodejs.org/"
    exit 1
fi

# 2. Check Node.js version >= 18
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "[ERROR] Node.js version 18 or higher is required. Found v$NODE_MAJOR."
    echo "Please update Node.js from https://nodejs.org/"
    exit 1
fi
echo "[OK] Node.js version 18+ detected (v$NODE_MAJOR)."

# 3. Check npm
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] npm is not found on PATH."
    exit 1
fi
echo "[OK] npm detected."

# 4. Install dependencies
echo ""
echo "[1/4] Running npm install..."
npm install

# 5. Compile TypeScript
echo ""
echo "[2/4] Compiling TypeScript (npm run compile)..."
npm run compile

# 6. Build bundles
echo ""
echo "[3/4] Building extension and webview (npm run build)..."
npm run build

# 7. Package VSIX
echo ""
echo "[4/4] Packaging extension (npm run package)..."
npm run package

# 8. Check VS Code CLI
if command -v code >/dev/null 2>&1; then
    echo ""
    echo "[INFO] VS Code CLI (code) detected. Installing VSIX extension..."
    code --install-extension ai-activity-visualizer-1.0.0.vsix || true
    echo "[OK] Extension installed into Visual Studio Code."
else
    echo ""
    echo "[NOTE] VS Code CLI (code) not found on PATH."
    echo "To install in VS Code manually:"
    echo "  code --install-extension ai-activity-visualizer-1.0.0.vsix"
    echo "  or use 'Install from VSIX...' in the VS Code Extensions menu."
fi

echo ""
echo "======================================================"
echo "   Setup completed successfully!"
echo "======================================================"
echo "To start the live bridge server and open the dashboard:"
echo "  Run: ./start.sh"
echo "  Or:  npm start"
echo ""
