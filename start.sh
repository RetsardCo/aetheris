#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "======================================================"
echo "   Starting AI Activity Visualizer Live Bridge Server"
echo "======================================================"
echo "Launching live bridge server and opening dashboard in default browser..."

node live_bridge_server.mjs --open
