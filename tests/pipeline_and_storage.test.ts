import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EventNormalizer } from '../src/pipeline/normalizer';
import { redactString, sanitizeMetadata } from '../src/pipeline/redactor';
import { EventDeduplicator } from '../src/pipeline/deduplicator';
import { SQLiteStorage } from '../src/storage/database';
import { ActivityRepository } from '../src/storage/repository';
import { SessionRecord } from '../src/types/events';

describe('Pipeline and Storage Engine', () => {
  const testDbPath = path.resolve('tests/test_storage.db');
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

  it('redacts sensitive API keys and tokens', () => {
    const raw = 'Bearer sk-abcdef12345678901234567890 and AIzaSyD1234567890123456789012345678901';
    const redacted = redactString(raw);
    expect(redacted).not.toContain('sk-abcdef');
    expect(redacted).not.toContain('AIzaSyD');
    expect(redacted).toContain('[REDACTED_KEY]');
    expect(redacted).toContain('[REDACTED_GOOGLE_API_KEY]');

    const meta = {
      apiKey: 'secret123',
      normalField: 'test'
    };
    const sanitized = sanitizeMetadata(meta);
    expect(sanitized.apiKey).toBe('[REDACTED_SENSITIVE_KEY]');
    expect(sanitized.normalField).toBe('test');
  });

  it('deduplicates rapid identical events', () => {
    const dedup = new EventDeduplicator(100, 2000);
    const fp = dedup.generateFingerprint('vscode', 'file_write', 'src/app.ts', null, 1000);
    expect(dedup.isDuplicate('id_1', fp)).toBe(false);
    expect(dedup.isDuplicate('id_1', fp)).toBe(true);
    expect(dedup.isDuplicate('id_2', fp)).toBe(true);
  });

  it('normalizes events with correct evidence levels and saves to SQLite', () => {
    const normalizer = new EventNormalizer();
    const session: SessionRecord = {
      id: 'sess_1',
      workspaceId: 'ws_1',
      workspaceName: 'my-project',
      startTime: Date.now(),
      endTime: null,
      totalEvents: 0,
      filesTouched: 0,
      toolCalls: 0,
      errorsCount: 0,
      recordingStatus: 'active',
      activeProviders: ['vscode', 'copilot']
    };
    repo.saveSession(session);

    // VS Code observed event
    const event1 = normalizer.normalize({
      sessionId: 'sess_1',
      provider: 'vscode',
      source: 'vscode.workspace',
      activityType: 'file_write',
      workspaceId: 'ws_1',
      workspaceRoot: 'C:/project/root',
      filePath: 'C:/project/root/src/index.ts',
      metadata: { linesChanged: 10 }
    });

    expect(event1).not.toBeNull();
    expect(event1!.evidenceLevel).toBe('observed');
    expect(event1!.filePath).toBe('src/index.ts');

    repo.saveEvent(event1!);

    // Copilot explicit tool invocation
    const event2 = normalizer.normalize({
      sessionId: 'sess_1',
      provider: 'copilot',
      source: 'copilot.chat',
      activityType: 'tool_call',
      workspaceId: 'ws_1',
      toolName: 'read_file',
      filePath: 'src/index.ts',
      success: true,
      metadata: { prompt: 'Inspect file' }
    });

    expect(event2).not.toBeNull();
    expect(event2!.evidenceLevel).toBe('explicit');
    expect(event2!.toolName).toBe('read_file');

    repo.saveEvent(event2!);

    // Retrieve events
    const events = repo.getEventsBySession('sess_1');
    expect(events.length).toBe(2);
    expect(events[0].activityType).toBe('file_write');
    expect(events[1].activityType).toBe('tool_call');

    // Check touched files map
    const touched = repo.getTouchedFilesMap('sess_1');
    expect(touched.has('src/index.ts')).toBe(true);
    expect(touched.get('src/index.ts')!.write).toBe(1);

    // Check export
    const exported = repo.exportSession('sess_1');
    expect(exported).not.toBeNull();
    expect(exported!.session.id).toBe('sess_1');
    expect(exported!.events.length).toBe(2);
  });
});
