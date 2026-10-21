@echo off
setlocal
echo ======================================================
echo    Starting AI Activity Visualizer Live Bridge Server
echo ======================================================
echo Opening dashboard at http://127.0.0.1:5175/ in default browser...
start "" "http://127.0.0.1:5175/"
node live_bridge_server.mjs
