import * as vscode from 'vscode';
import { GenericHttpAdapter } from '../adapters/http.adapter';

export class ControlSidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiActivityVisualizer.controlView';

  private _view?: vscode.WebviewView;
  private httpAdapter: GenericHttpAdapter;
  private isRecording: boolean;
  private onToggleRecording: (start: boolean) => void;
  private onOpenDashboard: () => void;
  private onShowDiagnostics: () => void;
  private onValidateIntegrations: () => void;

  constructor(
    private readonly extensionUri: vscode.Uri,
    httpAdapter: GenericHttpAdapter,
    isRecording: boolean,
    onToggleRecording: (start: boolean) => void,
    onOpenDashboard: () => void,
    onShowDiagnostics: () => void,
    onValidateIntegrations: () => void
  ) {
    this.httpAdapter = httpAdapter;
    this.isRecording = isRecording;
    this.onToggleRecording = onToggleRecording;
    this.onOpenDashboard = onOpenDashboard;
    this.onShowDiagnostics = onShowDiagnostics;
    this.onValidateIntegrations = onValidateIntegrations;
  }

  public setRecording(recording: boolean): void {
    this.isRecording = recording;
    this.updateContent();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.command) {
        case 'start':
          this.onToggleRecording(true);
          break;
        case 'stop':
          this.onToggleRecording(false);
          break;
        case 'copyUrl':
          vscode.env.clipboard.writeText(this.httpAdapter.getUrl());
          vscode.window.showInformationMessage(`Copied dashboard URL: ${this.httpAdapter.getUrl()}`);
          break;
        case 'openVsCode':
          this.onOpenDashboard();
          break;
        case 'openBrowser': {
          const authUrl = `${this.httpAdapter.getUrl()}?token=${encodeURIComponent(this.httpAdapter.getAuthToken())}`;
          vscode.env.openExternal(vscode.Uri.parse(authUrl));
          break;
        }
        case 'showLogs':
          this.onShowDiagnostics();
          break;
        case 'validateIntegrations':
          this.onValidateIntegrations();
          break;
      }
    });

    this.updateContent();
  }

  private updateContent(): void {
    if (!this._view) return;
    this._view.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const port = this.httpAdapter.getPort();
    const url = `http://127.0.0.1:${port}/`;
    const statusText = this.isRecording ? 'Running' : 'Stopped';
    const statusColor = this.isRecording ? '#10b981' : '#f59e0b';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Brain Sidebar</title>
  <style>
    body {
      background-color: var(--vscode-sideBar-background, #080b11);
      color: var(--vscode-sideBar-foreground, #cbd5e1);
      font-family: var(--vscode-font-family, -apple-system, sans-serif);
      padding: 14px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground, #64748b);
      margin-bottom: 6px;
    }
    .status-text {
      font-size: 12px;
      margin-bottom: 6px;
    }
    .status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: ${statusColor};
      margin-right: 6px;
    }
    .url-box {
      background-color: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 6px 8px;
      font-family: monospace;
      font-size: 11px;
      color: #38bdf8;
      margin-bottom: 8px;
      word-break: break-all;
    }
    .btn-row {
      display: flex;
      gap: 6px;
    }
    button {
      background-color: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      flex: 1;
      transition: background 0.15s ease;
    }
    button:hover {
      background-color: #334155;
    }
    button.primary {
      background-color: #0284c7;
      border-color: #0369a1;
    }
    button.primary:hover {
      background-color: #0369a1;
    }
  </style>
</head>
<body>
  <div>
    <div class="section-title">SERVER</div>
    <div class="status-text">
      <span class="status-dot"></span>
      Agent Brain: <strong>${statusText}</strong>
    </div>
    <div class="url-box">${url}</div>
    <div class="btn-row" style="margin-bottom: 6px;">
      <button class="primary" onclick="vscode.postMessage({ command: 'start' })">Start</button>
      <button onclick="vscode.postMessage({ command: 'stop' })">Stop</button>
    </div>
    <button style="width: 100%;" onclick="vscode.postMessage({ command: 'copyUrl' })">Copy URL</button>
  </div>

  <div>
    <div class="section-title">OPEN</div>
    <div class="btn-row">
      <button class="primary" onclick="vscode.postMessage({ command: 'openVsCode' })">Open in VS Code</button>
      <button onclick="vscode.postMessage({ command: 'openBrowser' })">Open in Browser</button>
    </div>
  </div>

  <div>
    <div class="section-title">DIAGNOSTICS</div>
    <div class="btn-row" style="margin-bottom: 6px;">
      <button class="primary" onclick="vscode.postMessage({ command: 'validateIntegrations' })">Validate Integrations</button>
      <button onclick="vscode.postMessage({ command: 'showLogs' })">Show Logs</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
  }
}
