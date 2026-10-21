# Aetheris - Implementation Plan

## 1. Executive Summary & Objective

The objective is to build a production-grade, installable VS Code extension named **Aetheris** that accurately captures, normalizes, stores, and visualizes developer and AI coding agent activities in real-time.

The UI is modeled directly on the **Agent Brain** visual reference (`media_1792485704082_84a33ff8.png`), featuring:
- A compact, dark VS Code-inspired theme (`#070a10` / `#0d131f`) with teal, cyan, amber, and violet accents.
- A glowing repository constellation map (Canvas 2D renderer with glowing wireframe core, orbit particles, folder labels, and event pulse effects).
- Left repository panel ("Your repo, thinking out loud.", folder activity hierarchy, metrics badges, attention filter).
- Floating agent trace cards on the right (macOS dots `•••`, code snippets, terminal commands).
- Full 4-in-1 dashboard: Live Overview, Interactive Graph, Chronological Timeline, Session Replay.
- Dedicated VS Code Sidebar view ("Aetheris") with server controls, recording toggles, diagnostics, and webview launcher.

---

## 2. Architecture & Modules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             VS CODE EXTENSION                               │
│                                                                             │
│  ┌───────────────────────────┐         ┌─────────────────────────────────┐  │
│  │   Agent & Event Adapters  │         │    VS Code Native UI            │  │
│  │  - VS Code Editor/FS      │         │   - Activity Bar Sidebar View   │  │
│  │  - GitHub Copilot Ingest  │         │   - Commands & Status Bar       │  │
│  │  - Google Antigravity     │         │   - Diagnostics Panel           │  │
│  │  - Loopback HTTP / JSONL  │         └────────────────┬────────────────┘  │
│  └─────────────┬─────────────┘                          │                   │
│                │                                        │                   │
│                ▼                                        ▼                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Core Pipeline & Normalizer                         │  │
│  │  - Schema Validation (Zod)                                            │  │
│  │  - Deduplication & Timestamp Handling                                 │  │
│  │  - Evidence Classification (explicit / observed / inferred)           │  │
│  │  - Secret Redaction & Privacy Filter                                  │  │
│  └──────────────────┬─────────────────────────────────┬──────────────────┘  │
│                     │                                 │                     │
│                     ▼                                 ▼                     │
│  ┌──────────────────────────────────┐   ┌────────────────────────────────┐  │
│  │     SQLite Storage Engine        │   │    Webview Host Messenger      │  │
│  │  - Sessions & Events Tables      │   │    (Bi-directional postMessage)│  │
│  │  - Migrations & Retention        │   └────────────────┬───────────────┘  │
│  └──────────────────────────────────┘                    │                  │
└──────────────────────────────────────────────────────────┼──────────────────┘
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WEBVIEW DASHBOARD (React + Canvas)                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Top Header: Search files, Seen counter, Recording pill, View switches │  │
│  ├─────────────────┬───────────────────────────────────┬─────────────────┤  │
│  │ Left Repo Panel │ Central Glowing Constellation     │ Floating Trace  │  │
│  │ - "Your repo,   │ - Canvas 2D High-Performance      │ Cards           │  │
│  │   thinking..."  │ - Wireframe Diamond Core          │ - Code snippets │  │
│  │ - Metrics row   │ - Orbit Particles & Comet trails  │ - Window dots   │  │
│  │ - Top Folders   │ - Smooth Pan / Zoom / Click       │ - Agent actions │  │
│  │ - Filters       │ - Real dependency edges           │                 │  │
│  ├─────────────────┴───────────────────────────────────┴─────────────────┤  │
│  │ Bottom Bar: Replay pill, Big Bang, Agent Trace terminal log           │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ Tab Views: [Overview] [Interactive Graph] [Timeline] [Sessions]       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack & Decision Rationale

| Requirement | Technology | Decision Rationale |
|---|---|---|
| Language | TypeScript 5.x | Strict type checking enabled (`strict: true`, `noImplicitAny: true`). |
| Extension API | `@types/vscode` ^1.90.0 | Standard extension host integration. |
| Dashboard UI | React 18 + TypeScript | High reactivity, state synchronization between sidebar, graph, and cards. |
| Graph Visualizer | HTML5 Canvas 2D Engine | Custom, zero-dependency, ultra-fluid 60fps constellation renderer. Allows custom glow blurs (`ctx.shadowBlur`), particle comets, 3D rotating diamond polyhedron, smooth infinite zoom/pan, hover/click hit-testing, and zero bundle bloat or WebGL shader initialization errors in VS Code Webviews. |
| Database | SQLite via `sql.js` (WebAssembly) | Portable across Windows, macOS, and Linux without native Electron rebuilds or compilation issues. Full SQL syntax, foreign keys, transactions, and binary persistence to workspace storage. |
| Schema Validation | Zod 3.x | Safe runtime validation of all incoming events, loopback payloads, and webview messages. |
| Testing | Vitest | Extremely fast, native TypeScript support, compatibility with Node and ES modules. |
| Bundler & Packaging | esbuild + `@vscode/vsce` | Fast dual bundling (extension host + webview single bundle) and reproducible `.vsix` generation. |

