import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteStorage } from '../src/storage/database';
import { ActivityRepository } from '../src/storage/repository';
import { EventNormalizer } from '../src/pipeline/normalizer';
import { SessionRecord } from '../src/types/events';

describe('Session Comparison, Replay Data, and Security', () => {
  const testDbPath = path.resolve('tests/session_replay_test.db');
  let storage: SQLiteStorage;
  let repo: ActivityRepository;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    storage = new SQLiteStorage({ dbFilePath: testDbPath });
    await storage.initialize();
    repo = new ActivityRepository(storage);
  });

  afterEach(() => {
    storage.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('accurately compares two sessions and calculates file set intersections', () => {
    const sessionA: SessionRecord = {
      id: 'sess_A',
      workspaceId: 'ws_test',
      workspaceName: 'Repo A',
      startTime: 1000000,
      endTime: 1060000,
      totalEvents: 3,
      filesTouched: 2,
      toolCalls: 1,
      errorsCount: 0,
      recordingStatus: 'stopped',
      activeProviders: ['copilot']
    };

    const sessionB: SessionRecord = {
      id: 'sess_B',
      workspaceId: 'ws_test',
      workspaceName: 'Repo B',
      startTime: 2000000,
      endTime: 2030000,
      totalEvents: 2,
      filesTouched: 2,
      toolCalls: 2,
      errorsCount: 0,
      recordingStatus: 'stopped',
      activeProviders: ['antigravity']
    };

    repo.saveSession(sessionA);
    repo.saveSession(sessionB);

    // Session A touches src/onlyA.ts and src/common.ts
    repo.saveEvent({
      id: 'evt_a1',
      sessionId: 'sess_A',
      timestamp: 1010000,
      ingestionTimestamp: 1010000,
      provider: 'copilot',
      source: 'copilot.chat',
      activityType: 'file_write',
      evidenceLevel: 'explicit',
      workspaceId: 'ws_test',
      filePath: 'src/onlyA.ts',
      metadata: {}
    });

    repo.saveEvent({
      id: 'evt_a2',
      sessionId: 'sess_A',
      timestamp: 1020000,
      ingestionTimestamp: 1020000,
      provider: 'copilot',
      source: 'copilot.chat',
      activityType: 'tool_call',
      evidenceLevel: 'explicit',
      workspaceId: 'ws_test',
      filePath: 'src/common.ts',
      toolName: 'edit_file',
      metadata: {}
    });

    // Session B touches src/onlyB.ts and src/common.ts
    repo.saveEvent({
      id: 'evt_b1',
      sessionId: 'sess_B',
      timestamp: 2010000,
      ingestionTimestamp: 2010000,
      provider: 'antigravity',
      source: 'antigravity.hook',
      activityType: 'tool_call',
      evidenceLevel: 'explicit',
      workspaceId: 'ws_test',
      filePath: 'src/onlyB.ts',
      toolName: 'replace_file_content',
      metadata: {}
    });

    repo.saveEvent({
      id: 'evt_b2',
      sessionId: 'sess_B',
      timestamp: 2020000,
      ingestionTimestamp: 2020000,
      provider: 'antigravity',
      source: 'antigravity.hook',
      activityType: 'tool_call',
      evidenceLevel: 'explicit',
      workspaceId: 'ws_test',
      filePath: 'src/common.ts',
      toolName: 'replace_file_content',
      metadata: {}
    });

    const diff = repo.compareSessions('sess_A', 'sess_B');
    expect(diff).not.toBeNull();
    expect(diff!.durationDiffMs).toBe(30000); // 60s vs 30s
    expect(diff!.filesTouchedAOnly).toEqual(['src/onlyA.ts']);
    expect(diff!.filesTouchedBOnly).toEqual(['src/onlyB.ts']);
    expect(diff!.filesTouchedBoth).toEqual(['src/common.ts']);
  });

  it('redacts sensitive credentials during session export', () => {
    repo.saveSession({
      id: 'sess_export_redact',
      workspaceId: 'ws_sec',
      workspaceName: 'Secret Repo',
      startTime: Date.now(),
      endTime: null,
      totalEvents: 1,
      filesTouched: 1,
      toolCalls: 1,
      errorsCount: 0,
      recordingStatus: 'active',
      activeProviders: ['copilot']
    });

    repo.saveEvent({
      id: 'evt_sec_1',
      sessionId: 'sess_export_redact',
      timestamp: Date.now(),
      ingestionTimestamp: Date.now(),
      provider: 'copilot',
      source: 'copilot.chat',
      activityType: 'tool_call',
      evidenceLevel: 'explicit',
      workspaceId: 'ws_sec',
      filePath: 'src/auth.ts',
      toolName: 'api_call',
      metadata: {
        apiKey: 'sk-abcdef12345678901234567890',
        normalConfig: 'production'
      },
      codeSnippet: 'const token = "sk-abcdef12345678901234567890";'
    });

    const exported = repo.exportSession('sess_export_redact');
    expect(exported).not.toBeNull();
    expect(exported!.events.length).toBe(1);

    const exportedEvent = exported!.events[0];
    expect(exportedEvent.codeSnippet).not.toContain('sk-abcdef');
    expect(exportedEvent.codeSnippet).toContain('[REDACTED_KEY]');
    expect(exportedEvent.metadata.apiKey).toBe('[REDACTED_SENSITIVE_KEY]');
    expect(exportedEvent.metadata.normalConfig).toBe('production');
  });

  it('handles parameterized queries safely even with quotes and malicious characters in session ID', () => {
    const maliciousId = `sess' OR '1'='1" ; DROP TABLE sessions; --`;
    const session: SessionRecord = {
      id: maliciousId,
      workspaceId: 'ws_safe',
      workspaceName: 'SQL Injection Test',
      startTime: Date.now(),
      endTime: null,
      totalEvents: 0,
      filesTouched: 0,
      toolCalls: 0,
      errorsCount: 0,
      recordingStatus: 'active',
      activeProviders: ['vscode']
    };

    // Should save cleanly via prepared statement without SQL injection
    repo.saveSession(session);

    const retrieved = repo.getSession(maliciousId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(maliciousId);
    expect(retrieved!.workspaceName).toBe('SQL Injection Test');

    // Verify sessions table still exists and wasn't dropped
    const list = repo.listSessions();
    expect(list.length).toBeGreaterThan(0);
  });

  it('sanitizes directory traversal patterns in EventNormalizer.normalizePath', () => {
    const normalizer = new EventNormalizer();

    expect(normalizer.normalizePath('../../etc/passwd')).toBe('etc/passwd');
    expect(normalizer.normalizePath('src/../config/settings.json')).toBe('config/settings.json');
    expect(normalizer.normalizePath('a/b/c/../../d.ts')).toBe('a/d.ts');
    expect(normalizer.normalizePath('///leading//slashes/file.ts')).toBe('leading/slashes/file.ts');
  });
});
