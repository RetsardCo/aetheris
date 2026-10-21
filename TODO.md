# Aetheris - Task Checklist (TODO.md)

- [x] **1. Scaffolding & Setup**
  - [x] Initialize `package.json` with required scripts and VS Code extension contribution points
  - [x] Configure `tsconfig.json` with strict mode enabled
  - [x] Configure `esbuild.config.mjs` for bundling both extension host and webview app
  - [x] Configure `vitest.config.ts` for unit & integration tests
  - [x] Install dependencies (`sql.js`, `zod`, `react`, `react-dom`, `@types/vscode`, etc.)

- [x] **2. Core Pipeline & Normalized Event Schema**
  - [x] Define `ActivityEvent` Zod schema and TypeScript interfaces
  - [x] Implement evidence level logic: `explicit`, `observed`, `inferred`
  - [x] Implement provider attribution: `copilot`, `antigravity`, `vscode`, `unknown`
  - [x] Implement secret-pattern redaction engine
  - [x] Implement path normalization and deduplication logic

- [x] **3. SQLite Storage Engine**
  - [x] Initialize `sql.js` WASM engine with local disk persistence
  - [x] Implement schema migrations (`sessions`, `events`, `edges`, `config`)
  - [x] Implement event query repository with pagination, filtering, and indexing
  - [x] Implement session manager with metrics aggregation
  - [x] Implement retention policy and bounded event cleanup
  - [x] Implement session export & JSON sanitization

- [x] **4. Agent & Workspace Adapters**
  - [x] Define `AgentAdapter` interface (provider identity, lifecycle, health, ingestion)
  - [x] Implement `VSCodeWorkspaceAdapter` (file change, create, delete, rename, editor focus)
  - [x] Implement `CopilotTelemetryAdapter` (chat telemetry, tool calls, JSONL stream)
  - [x] Implement `AntigravityHookAdapter` (PreToolUse, PostToolUse, invocation lifecycle)
  - [x] Implement `GenericHttpAdapter` (authenticated loopback HTTP server with security token)
  - [x] Implement `DependencyAnalyzer` (static import parsing for dependency edges)

- [x] **5. Agent Brain Dashboard Webview UI**
  - [x] Build dark theme CSS matching reference image (`#070a10` background, borders, glowing text)
  - [x] Implement top header (search files, seen badge, tour/speed toggle, tab switches)
  - [x] Implement left repo panel ("Your repo, thinking out loud.", metrics row, top folders list, attention toggle)
  - [x] Implement central glowing constellation Canvas 2D engine:
    - [x] 3D rotating cyan diamond wireframe core
    - [x] Dynamic node rendering with glow halos and activity color highlights
    - [x] True dependency edges connecting files
    - [x] Orbital comet trails and animated event pulses
    - [x] Interactive pan, zoom, click, search highlight
    - [x] Bottom controls: Replay bar, Big Bang button
  - [x] Implement floating agent trace cards with `•••` window buttons, syntax highlighting, and terminal logs
  - [x] Implement floating bottom Agent Trace terminal
  - [x] Implement 4 core views: Overview, Interactive Graph, Activity Timeline, Session Replay
  - [x] Implement bi-directional VS Code webview messaging with strict CSP

- [x] **6. VS Code Control Sidebar & Commands**
  - [x] Implement `ControlSidebarViewProvider` in Activity Bar
  - [x] Register all commands: open dashboard, start/stop recording, copy URL, export, diagnostics
  - [x] Add settings in `package.json` (recording defaults, exclusions, retention, graph limits)

- [x] **7. Automated Testing**
  - [x] Unit tests for schema validation, evidence rules, deduplication, redaction
  - [x] Storage tests for SQLite migrations, queries, and retention
  - [x] Adapter tests with deterministic fixtures for Copilot, Antigravity, and VS Code events
  - [x] HTTP receiver security tests (token validation, payload sanitization)

- [x] **8. Verification & Packaging**
  - [x] Run test suite with Vitest (18/18 passing across 5 test suites)
  - [x] Run TypeScript type check (`tsc --noEmit` clean)
  - [x] Package extension `.vsix` using `@vscode/vsce`
  - [x] Complete documentation: `README.md`, `ARCHITECTURE.md`, `PRIVACY.md`, `AGENT-INTEGRATIONS.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`

- [x] **9. 3D Focus Tracking, Anti-Spin Bug Fix & Apple Glass Dashboard**
  - [x] Full viewport background 3D canvas (`inset: 0`, 100vw, 100vh)
  - [x] Apple / macOS / iOS frosted glass floating overlay panels (`apple-glass`, `backdrop-filter: blur(20px)`)
  - [x] Dynamic 3D camera node follow and LookAt tracking (`trackingNode`, `lookAtX, Y, Z`)
  - [x] Shortest-path angular wrapping delta fix on camera yaw (eliminates wild spinning)
  - [x] Dedicated bottom-left Live Agent Trace terminal dock with filters and one-click focus
  - [x] Live Stack layout fix (`flex-1 min-h-0 overflow-y-auto`, no card clipping)
  - [x] Synchronized brain artifact dashboard
  - [x] Comprehensive unit tests passing (40/40 tests across 6 suites)
  - [x] Professional emoji-free README and MIT license
