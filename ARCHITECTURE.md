# Architecture: Aetheris

## 1. System Overview

Aetheris operates on a strict **local-first, privacy-by-design** architecture. It captures event streams from AI agents and the VS Code editor, normalizes them through a deterministic validation pipeline, indexes them in an embedded SQLite database, and streams updates bi-directionally to a React Canvas 2D Webview dashboard.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTENSION HOST (Node.js)                         │
│                                                                             │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────┐  │
│  │ VSCodeWorkspaceAdapter│   │ CopilotTelemetryAdapt │   │ Antigravity...│  │
│  └───────────┬───────────┘   └───────────┬───────────┘   └───────┬───────┘  │
│              │                           │                       │          │
│              └─────────────────────────┐ │ ┌─────────────────────┘          │
│                                        ▼ ▼ ▼                                │
│                          ┌───────────────────────────────┐                  │
│                          │      GenericHttpAdapter       │                  │
│                          │  (Loopback: 127.0.0.1:5174)   │                  │
│                          └───────────────┬───────────────┘                  │
│                                          │                                  │
│                                          ▼                                  │
│                          ┌───────────────────────────────┐                  │
│                          │     Core Event Pipeline       │                  │
│                          │  - Zod Schema Validation      │                  │
│                          │  - Evidence Classifier        │                  │
│                          │  - Secret Redactor            │                  │
│                          │  - Bounded LRU Deduplicator   │                  │
│                          └───────────────┬───────────────┘                  │
│                                          │                                  │
│                        ┌─────────────────┴─────────────────┐                │
│                        ▼                                   ▼                │
│           ┌────────────────────────┐         ┌───────────────────────────┐  │
│           │ SQLiteStorage (sql.js) │         │    DashboardPanel Host    │  │
│           │ - sessions table       │         │  - Webview Message Bridge │  │
│           │ - events table         │         │  - Strict CSP Nonce       │  │
│           │ - dependency_edges     │         └─────────────┬─────────────┘  │
│           └────────────────────────┘                       │                │
└────────────────────────────────────────────────────────────┼────────────────┘
                                                             ▼ (postMessage)
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WEBVIEW DASHBOARD (React + Canvas)                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Top Header: Search input, seen counter, mode badge, tab switcher      │  │
│  ├─────────────────┬───────────────────────────────────┬─────────────────┤  │
│  │ LeftRepoPanel   │ ConstellationGraph (Canvas 2D)    │ TraceCards      │  │
│  │ - Hero branding │ - 3D Wireframe Octahedron Core    │ - Floating code │  │
│  │ - 4-stat strip  │ - Concentric Activity Halos       │   panels (•••)  │  │
│  │ - Top Folders   │ - Orbital Comet Particle          │ - Direct click- │  │
│  │ - Filter toggles│ - Pan, Zoom, Click Hit-Testing    │   to-file open  │  │
│  ├─────────────────┴───────────────────────────────────┴─────────────────┤  │
│  │ AgentTraceTerminal: Real-time action log (cd, open, Read, Follow, hop)│  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Modules

### 2.1 Event Normalizer & Evidence Classification
- **Explicit**: Direct agent-reported tool invocations and lifecycle events (`copilot`, `antigravity`).
- **Observed**: File system and editor focus changes directly recorded from the VS Code workspace API. Under no circumstance does the pipeline upgrade an `observed` event to `explicit` merely based on temporal proximity.
- **Inferred**: Derived associations or tool sequences.

### 2.2 Privacy & Secret Redaction
All incoming payloads pass through `redactString` and `sanitizeMetadata`:
- Automatic regex redaction for OpenAI, Google, GitHub, and AWS keys, Bearer auth tokens, and URL credentials.
- Automatic depth truncation (max depth 4) and byte limits (max 2KB per string) to prevent denial-of-service memory pressure.

### 2.3 Dependency Graph Analyzer
The `DependencyAnalyzer` inspects project source files using safe AST regex matching without arbitrary execution:
- Parses `import`, `require`, `export from`, and `from ... import` statements.
- Verifies target file existence in the workspace.
- Emits verifiable `GraphEdge` entries tagged with `provenance: "static_import_parser"` and `confidence: 1.0`.

### 2.4 High-Performance 60fps Constellation Canvas Engine
The visualizer avoids DOM node explosion by using an optimized HTML5 Canvas 2D engine:
- High-DPI support via `window.devicePixelRatio`.
- Full matrix pan and zoom transforms.
- Real-time 3D rotation projection for the central octahedron core.
- Procedural particle trail generation for swooping comets.
- Bounded spatial hit-testing for hover tooltips and node selection.
