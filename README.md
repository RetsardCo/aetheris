# AI Activity Visualizer (Agent Brain) for Visual Studio Code

[![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Code-AI%20Activity%20Visualizer-blue.svg)](https://marketplace.visualstudio.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](https://opensource.org/licenses/MIT)
[![Tests: Passing](https://img.shields.io/badge/Tests-Passing-emerald.svg)](#building-and-testing)

A real-time developer observability suite and 3D neural observatory for monitoring, normalizing, storing, and visualizing AI coding agent activity (Google Antigravity, GitHub Copilot, and Visual Studio Code workspace edits) as an interactive spherical constellation mesh.

---

## Architecture and Overview

AI Activity Visualizer provides comprehensive runtime visibility into autonomous AI agent actions. When agents read documentation, inspect codebase graphs, issue terminal executions, or edit source files, every event is ingested through low-latency telemetry adapters, sanitized for privacy, persisted in an embedded SQLite database, and projected across a high-performance 60 FPS Canvas 2D engine.

### 3D Neural Observatory (Aetheris Engine)

1. Full Viewport Background Observable Space:
   - The 3D constellation engine renders across the entire viewport background, allowing unrestricted zooming and 360-degree orbital exploration.
   - All HUD controls and telemetry modules float as frosted glass overlay panels using Apple, macOS, and iOS design guidelines (20px blur, 180% saturation, translucent dark tint, subtle borders, and layered depth).

2. Continuous Camera Node Follow (3D Focus Tracking):
   - When a file node is focused in 3D, the camera target LookAt coordinates continuously track the node's position as it moves or as the galaxy orbits.
   - The camera centers and orbits directly around the selected node rather than being pinned to the scene origin.
   - A dedicated return control allows one-click unbinding and smooth return to scene center.

3. Shortest-Path Angular Velocity Stabilization:
   - Camera rotation employs shortest-path angular delta wrapping `((targetYaw - yaw) % (2 * PI))` normalized within `[-PI, PI]`.
   - Eliminates rapid spinning artifacts during spotlight search or manual focus transitions while auto-orbit is toggled.

4. Side-Docked Live Agent Trace:
   - Positioned neatly at the bottom-left edge without obstructing central constellation nodes.
   - Features real-time log streaming with granular filters (All, Write, Read, Exec, Think) and one-click node spotlighting.

5. AI Cognition Stream and Multi-Project Reasoning:
   - Bottom-docked reasoning drawer supporting multi-project workspaces.
   - Real-time Markdown rendering for AI reasoning steps, duration tracking badges, and synchronized cause-and-effect timelines linking thoughts directly to produced file actions.

---

## Core Features

1. Constellation Graph and Cluster Hulls
   - Hardware-accelerated 60 FPS perspective projection engine with depth-sorted painter's rendering.
   - Spherical cluster hulls with polyhedral geometric wireframes and orbital latitude rings.
   - Luminous dependency edges derived from static import parsing with travelling signal energy packets.
   - Procedural WebAudio synthesizer delivering distinct sonic feedback for read, write, create, shockwave, and thinking events.

2. Code Trace Live Stack
   - High-fidelity frosted cards displaying recent file modifications and code diffs with syntax highlighting.
   - Non-cutting flex layout with independent vertical scrolling.
   - Instant click-to-focus linking directly into the 3D graph and editor.

3. Multi-Agent Adapters
   - Google Antigravity Adapter: Tails live transcript JSONL streams, parsing reasoning thoughts, tool calls, and lifecycle hooks.
   - GitHub Copilot Adapter: Ingests telemetry tool calls (read_file, grep_search, run_in_terminal, edit_file).
   - Visual Studio Code Workspace Adapter: Tracks document modifications, directory creations, deletions, and focus changes.
   - Loopback HTTP Bridge: Secure local listener on port 5174/5175 with Server-Sent Events (SSE) broadcasting.

4. Privacy and Persistence
   - Embedded SQLite WebAssembly database (`sql.js`) requiring zero external server dependencies.
   - Automated secret sanitization for API keys, bearer tokens, AWS credentials, and environment secrets.
   - Configurable retention policies with automated pruning.

---

## Quick Start

### Installation

Install via the Visual Studio Code Extensions view or command line:

```bash
code --install-extension ai-activity-visualizer-1.0.0.vsix
```

To run in development mode, clone the repository, open in Visual Studio Code, and launch the extension development host (`F5`).

### Extension Commands

Access via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Agent Brain: Open Activity Dashboard` - Opens the primary 3D neural visualizer.
- `Agent Brain: Start Recording` - Resumes background telemetry capture.
- `Agent Brain: Stop Recording` - Pauses background telemetry capture.
- `Agent Brain: Clear Current Session` - Resets stored events for the active session.
- `Agent Brain: Export Current Session` - Exports session telemetry as sanitized JSON.
- `Agent Brain: Show Diagnostics & Logs` - Opens the diagnostic output channel.

---

## Configuration Settings

The extension can be customized through Visual Studio Code settings under `aiActivityVisualizer`:

| Setting | Default | Description |
|---|---|---|
| `aiActivityVisualizer.recordingEnabled` | `true` | Automatically starts recording on workspace launch. |
| `aiActivityVisualizer.retentionDays` | `30` | Maximum retention period in days for SQLite event logs. |
| `aiActivityVisualizer.maxEventsPerSession` | `20000` | Maximum event capacity per recorded session. |
| `aiActivityVisualizer.graphNodeLimit` | `1000` | Maximum number of file nodes rendered in the graph. |
| `aiActivityVisualizer.httpReceiverPort` | `5174` | Local loopback port for HTTP event ingestion. |
| `aiActivityVisualizer.enabledAdapters` | `["vscode", "copilot", "antigravity", "http"]` | List of active telemetry adapters. |
| `aiActivityVisualizer.excludedPatterns` | `["**/node_modules/**", "**/.git/**", "**/dist/**", ...]` | Glob patterns excluded from activity recording. |

---

## Building and Testing

Prerequisites: Node.js (v18 or higher) and npm.

```bash
# Install dependencies
npm install

# Run static type checks
npm run compile

# Execute unit and integration tests
npm test

# Build production bundles (extension and webview)
npm run build

# Package installable VSIX package
npm run package
```

---

## Repository and Live Bridge Server

To run the live backend bridge server independently:

```bash
node live_bridge_server.mjs
```

The bridge server will detect active Antigravity conversations, tail transcript logs in real time, and serve the dashboard locally at `http://127.0.0.1:5175/`.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
