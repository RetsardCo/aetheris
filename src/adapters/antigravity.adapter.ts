import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ActivityType, AdapterHealth, Provider } from '../types/events';
import { RawEventInput } from '../pipeline/normalizer';
import { AgentAdapter } from './adapter.interface';

export interface AntigravityHookPayload {
  hookEvent: 'PreToolUse' | 'PostToolUse' | 'PreInvocation' | 'PostInvocation' | 'Stop';
  toolName?: string;
  toolArgs?: Record<string, any>;
  durationMs?: number;
  success?: boolean;
  conversationId?: string;
  timestamp?: number;
  snippet?: string;
}

export class AntigravityHookAdapter implements AgentAdapter {
  public readonly id: Provider = 'antigravity';
  public readonly name = 'Google Antigravity Hook Adapter';
  public readonly supportedEventTypes: ActivityType[] = [
    'tool_call',
    'tool_result',
    'agent_lifecycle',
    'file_read',
    'file_write',
    'terminal_command'
  ];

  private onEventCallback: ((event: RawEventInput) => void) | null = null;
  private sessionId = '';
  private workspaceId = '';
  private workspaceRoot = '';
  private hookBridgePath: string | null = null;
  private watcher: fs.FSWatcher | null = null;
  private eventsCount = 0;
  private lastEventTimestamp = 0;
  private isDetected = false;

  constructor(
    sessionId: string,
    workspaceId: string,
    workspaceRoot: string,
    hookBridgePath?: string
  ) {
    this.sessionId = sessionId;
    this.workspaceId = workspaceId;
    this.workspaceRoot = workspaceRoot;
    this.hookBridgePath = hookBridgePath || this.resolveDefaultBridgePath();
    this.detectEnvironment();
  }

  private resolveDefaultBridgePath(): string {
    const homedir = os.homedir();
    // Default Antigravity hook bridge queue file
    return path.join(homedir, '.gemini', 'antigravity', 'hook_events.jsonl');
  }

  private detectEnvironment(): void {
    const homedir = os.homedir();
    const agDir = path.join(homedir, '.gemini', 'antigravity');
    this.isDetected = fs.existsSync(agDir);
  }

  public updateSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  public async isAvailable(): Promise<boolean> {
    return this.isDetected || (this.hookBridgePath !== null && fs.existsSync(this.hookBridgePath));
  }

  public async initialize(onEvent: (event: RawEventInput) => void): Promise<void> {
    this.onEventCallback = onEvent;
    if (this.hookBridgePath && fs.existsSync(this.hookBridgePath)) {
      this.watchBridgeFile(this.hookBridgePath);
    }
  }

  public handleHookEvent(payload: AntigravityHookPayload): void {
    if (!this.onEventCallback) return;

    let actType: ActivityType = 'tool_call';
    let filePath: string | null = null;

    if (payload.hookEvent === 'PostToolUse') {
      actType = 'tool_result';
    } else if (payload.hookEvent === 'PreInvocation' || payload.hookEvent === 'Stop') {
      actType = 'agent_lifecycle';
    }

    // Extract file path from common Antigravity tools
    if (payload.toolArgs) {
      if (typeof payload.toolArgs.AbsolutePath === 'string') {
        filePath = payload.toolArgs.AbsolutePath;
      } else if (typeof payload.toolArgs.TargetFile === 'string') {
        filePath = payload.toolArgs.TargetFile;
      } else if (typeof payload.toolArgs.SearchPath === 'string') {
        filePath = payload.toolArgs.SearchPath;
      }
    }

    if (payload.toolName === 'view_file' || payload.toolName === 'grep_search') {
      actType = 'file_read';
    } else if (payload.toolName === 'replace_file_content' || payload.toolName === 'write_to_file') {
      actType = 'file_write';
    } else if (payload.toolName === 'run_command') {
      actType = 'terminal_command';
    }

    const event: RawEventInput = {
      sessionId: this.sessionId,
      provider: 'antigravity',
      source: 'antigravity.hook',
      activityType: actType,
      evidenceLevel: 'explicit',
      workspaceId: this.workspaceId,
      workspaceRoot: this.workspaceRoot,
      filePath,
      toolName: payload.toolName || payload.hookEvent,
      durationMs: payload.durationMs || null,
      success: payload.success !== undefined ? payload.success : null,
      correlationId: payload.conversationId || null,
      metadata: {
        hookEvent: payload.hookEvent,
        toolArgs: payload.toolArgs
      },
      codeSnippet: payload.snippet || null
    };

    this.eventsCount++;
    this.lastEventTimestamp = Date.now();
    this.onEventCallback(event);
  }

  private watchBridgeFile(filePath: string): void {
    try {
      let offset = fs.statSync(filePath).size;
      this.watcher = fs.watch(filePath, (event) => {
        if (event === 'change') {
          try {
            const stats = fs.statSync(filePath);
            if (stats.size > offset) {
              const stream = fs.createReadStream(filePath, { start: offset, end: stats.size });
              offset = stats.size;
              let buffer = '';
              stream.on('data', (c) => {
                buffer += c.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (line.trim()) {
                    try {
                      this.handleHookEvent(JSON.parse(line));
                    } catch {}
                  }
                }
              });
            }
          } catch {}
        }
      });
    } catch (err) {
      console.warn('Could not watch Antigravity hook bridge:', err);
    }
  }

  public generateHookScript(): string {
    return `#!/usr/bin/env node
// AI Activity Visualizer - Antigravity Hook Bridge
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
      'Content-Length': Buffer.byteLength(data),
      'x-provider': 'antigravity'
    }
  });
  req.on('error', () => {}); // graceful ignore if visualizer is offline
  req.write(data);
  req.end();
}

module.exports = { forwardHook };
`;
  }

  public dispose(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.onEventCallback = null;
  }

  public getHealth(): AdapterHealth {
    let diagnostic = 'Antigravity environment detected. Ready to capture PreToolUse and PostToolUse lifecycle.';
    if (!this.isDetected) {
      diagnostic = 'Google Antigravity environment directory not detected in user home.';
    }

    return {
      provider: 'antigravity',
      name: this.name,
      available: this.isDetected,
      status: this.eventsCount > 0 ? 'connected' : this.isDetected ? 'idle' : 'unavailable',
      eventsCaptured: this.eventsCount,
      lastEventTime: this.lastEventTimestamp || undefined,
      diagnostic
    };
  }
}
