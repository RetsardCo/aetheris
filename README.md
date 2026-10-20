# AI Activity Visualizer (Agent Brain) for VS Code

[![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Code-AI%20Activity%20Visualizer-blue.svg)](https://marketplace.visualstudio.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-Passing-emerald.svg)](#building--testing)

> **"Your repo, thinking out loud."**  
> Real-time developer observability tool for tracking, normalising, storing, and visualizing AI coding agent activity (GitHub Copilot, Google Antigravity, VS Code workspace edits) as an interactive glowing constellation map.

---

## 🌟 Key Features

1. **Agent Brain Constellation Graph**
   - High-performance 60fps Canvas 2D engine.
   - Central 3D rotating diamond/octahedron wireframe core with horizontal scanline.
   - Glowing file and folder nodes with activity pulse rings (Cyan for reads, Amber for writes, Green for creations, Red for deletions).
   - Real dependency edges derived from static import parsing (JavaScript, TypeScript, Python, etc.)—**never fabricated**.
   - Swooping orbital comet particles and background cosmic dust.
   - Smooth pan, zoom, click navigation, search highlighting, and "Only what needs attention" filter.

2. **Floating Agent Trace & Code Panels**
   - Floating dark cards with macOS-style `● ● ●` window controls and syntax-highlighted snippets.
   - Real-time floating bottom terminal log tracking agent actions (`cd`, `open`, `Read`, `Follow`, `hop`).
   - Direct click-to-open integration with the VS Code editor.

3. **4-in-1 Comprehensive Dashboard**
   - **Interactive Graph**: The primary constellation view.
   - **Live Overview**: Event volume, touched files, provider distributions, and integration health.
   - **Chronological Timeline**: Searchable, filterable event stream with expandable sanitized metadata and code snippets.
   - **Persistent Session Replay**: Playback recorded agent activity at variable speeds (0.5x, 1x, 2x, 5x) with scrubber and export capabilities.

4. **Multi-Agent Adapters**
   - **VS Code Workspace Adapter**: Captures document changes, file creates, deletes, renames, and editor focus with `observed` evidence attribution.
   - **GitHub Copilot Telemetry Adapter**: Ingests tool calls (`read_file`, `grep_search`, `run_in_terminal`, `edit_file`) with `explicit` agent attribution.
   - **Google Antigravity Hook Adapter**: Ingests lifecycle events (`PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`).
   - **Generic Loopback HTTP Ingester**: Secure `127.0.0.1:5174` listener with cryptographically generated per-session bearer tokens.

5. **Robust Local-First Persistence & Privacy**
   - Embedded SQLite engine via WebAssembly (`sql.js`), zero native compilation dependencies.
   - Automated secret-pattern redaction for OpenAI, Google, GitHub, AWS, and generic tokens.
   - Configurable retention policy (default 30 days) and automated pruning.
   - Zero external telemetry or cloud dependencies.

---

## 🚀 Quick Start

### Installation

1. Install the `.vsix` package:
   ```bash
   code --install-extension ai-activity-visualizer-1.0.0.vsix
   ```
2. Or open the project in VS Code and press `F5` to launch an Extension Development Host.

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type:
- `Agent Brain: Open Activity Dashboard` — Launches the main visualizer.
- `Agent Brain: Start Recording` — Resumes event collection.
- `Agent Brain: Stop Recording` — Pauses event collection.
- `Agent Brain: Clear Current Session` — Clears events for the active session.
- `Agent Brain: Export Current Session` — Exports session events as sanitized JSON.
- `Agent Brain: Show Diagnostics & Logs` — Opens the diagnostics output channel.

---

## ⚙️ Configuration

Settings available under `aiActivityVisualizer`:

| Key | Default | Description |
|---|---|---|
| `aiActivityVisualizer.recordingEnabled` | `true` | Auto-start recording on workspace load. |
| `aiActivityVisualizer.retentionDays` | `30` | Maximum days to store session events in SQLite. |
| `aiActivityVisualizer.maxEventsPerSession` | `20000` | Maximum event capacity per session. |
| `aiActivityVisualizer.httpReceiverPort` | `5174` | Local loopback port for HTTP event ingestion. |
| `aiActivityVisualizer.excludedPatterns` | `["**/node_modules/**", "**/.git/**", ...]` | Glob patterns excluded from scanning and event recording. |

---

## 📦 Building & Testing

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run Vitest test suite
npm test

# Build production bundles (extension + webview)
npm run build

# Package installable VSIX
npm run package
```
