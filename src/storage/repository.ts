import { ActivityEvent, ActivityType, EvidenceLevel, GraphEdge, Provider, SessionRecord, SessionComparisonResult } from '../types/events';
import { redactString, sanitizeMetadata } from '../pipeline/redactor';
import { SQLiteStorage } from './database';

export class ActivityRepository {
  private storage: SQLiteStorage;

  constructor(storage: SQLiteStorage) {
    this.storage = storage;
  }

  // --- Sessions ---

  public saveSession(session: SessionRecord): void {
    const sql = `
      INSERT OR REPLACE INTO sessions (
        id, workspace_id, workspace_name, start_time, end_time,
        total_events, files_touched, tool_calls, errors_count,
        recording_status, active_providers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    this.storage.run(sql, [
      session.id,
      session.workspaceId,
      session.workspaceName,
      session.startTime,
      session.endTime,
      session.totalEvents,
      session.filesTouched,
      session.toolCalls,
      session.errorsCount,
      session.recordingStatus,
      JSON.stringify(session.activeProviders)
    ]);
  }

  public getSession(id: string): SessionRecord | null {
    const rows = this.storage.query('SELECT * FROM sessions WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return null;
    return this.mapSessionObject(rows[0]);
  }

  public listSessions(): SessionRecord[] {
    const rows = this.storage.query('SELECT * FROM sessions ORDER BY start_time DESC');
    return rows.map((r) => this.mapSessionObject(r));
  }

  public deleteSession(sessionId: string): void {
    this.storage.run('DELETE FROM events WHERE session_id = ?', [sessionId]);
    this.storage.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }

  // --- Events ---

  public saveEvent(event: ActivityEvent): void {
    const sql = `
      INSERT OR REPLACE INTO events (
        id, session_id, timestamp, ingestion_timestamp, provider, source,
        activity_type, evidence_level, workspace_id, file_path, previous_path,
        tool_name, duration_ms, success, correlation_id, metadata, code_snippet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    this.storage.run(sql, [
      event.id,
      event.sessionId,
      event.timestamp,
      event.ingestionTimestamp,
      event.provider,
      event.source,
      event.activityType,
      event.evidenceLevel,
      event.workspaceId,
      event.filePath || null,
      event.previousPath || null,
      event.toolName || null,
      event.durationMs ?? null,
      event.success === null || event.success === undefined ? null : event.success ? 1 : 0,
      event.correlationId || null,
      JSON.stringify(event.metadata || {}),
      event.codeSnippet || null
    ]);

    // Increment session event count
    this.storage.run('UPDATE sessions SET total_events = total_events + 1 WHERE id = ?', [event.sessionId]);
  }

  public getEventsBySession(sessionId: string, limit = 500, offset = 0): ActivityEvent[] {
    const rows = this.storage.query(
      'SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?',
      [sessionId, limit, offset]
    );
    return rows.map((r) => this.mapEventObject(r));
  }

  public getRecentEvents(sessionId: string, limit = 50): ActivityEvent[] {
    const rows = this.storage.query(
      'SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?',
      [sessionId, limit]
    );
    return rows.map((r) => this.mapEventObject(r)).reverse();
  }

  public getTouchedFilesMap(sessionId: string): Map<string, { read: number; write: number; create: number; delete: number; lastTime: number }> {
    const map = new Map<string, { read: number; write: number; create: number; delete: number; lastTime: number }>();
    const rows = this.storage.query<{ file_path: string; activity_type: string; last_time: number; cnt: number }>(
      'SELECT file_path, activity_type, MAX(timestamp) as last_time, COUNT(*) as cnt FROM events WHERE session_id = ? AND file_path IS NOT NULL GROUP BY file_path, activity_type',
      [sessionId]
    );

    for (const row of rows) {
      const filePath = row.file_path;
      const actType = row.activity_type;
      const lastTime = row.last_time;
      const cnt = row.cnt;

      let entry = map.get(filePath);
      if (!entry) {
        entry = { read: 0, write: 0, create: 0, delete: 0, lastTime: 0 };
        map.set(filePath, entry);
      }
      if (lastTime > entry.lastTime) entry.lastTime = lastTime;

      if (actType === 'file_read') entry.read += cnt;
      else if (actType === 'file_write') entry.write += cnt;
      else if (actType === 'file_create') entry.create += cnt;
      else if (actType === 'file_delete') entry.delete += cnt;
    }

    return map;
  }

  // --- Dependency Edges ---

  public saveDependencyEdges(edges: GraphEdge[], workspaceId: string): void {
    if (!edges.length) return;
    this.storage.run('BEGIN TRANSACTION;');
    this.storage.run('DELETE FROM dependency_edges WHERE workspace_id = ?', [workspaceId]);
    const now = Date.now();
    for (const edge of edges) {
      this.storage.run(
        `INSERT OR REPLACE INTO dependency_edges (id, workspace_id, source, target, type, confidence, provenance, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [edge.id, workspaceId, edge.source, edge.target, edge.type, edge.confidence, edge.provenance, now]
      );
    }
    this.storage.run('COMMIT;');
  }

  public getDependencyEdges(workspaceId: string): GraphEdge[] {
    const rows = this.storage.query<{ id: string; source: string; target: string; type: string; confidence: number; provenance: string }>(
      'SELECT id, source, target, type, confidence, provenance FROM dependency_edges WHERE workspace_id = ?',
      [workspaceId]
    );
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      type: r.type as 'import' | 'activity_flow',
      confidence: r.confidence,
      provenance: r.provenance
    }));
  }

  // --- Pruning Retention ---

  public pruneRetention(retentionDays: number): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const expired = this.storage.query<{ id: string }>('SELECT id FROM sessions WHERE start_time < ?', [cutoff]);
    if (!expired.length) return 0;

    this.storage.run('BEGIN TRANSACTION;');
    for (const s of expired) {
      this.storage.run('DELETE FROM events WHERE session_id = ?', [s.id]);
      this.storage.run('DELETE FROM sessions WHERE id = ?', [s.id]);
    }
    this.storage.run('COMMIT;');
    return expired.length;
  }

  // --- Session Comparison ---

  public compareSessions(sessionIdA: string, sessionIdB: string): SessionComparisonResult | null {
    const sA = this.getSession(sessionIdA);
    const sB = this.getSession(sessionIdB);
    if (!sA || !sB) return null;

    const mapA = this.getTouchedFilesMap(sessionIdA);
    const mapB = this.getTouchedFilesMap(sessionIdB);

    const setA = new Set(mapA.keys());
    const setB = new Set(mapB.keys());

    const filesTouchedAOnly = [...setA].filter((f) => !setB.has(f)).sort();
    const filesTouchedBOnly = [...setB].filter((f) => !setA.has(f)).sort();
    const filesTouchedBoth = [...setA].filter((f) => setB.has(f)).sort();

    const durationA = (sA.endTime || Date.now()) - sA.startTime;
    const durationB = (sB.endTime || Date.now()) - sB.startTime;

    return {
      sessionA: sA,
      sessionB: sB,
      durationDiffMs: Math.abs(durationA - durationB),
      eventsDiff: Math.abs(sA.totalEvents - sB.totalEvents),
      toolCallsDiff: Math.abs(sA.toolCalls - sB.toolCalls),
      filesTouchedAOnly,
      filesTouchedBOnly,
      filesTouchedBoth
    };
  }

  public exportSession(sessionId: string): { session: SessionRecord; events: ActivityEvent[] } | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    const rawEvents = this.getEventsBySession(sessionId, 50000, 0);

    // Apply export redaction for sensitive fields and secrets
    const redactedEvents = rawEvents.map((e) => ({
      ...e,
      metadata: sanitizeMetadata(e.metadata),
      codeSnippet: e.codeSnippet ? redactString(e.codeSnippet) : null
    }));

    return { session, events: redactedEvents };
  }

  // --- Object Mappers ---

  private mapSessionObject(obj: any): SessionRecord {
    let activeProviders: string[] = [];
    try {
      activeProviders = JSON.parse(obj.active_providers || '[]');
    } catch {
      activeProviders = [];
    }

    return {
      id: obj.id,
      workspaceId: obj.workspace_id,
      workspaceName: obj.workspace_name,
      startTime: obj.start_time,
      endTime: obj.end_time || null,
      totalEvents: obj.total_events || 0,
      filesTouched: obj.files_touched || 0,
      toolCalls: obj.tool_calls || 0,
      errorsCount: obj.errors_count || 0,
      recordingStatus: obj.recording_status,
      activeProviders
    };
  }

  private mapEventObject(obj: any): ActivityEvent {
    let metadata = {};
    try {
      metadata = JSON.parse(obj.metadata || '{}');
    } catch {
      metadata = {};
    }

    return {
      id: obj.id,
      sessionId: obj.session_id,
      timestamp: obj.timestamp,
      ingestionTimestamp: obj.ingestion_timestamp,
      provider: obj.provider as Provider,
      source: obj.source,
      activityType: obj.activity_type as ActivityType,
      evidenceLevel: obj.evidence_level as EvidenceLevel,
      workspaceId: obj.workspace_id,
      filePath: obj.file_path || null,
      previousPath: obj.previous_path || null,
      toolName: obj.tool_name || null,
      durationMs: obj.duration_ms,
      success: obj.success === null ? null : obj.success === 1,
      correlationId: obj.correlation_id || null,
      metadata,
      codeSnippet: obj.code_snippet || null
    };
  }
}
