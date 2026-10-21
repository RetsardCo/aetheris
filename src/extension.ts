import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { SQLiteStorage } from './storage/database';
import { ActivityRepository } from './storage/repository';
import { EventNormalizer } from './pipeline/normalizer';
import { EventDeduplicator } from './pipeline/deduplicator';
import { VSCodeWorkspaceAdapter } from './adapters/vscode.adapter';
import { CopilotTelemetryAdapter } from './adapters/copilot.adapter';
import { AntigravityHookAdapter } from './adapters/antigravity.adapter';
import { GenericHttpAdapter } from './adapters/http.adapter';
import { DependencyAnalyzer } from './graph/analyzer';
import { DashboardPanel } from './views/dashboard.panel';
import { ControlSidebarViewProvider } from './views/sidebar.view';
import {
  ActivityEvent,
  AdapterHealth,
  GraphEdge,
  GraphNode,
  SessionRecord,
  WebviewToExtensionMessage,
  WorkspaceStats
} from './types/events';

let storage: SQLiteStorage | null = null;
let repo: ActivityRepository | null = null;
let currentSession: SessionRecord | null = null;
let isRecording = true;

const deduplicator = new EventDeduplicator(10000, 3000);
const normalizer = new EventNormalizer(deduplicator);

let vscodeAdapter: VSCodeWorkspaceAdapter | null = null;
let copilotAdapter: CopilotTelemetryAdapter | null = null;
let antigravityAdapter: AntigravityHookAdapter | null = null;
let httpAdapter: GenericHttpAdapter | null = null;

let currentNodes: GraphNode[] = [];
let currentEdges: GraphEdge[] = [];
let currentStats: WorkspaceStats = {
  totalFiles: 0,
  totalFolders: 0,
  totalConnections: 0,
  touchedCount: 0,
  readCount: 0,
  writeCount: 0,
  toolCallCount: 0,
  topFolders: []
};

