# Troubleshooting & Diagnostic Guide

## 1. Webview Appears Blank or Disconnected
- **Check Developer Tools**: In VS Code, run `Developer: Toggle Developer Tools` from the Command Palette.
- **Content Security Policy**: Check the console for CSP violation errors. Ensure all assets are loaded via the registered `webview.cspSource` or nonce.
- **Port Conflict**: If port 5174 is in use, the extension automatically binds to an open random port. Check `Aetheris: Show Diagnostics & Logs` to view the active port.

## 2. Agent Events Not Appearing
- **Copilot**: Verify that the GitHub Copilot extension is enabled and active. If using JSONL streaming, verify the file path exists and is readable.
- **Antigravity**: Ensure the hook forwarding script points to `127.0.0.1:5174/api/events` with valid headers.
- **Status Check**: Open the Activity Bar "Aetheris" view to verify that the server status indicates `Aetheris: Running`.

## 3. Database Locking or SQLite Errors
- The database is backed by `sql.js` WebAssembly and avoids native node-gyp build issues.
- The storage file is saved to VS Code's global storage directory (`activity_store.db`).
- In the event of file corruption, delete the `.storage/activity_store.db` file or run `Aetheris: Clear Current Session`.
