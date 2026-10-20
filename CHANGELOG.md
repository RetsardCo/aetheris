# Changelog

All notable changes to the **AI Activity Visualizer** extension will be documented in this file.

## [1.0.0] - 2026-10-20

### Added
- **Agent Brain Visualizer**: Recreated the Agent Brain dark-first developer tool UI featuring a 60fps Canvas 2D constellation graph with a 3D rotating diamond wireframe core, orbital comet trail, glowing activity halos, and interactive pan/zoom.
- **Top Header**: Search input with file filtering, seen stats counter, live recording pill, and 4 view navigation buttons.
- **Left Repository Panel**: "Your repo, thinking out loud" hero text, 4-column metric strip (Files, Folders, Connections, Touched), Top Folders list with colored indicators, and attention filter toggle.
- **Floating Trace Cards**: Dark code cards with macOS `● ● ●` window buttons, syntax highlighted text, and terminal prompt `$`.
- **Floating Agent Trace Terminal**: Real-time terminal trace stream tracking actions (`cd`, `open`, `Read`, `Follow`, `hop`).
- **Core Event Pipeline**: Strict Zod schema validation, evidence classification (`explicit`, `observed`, `inferred`), secret-pattern redactor, and bounded LRU deduplicator.
- **Adapters**:
  - `VSCodeWorkspaceAdapter` for file edits, creations, deletions, renames, and editor focus.
  - `CopilotTelemetryAdapter` for GitHub Copilot tool invocations and chat turns.
  - `AntigravityHookAdapter` for Google Antigravity lifecycle hooks (`PreToolUse`, `PostToolUse`).
  - `GenericHttpAdapter` for authenticated loopback HTTP ingestion.
- **Static Dependency Analyzer**: Parses genuine imports and requires across JS/TS/Python without arbitrary code execution.
- **SQLite Persistence**: Portable WebAssembly SQLite storage with versioned schema migrations, debounced disk persistence, and automated retention pruning.
- **VS Code Native Sidebar**: Activity Bar Server control view with running status, port/URL display, Start/Stop buttons, and diagnostics.
- **Automated Test Suite**: 13 unit, integration, and failure tests covering edge cases, secret redaction, and database queries.
- **VSIX Packaging**: Complete installable `.vsix` package generation.