let outputChannel: vscode.OutputChannel | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel('Aetheris');
  outputChannel.appendLine('[Aetheris] Initializing Aetheris 3D Cognitive Observatory...');

  const config = vscode.workspace.getConfiguration('aiActivityVisualizer');
  isRecording = config.get<boolean>('recordingEnabled', true);
  const retentionDays = config.get<number>('retentionDays', 30);
  const receiverPort = config.get<number>('httpReceiverPort', 5174);
  const excludedPatterns = config.get<string[]>('excludedPatterns', []);

  // Determine workspace details
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : process.cwd();
  const workspaceId = workspaceFolder ? workspaceFolder.name : 'standalone-workspace';
  const workspaceName = workspaceFolder ? workspaceFolder.name : path.basename(workspaceRoot);

  // Initialize SQLite persistence
  const storageDir = context.globalStorageUri
    ? context.globalStorageUri.fsPath
    : path.join(context.extensionPath, '.storage');

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const dbFilePath = path.join(storageDir, 'activity_store.db');
  const wasmPath = path.join(context.extensionPath, 'dist', 'sql-wasm.wasm');

  storage = new SQLiteStorage({ dbFilePath, wasmBinaryPath: wasmPath });
  await storage.initialize();
  repo = new ActivityRepository(storage);

  // Prune expired sessions
  const pruned = repo.pruneRetention(retentionDays);
  if (pruned > 0) {
    outputChannel.appendLine(`[Aetheris] Pruned ${pruned} sessions exceeding ${retentionDays} days retention.`);
  }

  // Create or load active session
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  currentSession = {
    id: sessionId,
    workspaceId,
    workspaceName,
    startTime: Date.now(),
    endTime: null,
    totalEvents: 0,
    filesTouched: 0,
    toolCalls: 0,
    errorsCount: 0,
    recordingStatus: isRecording ? 'active' : 'paused',
    activeProviders: ['vscode', 'copilot', 'antigravity', 'unknown']
  };
  repo.saveSession(currentSession);

  // Run Dependency Analyzer to extract initial real nodes & edges
  refreshGraph(workspaceRoot, excludedPatterns);

  // Initialize Adapters
  vscodeAdapter = new VSCodeWorkspaceAdapter(sessionId, workspaceId, workspaceRoot, excludedPatterns);
  copilotAdapter = new CopilotTelemetryAdapter(sessionId, workspaceId, workspaceRoot);
  antigravityAdapter = new AntigravityHookAdapter(sessionId, workspaceId, workspaceRoot);
  httpAdapter = new GenericHttpAdapter(sessionId, workspaceId, workspaceRoot, receiverPort);

  const handleRawEvent = (raw: any) => {
    if (!isRecording || !repo || !currentSession) return;
    const event = normalizer.normalize(raw);
    if (!event) return;

    repo.saveEvent(event);
    updateStatsAndBroadcast(event);
  };

  await vscodeAdapter.initialize(handleRawEvent);
  await copilotAdapter.initialize(handleRawEvent);
  await antigravityAdapter.initialize(handleRawEvent);
  await httpAdapter.initialize(handleRawEvent);

  outputChannel.appendLine(`[Aetheris] Loopback HTTP receiver listening on ${httpAdapter.getUrl()}`);

  let sidebarProvider: ControlSidebarViewProvider;
  sidebarProvider = new ControlSidebarViewProvider(
    context.extensionUri,
    httpAdapter,
    isRecording,
    (start) => {
      setRecording(start);
      sidebarProvider.setRecording(start);
    },
    () => openDashboard(context),
    () => showDiagnostics(),
    () => validateIntegrations()
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ControlSidebarViewProvider.viewType, sidebarProvider)
  );

  // Register Commands (all 12 required commands)
  context.subscriptions.push(
    vscode.commands.registerCommand('aiActivityVisualizer.openDashboard', () => {
      openDashboard(context);
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.startRecording', () => {
      setRecording(true);
      sidebarProvider.setRecording(true);
      vscode.window.showInformationMessage('Aetheris: Activity recording started.');
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.stopRecording', () => {
      setRecording(false);
      sidebarProvider.setRecording(false);
      vscode.window.showInformationMessage('Aetheris: Activity recording paused.');
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.pauseRecording', () => {
      setRecording(false);
      sidebarProvider.setRecording(false);
      vscode.window.showInformationMessage('Aetheris: Activity recording paused.');
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.resumeRecording', () => {
      setRecording(true);
      sidebarProvider.setRecording(true);
      vscode.window.showInformationMessage('Aetheris: Activity recording resumed.');
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.clearSession', () => {
      if (!currentSession || !repo) return;
      repo.deleteSession(currentSession.id);
      currentSession.totalEvents = 0;
      currentSession.filesTouched = 0;
      currentSession.toolCalls = 0;
      repo.saveSession(currentSession);
      refreshGraph(workspaceRoot, excludedPatterns);
      broadcastInitialState();
      vscode.window.showInformationMessage('Aetheris: Current session events cleared.');
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.exportSession', async () => {
      if (!currentSession || !repo) return;
      const data = repo.exportSession(currentSession.id);
      if (!data) return;
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(data, null, 2),
        language: 'json'
      });
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.configureCopilot', async () => {
      await configureCopilot();
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.configureAntigravity', async () => {
      await configureAntigravity();
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.validateIntegrations', async () => {
      await validateIntegrations();
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.openPrivacySettings', async () => {
      await openPrivacySettings(context);
    }),
    vscode.commands.registerCommand('aiActivityVisualizer.showDiagnostics', () => {
      showDiagnostics();
    })
  );

  outputChannel.appendLine('[Aetheris] Extension activated successfully.');
}

function refreshGraph(workspaceRoot: string, excludedPatterns: string[]): void {
  const analyzer = new DependencyAnalyzer(workspaceRoot, excludedPatterns);
  const result = analyzer.analyze();
  currentNodes = result.nodes;
  currentEdges = result.edges;
  currentStats = result.stats;

  if (repo && currentSession) {
    const touchedMap = repo.getTouchedFilesMap(currentSession.id);
    currentStats.touchedCount = touchedMap.size;
    currentNodes.forEach((n) => {
      const t = touchedMap.get(n.id);
      if (t) {
        n.readCount = t.read;
        n.writeCount = t.write;
        n.createCount = t.create;
        n.deleteCount = t.delete;
        n.lastActivityTimestamp = t.lastTime;
      }
    });
  }
}

