import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from '../types/events';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  public static readonly viewType = 'aiActivityVisualizer.dashboard';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _onMessageCallback: ((msg: WebviewToExtensionMessage) => void) | null = null;

  public static createOrShow(
    extensionUri: vscode.Uri,
    onMessage: (msg: WebviewToExtensionMessage) => void
  ): DashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'Agent Brain',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, onMessage);
    return DashboardPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    onMessage: (msg: WebviewToExtensionMessage) => void
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._onMessageCallback = onMessage;

    // Set panel icon
    this._panel.iconPath = {
      light: vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg'),
      dark: vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg')
    };

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        if (this._onMessageCallback) {
          this._onMessageCallback(message);
        }
      },
      null,
      this._disposables
    );
  }

  public postMessage(message: ExtensionToWebviewMessage): void {
    this._panel.webview.postMessage(message);
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js');
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css');
    const styleUri = webview.asWebviewUri(stylePathOnDisk);

    const nonce = crypto.randomBytes(16).toString('base64');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; connect-src http://127.0.0.1:* ws://127.0.0.1:*;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Brain</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
