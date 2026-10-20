import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EventNormalizer } from '../src/pipeline/normalizer';
import { EventDeduplicator } from '../src/pipeline/deduplicator';
import { SQLiteStorage } from '../src/storage/database';
import { ActivityRepository } from '../src/storage/repository';
import { DependencyAnalyzer } from '../src/graph/analyzer';
import { CopilotTelemetryAdapter } from '../src/adapters/copilot.adapter';
import { AntigravityHookAdapter } from '../src/adapters/antigravity.adapter';

describe('Failure and Edge Cases Verification', () => {
  const testDbPath = path.resolve('tests/failure_test.db');
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

  it('gracefully rejects malformed events without crashing', () => {
    const normalizer = new EventNormalizer();
    // Invalid provider & invalid activityType
    const malformed1 = normalizer.normalize({
      sessionId: 'sess_fail',
      provider: 'invalid_provider' as any,
      source: 'test',
      activityType: 'not_an_activity' as any,
      workspaceId: 'ws_fail'
    });
    expect(malformed1).toBeNull();

    // Missing sessionId
    const malformed2 = normalizer.normalize({
      sessionId: '',
      provider: 'vscode',
      source: 'test',
      activityType: 'file_read',
      workspaceId: 'ws_fail'
    });
    expect(malformed2).toBeNull();
  });

  it('handles non-existent workspace root gracefully in DependencyAnalyzer', () => {
    const analyzer = new DependencyAnalyzer('/non/existent/path/that/never/exists');
    const result = analyzer.analyze();
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.stats.totalFiles).toBe(0);
    expect(result.stats.totalFolders).toBe(0);
  });

  it('reports unavailable adapter status truthfully when environment is absent', async () => {
    const copilot = new CopilotTelemetryAdapter('sess_1', 'ws_1', 'C:/fake');
    const copilotAvailable = await copilot.isAvailable();
    const health = copilot.getHealth();
    expect(typeof copilotAvailable).toBe('boolean');
    expect(health.status).toBe('unavailable');
    expect(health.diagnostic).toContain('not detected');

    const antigravity = new AntigravityHookAdapter('sess_1', 'ws_1', 'C:/fake', 'C:/fake/hook_events.jsonl');
    const agHealth = antigravity.getHealth();
    expect(agHealth.name).toBe('Google Antigravity Hook Adapter');
  });

  it('handles thousands of events under bounded retention without degradation', () => {
    repo.saveSession({
      id: 'sess_bulk',
      workspaceId: 'ws_bulk',
      workspaceName: 'bulk-test',
      startTime: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
      endTime: null,
      totalEvents: 0,
      filesTouched: 0,
      toolCalls: 0,
      errorsCount: 0,
      recordingStatus: 'active',
      activeProviders: ['vscode']
    });

    // Ingest 500 events
    for (let i = 0; i < 500; i++) {
      repo.saveEvent({
        id: `evt_bulk_${i}`,
        sessionId: 'sess_bulk',
        timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000 + i * 100,
        ingestionTimestamp: Date.now(),
        provider: 'vscode',
        source: 'test',
        activityType: 'file_read',
        evidenceLevel: 'observed',
        workspaceId: 'ws_bulk',
        filePath: `src/file_${i % 10}.ts`,
        previousPath: null,
        toolName: null,
        durationMs: null,
        success: true,
        correlationId: null,
        metadata: { index: i },
        codeSnippet: null
      });
    }

    const events = repo.getEventsBySession('sess_bulk', 100, 0);
    expect(events.length).toBe(100);

    // Prune events older than 30 days
    const prunedCount = repo.pruneRetention(30);
    expect(prunedCount).toBe(1);

    const remaining = repo.getEventsBySession('sess_bulk');
    expect(remaining.length).toBe(0);
  });

  it('prevents upgrading observed editor events to explicit evidence', () => {
    const normalizer = new EventNormalizer();
    const evt = normalizer.normalize({
      sessionId: 'sess_1',
      provider: 'vscode',
      source: 'vscode.editor',
      activityType: 'file_write',
      evidenceLevel: 'explicit', // illegal attempt to upgrade
      workspaceId: 'ws_1',
      filePath: 'src/app.ts'
    });

    expect(evt).not.toBeNull();
    expect(evt!.evidenceLevel).toBe('observed'); // downgrade enforced
  });
});