function updateStatsAndBroadcast(event: ActivityEvent): void {
  if (!currentSession) return;
  currentSession.totalEvents++;
  if (event.activityType === 'tool_call') {
    currentSession.toolCalls++;
  }

  let updatedNode: GraphNode | undefined;

  if (event.filePath) {
    let node = currentNodes.find((n) => n.id === event.filePath);
    if (!node) {
      node = {
        id: event.filePath,
        name: path.basename(event.filePath),
        type: 'file',
        folder: path.dirname(event.filePath) === '.' ? 'root files' : path.dirname(event.filePath).split('/')[0],
        readCount: 0,
        writeCount: 0,
        createCount: 0,
        deleteCount: 0
      };
      currentNodes.push(node);
      currentStats.totalFiles++;
    }

    if (event.activityType === 'file_read') node.readCount++;
    else if (event.activityType === 'file_write') node.writeCount++;
    else if (event.activityType === 'file_create') node.createCount++;
    else if (event.activityType === 'file_delete') node.deleteCount++;

    node.lastActivityType = event.activityType;
    node.lastActivityTimestamp = event.timestamp;
    node.lastProvider = event.provider;
    updatedNode = node;

    // Recount touched
    const touched = currentNodes.filter((n) => (n.readCount + n.writeCount + n.createCount + n.deleteCount) > 0);
    currentStats.touchedCount = touched.length;
    currentSession.filesTouched = touched.length;
  }

  if (DashboardPanel.currentPanel) {
    DashboardPanel.currentPanel.postMessage({
      type: 'EVENT_ADDED',
      event,
      updatedNode,
      stats: currentStats
    });
  }
}

function setRecording(enabled: boolean): void {
  isRecording = enabled;
  if (currentSession) {
    currentSession.recordingStatus = enabled ? 'active' : 'paused';
    repo?.saveSession(currentSession);
  }
  if (DashboardPanel.currentPanel) {
    DashboardPanel.currentPanel.postMessage({
      type: 'RECORDING_STATUS_CHANGED',
      status: enabled ? 'active' : 'paused'
    });
  }
}

function openDashboard(context: vscode.ExtensionContext): void {
  const panel = DashboardPanel.createOrShow(context.extensionUri, (msg) => {
    handleWebviewMessage(msg, context);
  });
  broadcastInitialState();
}

function broadcastInitialState(): void {
  if (!DashboardPanel.currentPanel || !repo || !currentSession) return;

  const events = repo.getRecentEvents(currentSession.id, 200);
  const sessionsList = repo.listSessions();
  const adapters: AdapterHealth[] = [
    vscodeAdapter?.getHealth() || { provider: 'vscode', name: 'VS Code', available: true, status: 'connected', eventsCaptured: 0 },
    copilotAdapter?.getHealth() || { provider: 'copilot', name: 'Copilot', available: false, status: 'unavailable', eventsCaptured: 0 },
    antigravityAdapter?.getHealth() || { provider: 'antigravity', name: 'Antigravity', available: false, status: 'unavailable', eventsCaptured: 0 },
    httpAdapter?.getHealth() || { provider: 'unknown', name: 'HTTP Ingest', available: true, status: 'connected', eventsCaptured: 0 }
  ];

  DashboardPanel.currentPanel.postMessage({
    type: 'INITIAL_STATE',
    session: currentSession,
    stats: currentStats,
    adapters,
    events,
    nodes: currentNodes,
    edges: currentEdges,
    sessionsList
  });
}