---

## 4. Phase-by-Phase Execution Plan

- [x] **Phase 1: Workspace & Build Scaffolding**
  - Initialize project configuration (`package.json`, `tsconfig.json`, `esbuild.config.js`, `vitest.config.ts`, `.gitignore`).
  - Install dependencies (React, Zod, sql.js, vitest, vsce).
  - Verify build scripts and test runners.

- [ ] **Phase 2: Event Pipeline & Shared Types**
  - Define `ActivityEvent` schema with Zod:
    - `id`, `timestamp`, `ingestionTimestamp`, `sessionId`, `provider` (`copilot` | `antigravity` | `vscode` | `unknown`), `source`, `activityType` (`read` | `edit` | `create` | `delete` | `rename` | `tool_call` | `tool_result` | `terminal` | `focus`), `evidenceLevel` (`explicit` | `observed` | `inferred`), `filePath`, `previousPath`, `toolName`, `durationMs`, `success`, `metadata`.
  - Implement secret redaction filter (API keys, tokens, auth headers).
  - Implement deduplication and path normalizer.

- [ ] **Phase 3: SQLite Storage & Session Management**
  - Initialize SQLite database using `sql.js` with file backing.
  - Create versioned migrations: `sessions`, `events`, `edges`, `metadata`.
  - Implement queries with pagination, time range filters, and session summary aggregates.
  - Implement bounded retention and data deletion/export.

- [ ] **Phase 4: Adapters Implementation**
  - `VSCodeWorkspaceAdapter`: Listens to `vscode.workspace.onDidChangeTextDocument`, `onDidCreateFiles`, `onDidDeleteFiles`, `onDidRenameFiles`, `window.onDidChangeActiveTextEditor`.
  - `CopilotTelemetryAdapter`: Detects Copilot extension presence, watches local Copilot chat log/JSONL streams, safely ingests tool executions.
  - `AntigravityHookAdapter`: Connects to Google Antigravity hook bridge or CLI output, safely ingesting lifecycle events (`PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`).
  - `GenericHttpAdapter`: Local loopback HTTP listener (`127.0.0.1:<port>`) with cryptographically secure session auth token.
  - Static dependency analyzer: Safely extracts imports/exports (`import`, `require`, `from`) to construct genuine dependency edges.

- [ ] **Phase 5: Agent Brain Dashboard UI Implementation**
  - Layout & CSS design matching `media_1792485704082_84a33ff8.png`:
    - Top header: Search bar, seen statistics, tour/speed toggle, tab view switches.
    - Left column: "Your repo, thinking out loud.", 4-stat metrics counter, top folders with colored indicators, label & attention toggles.
    - Center Canvas:
      - 3D rotating cyan wireframe octahedron/diamond core with horizon glow.
      - Constellation nodes with glowing halos, node labels, activity-based color accents (amber for edits, cyan for reads, green for creates, red for deletes).
      - Orbital comet particle animation connecting active nodes.
      - Smooth pan/zoom transform with mouse wheel and drag.
      - Node click selection and file navigation dispatch.
    - Right column: Floating agent trace cards with `•••` window buttons, syntax highlighted snippets, terminal prompts `$`.
    - Bottom floating trace terminal: Real-time agent event stream.
    - Full views for Overview, Interactive Graph, Timeline, and Sessions with replay playback.

- [ ] **Phase 6: VS Code Native Sidebar & Controls**
  - Sidebar Webview View: "SERVER: Running", URL, Start/Stop, Copy URL, Open in VS Code, Open in Browser, Show Logs.
  - Commands registered in `package.json`:
    - `aiActivityVisualizer.openDashboard`
    - `aiActivityVisualizer.startRecording`
    - `aiActivityVisualizer.stopRecording`
    - `aiActivityVisualizer.clearSession`
    - `aiActivityVisualizer.exportSession`
    - `aiActivityVisualizer.configureCopilot`
    - `aiActivityVisualizer.configureAntigravity`
    - `aiActivityVisualizer.showDiagnostics`

- [ ] **Phase 7: Comprehensive Automated Testing**
  - Unit tests for schema, normalization, redaction, SQLite repo, dependency graph parsing.
  - Integration tests for adapter lifecycle, HTTP receiver auth, replay mechanics.
  - Failure tests for missing adapters, corrupted payloads, large histories.

- [ ] **Phase 8: Build, Packaging & Documentation**
  - Run type checking and vitest test suite.
  - Bundle extension and webview with esbuild.
  - Package into `.vsix` via `@vscode/vsce package`.
  - Deliver comprehensive markdown documentation (`README.md`, `ARCHITECTURE.md`, `PRIVACY.md`, `AGENT-INTEGRATIONS.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`).
