# Privacy & Security Specification

Privacy is a fundamental release requirement for **Aetheris**.

## 1. Local-Only Storage
- All session records, activity events, and dependency graphs are stored locally on the user's machine in an embedded SQLite file (`activity_store.db`).
- **No Cloud Services**: The extension makes zero network calls to external telemetry, analytics, or third-party cloud servers.
- **Loopback Ingestion Only**: The optional HTTP event receiver binds strictly to `127.0.0.1` and requires a per-session random bearer token. It rejects external network interfaces.

## 2. Data Minimization & Secret Redaction
- **No Automatic File Content Capture**: The extension does not record full file contents or user source code by default. Only small, bounded preview snippets (under 300 characters) are captured for editor change diffs.
- **Pattern-Based Secret Redaction**: Before storing or transmitting events to the webview, all strings pass through regex filters for:
  - OpenAI API keys (`sk-...`)
  - Google Gemini / API keys (`AIza...`)
  - GitHub Personal Access Tokens (`ghp_...`, `gho_...`)
  - AWS Access Keys (`AKIA...`, `ASIA...`)
  - Bearer authentication headers
  - Passwords embedded in URLs
  - Private key blocks (`BEGIN RSA PRIVATE KEY`)
- **Disclaimer**: Pattern-based redaction reduces the risk of accidental credential leakage, but cannot guarantee detection of every custom secret format. Users should maintain sensible `.gitignore` exclusions.

## 3. Configurable Exclusions & Retention
- **Excluded Patterns**: The extension excludes secret-bearing files (`.env*`, `*.pem`, `*.key`, `id_rsa*`) and vendor folders (`node_modules`, `.git`, `dist`, `build`) from workspace monitoring and dependency graphs.
- **Bounded Retention**: Stored sessions are automatically pruned after the configured retention period (default 30 days) to prevent disk bloating.
- **User Deletion**: Users can delete any individual session or clear current recording events at any time via the UI or Command Palette.
