import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { ConstellationGraph } from './components/ConstellationGraph';
import { TraceCards } from './components/TraceCards';
import { AgentTraceTerminal } from './components/AgentTraceTerminal';
import { OverviewView } from './components/OverviewView';
import { TimelineView } from './components/TimelineView';
import { SessionView } from './components/SessionView';
import {
  ActivityEvent,
  AdapterHealth,
  ExtensionToWebviewMessage,
  GraphEdge,
  GraphNode,
  SessionRecord,
  WebviewToExtensionMessage,
  WorkspaceStats
} from '../types/events';

// Safe VS Code API bridge
declare function acquireVsCodeApi(): {
  postMessage: (msg: WebviewToExtensionMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;
try {
  vscodeApi = acquireVsCodeApi();
} catch {
  // Running in standard browser / mock
  vscodeApi = null;
}

const defaultStats: WorkspaceStats = {
  totalFiles: 0,
  totalFolders: 0,
  totalConnections: 0,
  touchedCount: 0,
  readCount: 0,
  writeCount: 0,
  toolCallCount: 0,
  topFolders: []
};

export const App: React.FC = () => {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [stats, setStats] = useState<WorkspaceStats>(defaultStats);
  const [adapters, setAdapters] = useState<AdapterHealth[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [sessionsList, setSessionsList] = useState<SessionRecord[]>([]);

  const [activeView, setActiveView] = useState<'graph' | 'overview' | 'timeline' | 'sessions'>('graph');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllLabels, setShowAllLabels] = useState<boolean>(false);
  const [attentionOnly, setAttentionOnly] = useState<boolean>(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'active' | 'paused' | 'stopped'>('active');

  const postMessage = useCallback((msg: WebviewToExtensionMessage) => {
    if (vscodeApi) {
      vscodeApi.postMessage(msg);
    } else {
      console.log('[Webview -> Extension mock]', msg);
    }
  }, []);

  // Listen to incoming messages from extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'INITIAL_STATE':
          setSession(msg.session);
          setStats(msg.stats);
          setAdapters(msg.adapters);
          setEvents(msg.events);
          setNodes(msg.nodes);
          setEdges(msg.edges);
          setSessionsList(msg.sessionsList);
          setRecordingStatus(msg.session.recordingStatus);
          break;

        case 'EVENT_ADDED':
          setEvents((prev) => [...prev.slice(-499), msg.event]);
          setStats(msg.stats);
          if (msg.updatedNode) {
            setNodes((prevNodes) =>
              prevNodes.map((n) => (n.id === msg.updatedNode!.id ? msg.updatedNode! : n))
            );
          }
          break;

        case 'RECORDING_STATUS_CHANGED':
          setRecordingStatus(msg.status);
          break;

        case 'ADAPTERS_UPDATED':
          setAdapters(msg.adapters);
          break;

        case 'GRAPH_UPDATED':
          setNodes(msg.nodes);
          setEdges(msg.edges);
          setStats(msg.stats);
          break;

        case 'SESSIONS_LIST_UPDATED':
          setSessionsList(msg.sessions);
          break;

        case 'REPLAY_EVENTS':
          setEvents(msg.events);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial state on mount
    postMessage({ type: 'GET_INITIAL_STATE' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [postMessage]);

  const handleOpenFile = (filePath: string) => {
    postMessage({ type: 'OPEN_FILE', filePath });
  };

  const handleSelectSession = (sessionId: string) => {
    postMessage({ type: 'SELECT_SESSION', sessionId });
  };

  const handleExportSession = (sessionId: string) => {
    postMessage({ type: 'EXPORT_SESSION', sessionId });
  };

  const handleDeleteSession = (sessionId: string) => {
    postMessage({ type: 'DELETE_SESSION', sessionId });
  };

  const handleTriggerReplay = () => {
    setActiveView('sessions');
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        seenCount={stats.touchedCount}
        totalFiles={stats.totalFiles}
        recordingStatus={recordingStatus}
        activeView={activeView}
        onSelectView={setActiveView}
      />

      {/* Main Viewport */}
      {activeView === 'graph' && (
        <div className="main-viewport">
          <LeftPanel
            stats={stats}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
            showAllLabels={showAllLabels}
            onToggleShowAllLabels={setShowAllLabels}
            attentionOnly={attentionOnly}
            onToggleAttentionOnly={setAttentionOnly}
          />

          <ConstellationGraph
            nodes={nodes}
            edges={edges}
            searchQuery={searchQuery}
            showAllLabels={showAllLabels}
            attentionOnly={attentionOnly}
            selectedFolder={selectedFolder}
            onSelectNode={(node) => console.log('Selected node:', node)}
            onOpenFile={handleOpenFile}
            onTriggerReplay={handleTriggerReplay}
          />

          <AgentTraceTerminal events={events} onOpenFile={handleOpenFile} />

          <TraceCards events={events} onOpenFile={handleOpenFile} />
        </div>
      )}

      {activeView === 'overview' && (
        <OverviewView
          session={session}
          stats={stats}
          adapters={adapters}
          events={events}
          onOpenFile={handleOpenFile}
        />
      )}

      {activeView === 'timeline' && (
        <TimelineView events={events} onOpenFile={handleOpenFile} />
      )}

      {activeView === 'sessions' && (
        <SessionView
          sessions={sessionsList}
          currentSessionId={session?.id || ''}
          onSelectSession={handleSelectSession}
          onExportSession={handleExportSession}
          onDeleteSession={handleDeleteSession}
        />
      )}
    </div>
  );
};
