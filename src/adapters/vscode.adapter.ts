import * as path from 'path';
import type * as vscodeTypes from 'vscode';
import { ActivityType, AdapterHealth, Provider } from '../types/events';
import { RawEventInput } from '../pipeline/normalizer';
import { AgentAdapter } from './adapter.interface';

export class VSCodeWorkspaceAdapter implements AgentAdapter {
  public readonly id: Provider = 'vscode';
  public readonly name = 'VS Code Workspace Monitor';
  public readonly supportedEventTypes: ActivityType[] = [
    'file_read',
    'file_write',
    'file_create',
    'file_delete',
    'file_rename',
    'editor_focus'
  ];

  private disposables: Array<{ dispose: () => any }> = [];
  private onEventCallback: ((event: RawEventInput) => void) | null = null;
  private sessionId = '';
  private workspaceId = '';
  private workspaceRoot = '';
  private excludedPatterns: string[] = [];
  private eventsCount = 0;
  private lastEventTimestamp = 0;
  private vscodeModule: typeof vscodeTypes | null = null;

  constructor(
    sessionId: string,
    workspaceId: string,
    workspaceRoot: string,
    excludedPatterns: string[] = [],
    vscodeOverride?: typeof vscodeTypes
  ) {
    this.sessionId = sessionId;
    this.workspaceId = workspaceId;
    this.workspaceRoot = workspaceRoot;
    this.excludedPatterns = excludedPatterns;
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
    return this.vscodeModule !== null;
  }

  public async initialize(onEvent: (event: RawEventInput) => void): Promise<void> {
    this.onEventCallback = onEvent;
    if (!this.vscodeModule) return;

    const vscode = this.vscodeModule;

    // Document Changes (Typing / Edit)
    const docChangeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.isExcluded(e.document.uri.fsPath)) return;
      const changesCount = e.contentChanges.length;
      if (changesCount === 0) return;

      const firstChange = e.contentChanges[0];
      const snippet = firstChange?.text ? firstChange.text.slice(0, 300) : null;

      this.emitEvent({
        sessionId: this.sessionId,
        provider: 'vscode',
        source: 'vscode.editor',
        activityType: 'file_write',
        evidenceLevel: 'observed',
        workspaceId: this.workspaceId,
        workspaceRoot: this.workspaceRoot,
        filePath: e.document.uri.fsPath,
        codeSnippet: snippet,
        metadata: {
          changesCount,
          reason: e.reason
        }
      });
    });
    this.disposables.push(docChangeSub);

    // Document Save (file write)
    const docSaveSub = vscode.workspace.onDidSaveTextDocument((doc) => {
      if (this.isExcluded(doc.uri.fsPath)) return;
      this.emitEvent({
        sessionId: this.sessionId,
        provider: 'vscode',
        source: 'vscode.workspace',
        activityType: 'file_write',
        evidenceLevel: 'observed',
        workspaceId: this.workspaceId,
        workspaceRoot: this.workspaceRoot,
        filePath: doc.uri.fsPath,
        metadata: {
          languageId: doc.languageId,
          lineCount: doc.lineCount
        }
      });
    });
    this.disposables.push(docSaveSub);

    // File Create
    const createSub = vscode.workspace.onDidCreateFiles((e) => {
      for (const file of e.files) {
        if (this.isExcluded(file.fsPath)) continue;
        this.emitEvent({
          sessionId: this.sessionId,
          provider: 'vscode',
          source: 'vscode.workspace',
          activityType: 'file_create',
          evidenceLevel: 'observed',
          workspaceId: this.workspaceId,
          workspaceRoot: this.workspaceRoot,
          filePath: file.fsPath
        });
      }
    });
    this.disposables.push(createSub);

    // File Delete
    const deleteSub = vscode.workspace.onDidDeleteFiles((e) => {
      for (const file of e.files) {
        if (this.isExcluded(file.fsPath)) continue;
        this.emitEvent({
          sessionId: this.sessionId,
          provider: 'vscode',
          source: 'vscode.workspace',
          activityType: 'file_delete',
          evidenceLevel: 'observed',
          workspaceId: this.workspaceId,
          workspaceRoot: this.workspaceRoot,
          filePath: file.fsPath
        });
      }
    });
    this.disposables.push(deleteSub);

    // File Rename
    const renameSub = vscode.workspace.onDidRenameFiles((e) => {
      for (const file of e.files) {
        if (this.isExcluded(file.newUri.fsPath)) continue;
        this.emitEvent({
          sessionId: this.sessionId,
          provider: 'vscode',
          source: 'vscode.workspace',
          activityType: 'file_rename',
          evidenceLevel: 'observed',
          workspaceId: this.workspaceId,
          workspaceRoot: this.workspaceRoot,
          filePath: file.newUri.fsPath,
          previousPath: file.oldUri.fsPath
        });
      }
    });
    this.disposables.push(renameSub);

    // Active Editor Change (Focus / Read)
    const editorSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || this.isExcluded(editor.document.uri.fsPath)) return;
      this.emitEvent({
        sessionId: this.sessionId,
        provider: 'vscode',
        source: 'vscode.editor',
        activityType: 'file_read',
        evidenceLevel: 'observed',
        workspaceId: this.workspaceId,
        workspaceRoot: this.workspaceRoot,
        filePath: editor.document.uri.fsPath,
        metadata: {
          visibleRange: editor.visibleRanges?.[0]
        }
      });
    });
    this.disposables.push(editorSub);
  }

  public emitEvent(event: RawEventInput): void {
    this.eventsCount++;
    this.lastEventTimestamp = Date.now();
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }

  public isExcluded(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const commonExcludes = ['node_modules', '.git', '.vscode', '.env', 'dist', 'out'];
    for (const exc of commonExcludes) {
      if (normalized.includes(`/${exc}/`) || normalized.endsWith(`/${exc}`)) {
        return true;
      }
    }
    for (const pattern of this.excludedPatterns) {
      const cleanPat = pattern.replace(/\*\*/g, '').replace(/\*/g, '').toLowerCase();
      if (cleanPat && normalized.includes(cleanPat)) {
        return true;
      }
    }
    return false;
  }

  public dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        // ignore
      }
    }
    this.disposables = [];
    this.onEventCallback = null;
  }

  public getHealth(): AdapterHealth {
    return {
      provider: 'vscode',
      name: this.name,
      available: this.vscodeModule !== null,
      status: this.vscodeModule !== null ? 'connected' : 'unavailable',
      eventsCaptured: this.eventsCount,
      lastEventTime: this.lastEventTimestamp || undefined,
      diagnostic: this.vscodeModule !== null ? 'Monitoring active editor and workspace filesystem.' : 'VS Code API not loaded.'
    };
  }
}