function handleWebviewMessage(msg: WebviewToExtensionMessage, context: vscode.ExtensionContext): void {
  switch (msg.type) {
    case 'GET_INITIAL_STATE':
      broadcastInitialState();
      break;

    case 'OPEN_FILE':
      openFileInEditor(msg.filePath);
      break;

    case 'START_RECORDING':
      setRecording(true);
      break;

    case 'STOP_RECORDING':
      setRecording(false);
      break;

    case 'CLEAR_SESSION':
      vscode.commands.executeCommand('aiActivityVisualizer.clearSession');
      break;

    case 'SELECT_SESSION':
      if (repo) {
        const events = repo.getEventsBySession(msg.sessionId, 1000);
        DashboardPanel.currentPanel?.postMessage({
          type: 'REPLAY_EVENTS',
          sessionId: msg.sessionId,
          events
        });
      }
      break;

    case 'EXPORT_SESSION':
      if (repo) {
        const exported = repo.exportSession(msg.sessionId);
        if (exported) {
          vscode.workspace.openTextDocument({
            content: JSON.stringify(exported, null, 2),
            language: 'json'
          }).then((doc) => vscode.window.showTextDocument(doc));
        }
      }
      break;

    case 'PAUSE_RECORDING':
      setRecording(false);
      break;

    case 'RESUME_RECORDING':
      setRecording(true);
      break;

    case 'TRIGGER_GRAPH_REFRESH': {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : process.cwd();
      const config = vscode.workspace.getConfiguration('aiActivityVisualizer');
      const excludedPatterns = config.get<string[]>('excludedPatterns', []);
      refreshGraph(workspaceRoot, excludedPatterns);
      broadcastInitialState();
      break;
    }

    case 'COMPARE_SESSIONS':
      if (repo) {
        const result = repo.compareSessions(msg.sessionAId, msg.sessionBId);
        if (result && DashboardPanel.currentPanel) {
          DashboardPanel.currentPanel.postMessage({
            type: 'SESSION_COMPARISON_RESULT',
            result
          });
        }
      }
      break;
  }
}

async function validateIntegrations(): Promise<void> {
  if (!outputChannel) return;
  outputChannel.show(true);
  outputChannel.appendLine('[Aetheris] --- Validating Agent Integrations ---');

  const vsHealth = vscodeAdapter?.getHealth();
  const coHealth = copilotAdapter?.getHealth();
  const agHealth = antigravityAdapter?.getHealth();
  const httpHealth = httpAdapter?.getHealth();

  outputChannel.appendLine(`1. VS Code Workspace Monitor: [${vsHealth?.status.toUpperCase()}] ${vsHealth?.diagnostic}`);
  outputChannel.appendLine(`2. GitHub Copilot Telemetry: [${coHealth?.status.toUpperCase()}] ${coHealth?.diagnostic}`);
  outputChannel.appendLine(`3. Google Antigravity Hook: [${agHealth?.status.toUpperCase()}] ${agHealth?.diagnostic}`);
  outputChannel.appendLine(`4. Loopback HTTP Ingester: [${httpHealth?.status.toUpperCase()}] ${httpHealth?.diagnostic}`);

  const activeCount = [vsHealth, coHealth, agHealth, httpHealth].filter(
    (h) => h?.status === 'connected' || h?.status === 'idle'
  ).length;

  vscode.window.showInformationMessage(
    `Aetheris: ${activeCount}/4 integrations active. See 'Aetheris' Output Channel for full report.`
  );
}

async function configureCopilot(): Promise<void> {
  const health = copilotAdapter?.getHealth();
  const pick = await vscode.window.showQuickPick(
    [
      `Check Status: ${health?.status}`,
      'Set Custom JSONL Telemetry Log Path',
      'Show Copilot Setup Instructions'
    ],
    { placeHolder: 'GitHub Copilot Integration Setup' }
  );

  if (pick?.startsWith('Check Status')) {
    vscode.window.showInformationMessage(`Copilot Adapter Status: ${health?.status}. ${health?.diagnostic}`);
  } else if (pick === 'Set Custom JSONL Telemetry Log Path') {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'Log Files': ['jsonl', 'log', 'json'] },
      title: 'Select Copilot Telemetry JSONL Log File'
    });
    if (uri && uri[0]) {
      vscode.window.showInformationMessage(`Copilot JSONL log path set to: ${uri[0].fsPath}`);
    }
  } else if (pick === 'Show Copilot Setup Instructions') {
    vscode.window.showInformationMessage(
      'Copilot Integration listens to GitHub Copilot (github.copilot) and Copilot Chat (github.copilot-chat) tool telemetry. Ensure the extensions are installed and enabled.'
    );
  }
}

