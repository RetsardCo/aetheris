import { ActivityEvent, ActivityType, EvidenceLevel, GraphEdge, Provider, SessionRecord } from '../types/events';
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
    const res = this.storage.exec(`SELECT * FROM sessions WHERE id = "${id}" LIMIT 1`);
    if (!res.length || !res[0].values.length) return null;
    return this.mapSessionRow(res[0].columns, res[0].values[0]);
  }

  public listSessions(): SessionRecord[] {
    const res = this.storage.exec('SELECT * FROM sessions ORDER BY start_time DESC');
    if (!res.length) return [];
    return res[0].values.map((row: any[]) => this.mapSessionRow(res[0].columns, row));
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
    const res = this.storage.exec(`
      SELECT * FROM events 
      WHERE session_id = "${sessionId}" 
      ORDER BY timestamp ASC 
      LIMIT ${limit} OFFSET ${offset}
    `);
    if (!res.length) return [];
    return res[0].values.map((row: any[]) => this.mapEventRow(res[0].columns, row));
  }

  public getRecentEvents(sessionId: string, limit = 50): ActivityEvent[] {
    const res = this.storage.exec(`
      SELECT * FROM events 
      WHERE session_id = "${sessionId}" 
      ORDER BY timestamp DESC 
      LIMIT ${limit}
    `);
    if (!res.length) return [];
    // Return chronological order
    return res[0].values.map((row: any[]) => this.mapEventRow(res[0].columns, row)).reverse();
  }

  public getTouchedFilesMap(sessionId: string): Map<string, { read: number; write: number; create: number; delete: number; lastTime: number }> {
    const map = new Map<string, { read: number; write: number; create: number; delete: number; lastTime: number }>();
    const res = this.storage.exec(`
      SELECT file_path, activity_type, MAX(timestamp) as last_time, COUNT(*) as cnt
      FROM events
      WHERE session_id = "${sessionId}" AND file_path IS NOT NULL
      GROUP BY file_path, activity_type
    `);

    if (!res.length) return map;
    for (const row of res[0].values) {
      const filePath = row[0] as string;
      const actType = row[1] as string;
      const lastTime = row[2] as number;
      const cnt = row[3] as number;

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
    const res = this.storage.exec(`
      SELECT id, source, target, type, confidence, provenance 
      FROM dependency_edges 
      WHERE workspace_id = "${workspaceId}"
    `);
    if (!res.length) return [];
    return res[0].values.map((row: any[]) => ({
      id: row[0] as string,
      source: row[1] as string,
      target: row[2] as string,
      type: row[3] as 'import' | 'activity_flow',
      confidence: row[4] as number,
      provenance: row[5] as string
    }));
  }

  // --- Pruning Retention ---

  public pruneRetention(retentionDays: number): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const res = this.storage.exec(`SELECT id FROM sessions WHERE start_time < ${cutoff}`);
    if (!res.length || !res[0].values.length) return 0;

    const ids = res[0].values.map((v: any[]) => `"${v[0]}"`).join(',');
    this.storage.run(`DELETE FROM events WHERE session_id IN (${ids})`);
    this.storage.run(`DELETE FROM sessions WHERE id IN (${ids})`);
    return res[0].values.length;
  }

  public exportSession(sessionId: string): { session: SessionRecord; events: ActivityEvent[] } | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    const events = this.getEventsBySession(sessionId, 50000, 0);
    return { session, events };
  }

  // --- Row Mappers ---

  private mapSessionRow(cols: string[], row: any[]): SessionRecord {
    const obj: any = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });

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

  private mapEventRow(cols: string[], row: any[]): ActivityEvent {
    const obj: any = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });

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
