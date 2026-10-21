import { z } from 'zod';

export const ProviderSchema = z.enum(['copilot', 'antigravity', 'vscode', 'unknown']);
export type Provider = z.infer<typeof ProviderSchema>;

export const EvidenceLevelSchema = z.enum(['explicit', 'observed', 'inferred']);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

export const ActivityTypeSchema = z.enum([
  'file_read',
  'file_write',
  'file_create',
  'file_delete',
  'file_rename',
  'editor_focus',
  'tool_call',
  'tool_result',
  'terminal_command',
  'agent_lifecycle'
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivityEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().positive(),
  ingestionTimestamp: z.number().int().positive(),
  sessionId: z.string().min(1),
  provider: ProviderSchema,
  source: z.string().min(1),
  activityType: ActivityTypeSchema,
  evidenceLevel: EvidenceLevelSchema,
  workspaceId: z.string(),
  filePath: z.string().nullable().optional(),
  previousPath: z.string().nullable().optional(),
  toolName: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  success: z.boolean().nullable().optional(),
  correlationId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  codeSnippet: z.string().nullable().optional()
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export interface SessionRecord {
  id: string;
  workspaceId: string;
  workspaceName: string;
  startTime: number;
  endTime: number | null;
  totalEvents: number;
  filesTouched: number;
  toolCalls: number;
  errorsCount: number;
  recordingStatus: 'active' | 'paused' | 'stopped';
  activeProviders: string[];
}

export interface GraphNode {
  id: string; // Relative path or folder path
  name: string;
  type: 'file' | 'folder';
  extension?: string;
  folder: string;
  readCount: number;
  writeCount: number;
  createCount: number;
  deleteCount: number;
  lastActivityType?: ActivityType;
  lastActivityTimestamp?: number;
  lastProvider?: Provider;
  isAttentionRequired?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'activity_flow';
  confidence: number;
  provenance: string; // e.g. "static_import_parser" or "explicit_tool_sequence"
}

export interface AdapterHealth {
  provider: Provider;
  name: string;
  available: boolean;
  status: 'connected' | 'idle' | 'unavailable' | 'error';
  lastEventTime?: number;
  eventsCaptured: number;
  diagnostic?: string;
}

export interface WorkspaceStats {
  totalFiles: number;
  totalFolders: number;
  totalConnections: number;
  touchedCount: number;
  readCount: number;
  writeCount: number;
  toolCallCount: number;
  topFolders: Array<{ path: string; count: number; color: string }>;
}

export interface SessionComparisonResult {
  sessionA: SessionRecord;
  sessionB: SessionRecord;
  durationDiffMs: number;
  eventsDiff: number;
  toolCallsDiff: number;
  filesTouchedAOnly: string[];
  filesTouchedBOnly: string[];
  filesTouchedBoth: string[];
}

// Webview Communication Messages
export type WebviewToExtensionMessage =
  | { type: 'GET_INITIAL_STATE' }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'PAUSE_RECORDING' }
  | { type: 'RESUME_RECORDING' }
  | { type: 'CLEAR_SESSION' }
  | { type: 'OPEN_FILE'; filePath: string }
  | { type: 'SELECT_SESSION'; sessionId: string }
  | { type: 'EXPORT_SESSION'; sessionId: string }
  | { type: 'DELETE_SESSION'; sessionId: string }
  | { type: 'COMPARE_SESSIONS'; sessionAId: string; sessionBId: string }
  | { type: 'TRIGGER_GRAPH_REFRESH' };

export type ExtensionToWebviewMessage =
  | {
      type: 'INITIAL_STATE';
      session: SessionRecord;
      stats: WorkspaceStats;
      adapters: AdapterHealth[];
      events: ActivityEvent[];
      nodes: GraphNode[];
      edges: GraphEdge[];
      sessionsList: SessionRecord[];
    }
  | {
      type: 'EVENT_ADDED';
      event: ActivityEvent;
      updatedNode?: GraphNode;
      stats: WorkspaceStats;
    }
  | {
      type: 'RECORDING_STATUS_CHANGED';
      status: 'active' | 'paused' | 'stopped';
    }
  | {
      type: 'ADAPTERS_UPDATED';
      adapters: AdapterHealth[];
    }
  | {
      type: 'GRAPH_UPDATED';
      nodes: GraphNode[];
      edges: GraphEdge[];
      stats: WorkspaceStats;
    }
  | {
      type: 'SESSIONS_LIST_UPDATED';
      sessions: SessionRecord[];
    }
  | {
      type: 'REPLAY_EVENTS';
      sessionId: string;
      events: ActivityEvent[];
    }
  | {
      type: 'SESSION_COMPARISON_RESULT';
      result: SessionComparisonResult;
    };