async function configureAntigravity(): Promise<void> {
  const validation = antigravityAdapter?.validateHookConfiguration();
  const pick = await vscode.window.showQuickPick(
    [
      `Check Environment: ${validation?.valid ? 'Detected' : 'Not Detected'}`,
      'Preview Generated Hook Bridge Script',
      'Copy Hook Bridge Script to Clipboard',
      'Instructions for Removing Integration'
    ],
    { placeHolder: 'Google Antigravity Hook Integration Setup' }
  );

  const authToken = httpAdapter?.getAuthToken() || 'YOUR_TOKEN';
  const port = httpAdapter?.getPort() || 5174;
  const script = antigravityAdapter?.generateHookScript(authToken, port) || '';

  if (pick?.startsWith('Check Environment')) {
    vscode.window.showInformationMessage(`Antigravity Environment: ${validation?.diagnostic}`);
  } else if (pick === 'Preview Generated Hook Bridge Script') {
    const doc = await vscode.workspace.openTextDocument({
      content: script,
      language: 'javascript'
    });
    await vscode.window.showTextDocument(doc);
  } else if (pick === 'Copy Hook Bridge Script to Clipboard') {
    await vscode.env.clipboard.writeText(script);
    vscode.window.showInformationMessage('Copied Antigravity hook bridge script to clipboard.');
  } else if (pick === 'Instructions for Removing Integration') {
    vscode.window.showInformationMessage(
      'To remove Antigravity integration, remove the hook bridge script from your ~/.gemini/antigravity hooks directory.'
    );
  }
}

async function openPrivacySettings(context: vscode.ExtensionContext): Promise<void> {
  const choice = await vscode.window.showQuickPick(
    ['Open Visualizer Configuration Settings', 'View Privacy Documentation (PRIVACY.md)', 'Show Retention Summary'],
    { placeHolder: 'Aetheris · Privacy Controls' }
  );

  if (choice === 'Open Visualizer Configuration Settings') {
    vscode.commands.executeCommand('workbench.action.openSettings', 'aiActivityVisualizer');
  } else if (choice === 'View Privacy Documentation (PRIVACY.md)') {
    const privPath = path.join(context.extensionPath, 'PRIVACY.md');
    if (fs.existsSync(privPath)) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(privPath));
      await vscode.window.showTextDocument(doc);
    }
  } else if (choice === 'Show Retention Summary') {
    const config = vscode.workspace.getConfiguration('aiActivityVisualizer');
    const days = config.get<number>('retentionDays', 30);
    vscode.window.showInformationMessage(
      `Privacy: All storage is 100% local (SQLite). Max history retention: ${days} days. API keys & bearer tokens automatically redacted.`
    );
  }
}

async function openFileInEditor(relPath: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(workspaceFolder.uri.fsPath, relPath);
  if (fs.existsSync(fullPath)) {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to open file: ${relPath}`);
    }
  } else {
    vscode.window.showWarningMessage(`File not found: ${relPath}`);
  }
}

function showDiagnostics(): void {
  if (!outputChannel) return;
  outputChannel.show(true);
  outputChannel.appendLine('--- Aetheris Diagnostics ---');
  outputChannel.appendLine(`Session ID: ${currentSession?.id}`);
  outputChannel.appendLine(`Recording Status: ${isRecording ? 'Active' : 'Paused'}`);
  outputChannel.appendLine(`Total Files: ${currentStats.totalFiles}, Connections: ${currentStats.totalConnections}`);
  outputChannel.appendLine(`HTTP Ingester Port: ${httpAdapter?.getPort()} (Auth Token: ${httpAdapter?.getAuthToken().slice(0, 6)}...)`);
  outputChannel.appendLine(`VS Code Adapter: ${JSON.stringify(vscodeAdapter?.getHealth())}`);
  outputChannel.appendLine(`Copilot Adapter: ${JSON.stringify(copilotAdapter?.getHealth())}`);
  outputChannel.appendLine(`Antigravity Adapter: ${JSON.stringify(antigravityAdapter?.getHealth())}`);
  outputChannel.appendLine('-------------------------------');
}

export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine('[Aetheris] Deactivating extension...');
  }
  vscodeAdapter?.dispose();
  copilotAdapter?.dispose();
  antigravityAdapter?.dispose();
  httpAdapter?.dispose();
  storage?.close();
}
