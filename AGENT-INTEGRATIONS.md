# Agent Integrations Guide

This document specifies the supported agent contracts, telemetry surfaces, and integration procedures for **AI Activity Visualizer**.

---

## 1. VS Code Workspace Monitor (`vscode`)
- **Evidence Level**: `observed`
- **Supported Events**: `file_read`, `file_write`, `file_create`, `file_delete`, `file_rename`, `editor_focus`.
- **Contract**: Monitors standard VS Code extension APIs (`vscode.workspace.onDidChangeTextDocument`, `onDidCreateFiles`, etc.). Never attributes file changes to an AI agent unless an agent integration explicitly reports the event.

---

## 2. GitHub Copilot Telemetry Adapter (`copilot`)
- **Evidence Level**: `explicit`
- **Supported Events**: `tool_call`, `tool_result`, `agent_lifecycle`, `file_read`, `file_write`.
- **Supported Ingestion**:
  1. Automated extension availability detection (`github.copilot` and `github.copilot-chat`).
  2. Local JSONL streaming from configured Copilot debug logs.
  3. Direct ingestion via Loopback HTTP adapter.
- **Tools Captured**: `read_file`, `grep_search`, `run_in_terminal`, `edit_file`, and conversational turns.

---

## 3. Google Antigravity Hook Adapter (`antigravity`)
- **Evidence Level**: `explicit`
- **Supported Events**: `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`.
- **Integration Bridge**:
  - Automatically checks `~/.gemini/antigravity/` for environment presence.
  - Monitors the hook queue at `~/.gemini/antigravity/hook_events.jsonl` or receives hook POST requests on `http://127.0.0.1:5174/api/events`.
- **Forwarding Script Sample**:
  ```javascript
  const http = require('http');
  function forwardHook(event) {
    const data = JSON.stringify(event);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5174,
      path: '/api/events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider': 'antigravity'
      }
    });
    req.on('error', () => {});
    req.write(data);
    req.end();
  }
  ```

---

## 4. Generic Loopback HTTP Receiver (`unknown`)
- **Address**: `http://127.0.0.1:5174/api/events`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <session-token>` (or `x-agent-token: <session-token>`)
  - `x-provider: <provider-name>` (e.g. `copilot`, `antigravity`, or custom)
- **Payload Schema**:
  ```json
  {
    "activityType": "tool_call",
    "toolName": "read_file",
    "filePath": "src/extension.ts",
    "durationMs": 85,
    "success": true,
    "metadata": {
      "argument": "src/extension.ts"
    }
  }
  ```
