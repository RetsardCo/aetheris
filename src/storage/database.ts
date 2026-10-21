import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

export interface DatabaseConfig {
  dbFilePath: string;
  wasmBinaryPath?: string;
}

export class SQLiteStorage {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private dbFilePath: string;
  private wasmBinaryPath?: string;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(config: DatabaseConfig) {
    this.dbFilePath = config.dbFilePath;
    this.wasmBinaryPath = config.wasmBinaryPath;
  }

  public async initialize(): Promise<void> {
    const locateFile = (file: string) => {
      if (this.wasmBinaryPath && fs.existsSync(this.wasmBinaryPath)) {
        return this.wasmBinaryPath;
      }
      // Check dist directory
      const distPath = path.resolve('dist', file);
      if (fs.existsSync(distPath)) return distPath;

      // Check node_modules path
      const nmPath = path.resolve('node_modules/sql.js/dist', file);
      if (fs.existsSync(nmPath)) return nmPath;

      try {
        const resolved = require.resolve(`sql.js/dist/${file}`);
        if (fs.existsSync(resolved)) return resolved;
      } catch {
        // ignore
      }

      return file;
    };

    this.SQL = await initSqlJs({ locateFile });

    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbFilePath)) {
      try {
        const buffer = fs.readFileSync(this.dbFilePath);
        this.db = new this.SQL.Database(buffer);
      } catch (err) {
        console.error('Failed to load existing SQLite database, creating new one:', err);
        this.db = new this.SQL.Database();
      }
    } else {
      this.db = new this.SQL.Database();
    }

    this.runMigrations();
    this.flush();
  }

  private runMigrations(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    const result = this.db.exec('SELECT MAX(version) FROM schema_migrations');
    const currentVersion = (result[0]?.values[0]?.[0] as number) || 0;

    if (currentVersion < 1) {
      this.db.run(`
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          workspace_name TEXT NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER,
          total_events INTEGER DEFAULT 0,
          files_touched INTEGER DEFAULT 0,
          tool_calls INTEGER DEFAULT 0,
          errors_count INTEGER DEFAULT 0,
          recording_status TEXT NOT NULL,
          active_providers TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          ingestion_timestamp INTEGER NOT NULL,
          provider TEXT NOT NULL,
          source TEXT NOT NULL,
          activity_type TEXT NOT NULL,
          evidence_level TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          file_path TEXT,
          previous_path TEXT,
          tool_name TEXT,
          duration_ms REAL,
          success INTEGER,
          correlation_id TEXT,
          metadata TEXT NOT NULL,
          code_snippet TEXT,
          FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_events_session_time ON events(session_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_file ON events(file_path);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(activity_type);
        CREATE INDEX IF NOT EXISTS idx_events_provider ON events(provider);

        CREATE TABLE IF NOT EXISTS dependency_edges (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          source TEXT NOT NULL,
          target TEXT NOT NULL,
          type TEXT NOT NULL,
          confidence REAL NOT NULL,
          provenance TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_edges_source ON dependency_edges(source);
        CREATE INDEX IF NOT EXISTS idx_edges_target ON dependency_edges(target);

        INSERT INTO schema_migrations (version, applied_at) VALUES (1, ${Date.now()});

        COMMIT;
      `);
      this.dirty = true;
    }
  }

  public getRawDb(): Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  public run(sql: string, params?: (string | number | null)[]): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
    this.scheduleSave();
  }

  public exec(sql: string): any[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.exec(sql);
  }

  public query<T = any>(sql: string, params: (string | number | boolean | null)[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params as (number | string | null | Uint8Array)[]);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return results;
  }

  public scheduleSave(): void {
    this.dirty = true;
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.flush();
      }, 500);
    }
  }

  public flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty || !this.db) return;

    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbFilePath, Buffer.from(data));
      this.dirty = false;
    } catch (err) {
      console.error('Failed to flush SQLite database to disk:', err);
    }
  }

  public close(): void {
    this.flush();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
