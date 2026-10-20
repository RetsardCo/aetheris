import * as fs from 'fs';
import * as path from 'path';
import type * as vscodeTypes from 'vscode';
import { ActivityType, AdapterHealth, Provider } from '../types/events';
import { RawEventInput } from '../pipeline/normalizer';
import { AgentAdapter } from './adapter.interface';

export class CopilotTelemetryAdapter implements AgentAdapter {
  public readonly id: Provider = 'copilot';
  public readonly name = 'GitHub Copilot Telemetry Adapter';
  public readonly supportedEventTypes: ActivityType[] = [
    'tool_call',
    'tool_result',
    'agent_lifecycle',
    'file_read',
    'file_write'
  ];

  private onEventCallback: ((event: RawEventInput) => void) | null = null;
  private sessionId = '';
  private workspaceId = '';
  private workspaceRoot = '';
  private vscodeModule: typeof vscodeTypes | null = null;
  private watcher: fs.FSWatcher | null = null;
  private jsonlLogPath: string | null = null;
  private fileOffset = 0;
  private eventsCount = 0;
  private lastEventTimestamp = 0;
  private extensionInstalled = false;

  constructor(
    sessionId: string,
    workspaceId: string,
    workspaceRoot: string,
    jsonlLogPath?: string,
    vscodeOverride?: typeof vscodeTypes
  ) {
    this.sessionId = sessionId;
    this.workspaceId = workspaceId;
    this.workspaceRoot = workspaceRoot;
    this.jsonlLogPath = jsonlLogPath || null;
    if (vscodeOverride) {
      this.vscodeModule = vscodeOverride;
    } else {
      try {
        this.vscodeModule = require('vscode');
      } catch {
        this.vscodeModule = null;
      }
    }
  }

  public updateSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  public async isAvailable(): Promise<boolean> {
    if (this.jsonlLogPath && fs.existsSync(this.jsonlLogPath)) {
      return true;
    }
    if (this.vscodeModule) {
      const copilot = this.vscodeModule.extensions.getExtension('github.copilot');
      const chat = this.vscodeModule.extensions.getExtension('github.copilot-chat');
      this.extensionInstalled = !!(copilot || chat);
      return this.extensionInstalled;
    }
    return false;
  }

  public async initialize(onEvent: (event: RawEventInput) => void): Promise<void> {
    this.onEventCallback = onEvent;
    await this.isAvailable();

    // If local JSONL log file is specified, watch and stream lines
    if (this.jsonlLogPath && fs.existsSync(this.jsonlLogPath)) {
      this.startWatchingJsonl(this.jsonlLogPath);
    }
  }

  public ingestJsonlLine(line: string): void {
    if (!line.trim()) return;
    try {
      const data = JSON.parse(line);
      this.handleCopilotRecord(data);
    } catch {
      // Ignore malformed line
    }
  }

  public handleCopilotRecord(data: any): void {
    if (!this.onEventCallback) return;

    const toolName = data.toolName || data.tool || data.command || data.action || null;
    const filePath = data.filePath || data.path || data.file || null;
    let actType: ActivityType = 'tool_call';

    if (data.type === 'tool_result' || data.result !== undefined) {
      actType = 'tool_result';
    } else if (toolName && /read/i.test(toolName)) {
      actType = 'file_read';
    } else if (toolName && /edit|write|create/i.test(toolName)) {
      actType = 'file_write';
    }

    const event: RawEventInput = {
      sessionId: this.sessionId,
      provider: 'copilot',
      source: 'copilot.telemetry',
      activityType: actType,
      evidenceLevel: 'explicit',
      workspaceId: this.workspaceId,
      workspaceRoot: this.workspaceRoot,
      filePath,
      toolName,
      durationMs: data.durationMs || data.duration || null,
      success: data.success !== undefined ? !!data.success : null,
      correlationId: data.correlationId || data.conversationId || null,
      metadata: {
        agent: 'copilot',
        args: data.args || data.parameters,
        turnId: data.turnId
      },
      codeSnippet: data.snippet || data.diff || null
    };

    this.eventsCount++;
    this.lastEventTimestamp = Date.now();
    this.onEventCallback(event);
  }

  private startWatchingJsonl(filePath: string): void {
    try {
      const stats = fs.statSync(filePath);
      this.fileOffset = stats.size; // start at end

      this.watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.readNewJsonlContent(filePath);
        }
      });
    } catch (err) {
      console.warn('Could not watch Copilot JSONL log:', err);
    }
  }

  private readNewJsonlContent(filePath: string): void {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.fileOffset) {
        const stream = fs.createReadStream(filePath, {
          start: this.fileOffset,
          end: stats.size
        });
        this.fileOffset = stats.size;

        let buffer = '';
        stream.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            this.ingestJsonlLine(line);
          }
        });
      }
    } catch (err) {
      console.warn('Error reading Copilot JSONL content:', err);
    }
  }

  public dispose(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.onEventCallback = null;
  }

  public getHealth(): AdapterHealth {
    let diagnostic = 'Copilot extension active. Ready to ingest telemetry & tool invocations.';
    if (!this.extensionInstalled && !this.jsonlLogPath) {
      diagnostic = 'GitHub Copilot extension (github.copilot or github.copilot-chat) not detected.';
    }

    return {
      provider: 'copilot',
      name: this.name,
      available: this.extensionInstalled || !!this.jsonlLogPath,
      status: this.eventsCount > 0 ? 'connected' : this.extensionInstalled ? 'idle' : 'unavailable',
      eventsCaptured: this.eventsCount,
      lastEventTime: this.lastEventTimestamp || undefined,
      diagnostic
    };
  }
}
