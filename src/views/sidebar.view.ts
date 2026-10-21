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
  <title>Aetheris Sidebar</title>
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
  <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
    <svg width="28" height="28" viewBox="0 0 512 512" style="border-radius: 6px; flex-shrink: 0;"><defs><linearGradient id="sb-a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#74f7e8"/><stop offset=".52" stop-color="#50bdf6"/><stop offset="1" stop-color="#a78bfa"/></linearGradient><radialGradient id="sb-c" cx=".3" cy=".2" r=".8"><stop stop-color="#f4ffff"/><stop offset=".25" stop-color="#74f7e8"/><stop offset=".7" stop-color="#50bdf6"/><stop offset="1" stop-color="#8069e9"/></radialGradient><filter id="sb-g" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="512" height="512" rx="112" fill="#0b1020"/><g transform="translate(256 256)" fill="none" stroke="url(#sb-a)" stroke-linecap="round"><circle r="154" stroke-width="3" opacity=".26"/><ellipse rx="164" ry="75" transform="rotate(-38)" stroke-width="4"/><ellipse rx="164" ry="75" transform="rotate(48)" stroke-width="3" opacity=".72"/><path d="M-134 72 L-51 7 L-6 -64 L59 -43 L117 -116 M-109 -88 L-51 7 L27 78 L103 60 L143 3 M-51 7 L59 -43 L103 60 M27 78 L59 -43" stroke-width="2.5" opacity=".72"/><path d="M0 -185 V-145 M-185 0 H-145 M145 0 H185 M0 145 V185" stroke-width="2" opacity=".4"/></g><g filter="url(#sb-g)"><circle cx="122" cy="176" r="9" fill="#7df7e8"/><circle cx="205" cy="264" r="8" fill="#65e4ed"/><circle cx="315" cy="217" r="9" fill="#80ddff"/><circle cx="355" cy="319" r="7" fill="#a78bfa"/><circle cx="202" cy="342" r="6" fill="#6ad9f5"/><circle cx="319" cy="378" r="7" fill="#8c8bff"/><circle cx="373" cy="165" r="6" fill="#7df7e8"/></g><path d="M256 199 L301 225 L301 277 L256 303 L211 277 L211 225 Z" fill="#182f4b" stroke="url(#sb-a)" stroke-width="4"/><path d="M256 215 L286 232 L286 270 L256 287 L226 270 L226 232 Z" fill="url(#sb-c)" filter="url(#sb-g)"/><path d="M241 239 L256 230 L271 239 L271 257 L256 266 L241 257 Z" fill="#efffff"/></svg>
    <div>
      <div style="font-weight: 700; font-size: 13px; letter-spacing: 0.5px; color: #f8fafc;">AETHERIS</div>
      <div style="font-size: 10px; color: #64748b;">3D Cognitive Observatory</div>
    </div>
  </div>

  <div>
    <div class="section-title">SERVER</div>
    <div class="status-text">
      <span class="status-dot"></span>
      Aetheris: <strong>${statusText}</strong>
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
