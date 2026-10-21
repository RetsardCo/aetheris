#!/usr/bin/env bash
set -e

echo "======================================================"
echo "   Starting AI Activity Visualizer Live Bridge Server"
echo "======================================================"

URL="http://127.0.0.1:5175/"
echo "Opening dashboard at $URL in default browser..."

if command -v open >/dev/null 2>&1; then
    open "$URL" &
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" &
fi

node live_bridge_server.mjs
