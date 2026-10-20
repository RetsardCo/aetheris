import * as crypto from 'crypto';
import * as path from 'path';
import { ActivityEvent, ActivityEventSchema, ActivityType, EvidenceLevel, Provider } from '../types/events';
import { EventDeduplicator } from './deduplicator';
import { redactString, sanitizeMetadata } from './redactor';

export interface RawEventInput {
  id?: string;
  timestamp?: number;
  sessionId: string;
  provider: Provider;
  source: string;
  activityType: ActivityType;
  evidenceLevel?: EvidenceLevel;
  workspaceId: string;
  workspaceRoot?: string;
  filePath?: string | null;
  previousPath?: string | null;
  toolName?: string | null;
  durationMs?: number | null;
  success?: boolean | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
  codeSnippet?: string | null;
}

export class EventNormalizer {
  private deduplicator: EventDeduplicator;

  constructor(deduplicator?: EventDeduplicator) {
    this.deduplicator = deduplicator ?? new EventDeduplicator();
  }

  public normalizePath(rawPath: string | null | undefined, workspaceRoot?: string): string | null {
    if (!rawPath) return null;
    let clean = rawPath.replace(/\\/g, '/');

    if (workspaceRoot) {
      const cleanRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
      if (clean.toLowerCase().startsWith(cleanRoot.toLowerCase())) {
        clean = clean.slice(cleanRoot.length);
      }
    }

    clean = clean.replace(/^\/+/, '');
    return clean || null;
  }

  public normalize(input: RawEventInput): ActivityEvent | null {
    const now = Date.now();
    const timestamp = typeof input.timestamp === 'number' && input.timestamp > 0 ? input.timestamp : now;
    const ingestionTimestamp = now;

    // Normalizing file paths
    const filePath = this.normalizePath(input.filePath, input.workspaceRoot);
    const previousPath = this.normalizePath(input.previousPath, input.workspaceRoot);

    // Default evidence level according to source contract
    let evidenceLevel: EvidenceLevel = input.evidenceLevel || 'observed';
    if (!input.evidenceLevel) {
      if (input.provider === 'copilot' || input.provider === 'antigravity') {
        evidenceLevel = 'explicit';
      } else if (input.source.startsWith('vscode.')) {
        evidenceLevel = 'observed';
      } else {
        evidenceLevel = 'inferred';
      }
    }

    // Never allow an observed editor/fs event to claim explicit unless coming directly from an agent hook
    if (input.source.startsWith('vscode.') && evidenceLevel === 'explicit') {
      evidenceLevel = 'observed';
    }

    // Stable ID or fallback
    const id = input.id || `evt_${now}_${Math.random().toString(36).slice(2, 10)}`;

    // Deduplication check
    const fingerprint = this.deduplicator.generateFingerprint(
      input.provider,
      input.activityType,
      filePath,
      input.toolName,
      timestamp
    );

    if (this.deduplicator.isDuplicate(id, fingerprint)) {
      return null;
    }

    // Sanitize metadata & snippet
    const sanitizedMeta = sanitizeMetadata(input.metadata || {});
    const cleanSnippet = input.codeSnippet ? redactString(input.codeSnippet.slice(0, 1024)) : null;

    const candidate: ActivityEvent = {
      id,
      timestamp,
      ingestionTimestamp,
      sessionId: input.sessionId,
      provider: input.provider,
      source: input.source,
      activityType: input.activityType,
      evidenceLevel,
      workspaceId: input.workspaceId,
      filePath,
      previousPath,
      toolName: input.toolName || null,
      durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
      success: typeof input.success === 'boolean' ? input.success : null,
      correlationId: input.correlationId || null,
      metadata: sanitizedMeta,
      codeSnippet: cleanSnippet
    };

    const parseResult = ActivityEventSchema.safeParse(candidate);
    if (!parseResult.success) {
      console.warn('Event schema validation failed:', parseResult.error);
      return null;
    }

    return parseResult.data;
  }
}
