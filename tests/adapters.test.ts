import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as path from 'path';
import { DependencyAnalyzer } from '../src/graph/analyzer';
import { GenericHttpAdapter } from '../src/adapters/http.adapter';
import { CopilotTelemetryAdapter } from '../src/adapters/copilot.adapter';
import { AntigravityHookAdapter } from '../src/adapters/antigravity.adapter';
import { RawEventInput } from '../pipeline/normalizer';

describe('Agent and Ingestion Adapters', () => {
  it('parses real static imports and creates graph nodes and edges', () => {
    // We analyze our own project directory
    const projectDir = path.resolve('.');
    const analyzer = new DependencyAnalyzer(projectDir);
    const result = analyzer.analyze();

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.stats.totalFiles).toBeGreaterThan(0);
    expect(result.stats.topFolders.length).toBeGreaterThan(0);

    // Check that edges only connect real files
    const fileIds = new Set(result.nodes.map((n) => n.id));
    for (const edge of result.edges) {
      expect(fileIds.has(edge.source)).toBe(true);
      expect(fileIds.has(edge.target)).toBe(true);
      expect(edge.provenance).toBe('static_import_parser');
    }
  });

  it('ingests Copilot telemetry records with explicit attribution', () => {
    let captured: RawEventInput | null = null;
    const adapter = new CopilotTelemetryAdapter('session_123', 'ws_1', 'C:/proj');
    adapter.initialize((evt) => {
      captured = evt;
    });

    adapter.handleCopilotRecord({
      toolName: 'read_file',
      filePath: 'src/index.ts',
      durationMs: 120,
      success: true,
      turnId: 'turn_42',
      snippet: 'const a = 1;'
    });

    expect(captured).not.toBeNull();
    expect(captured!.provider).toBe('copilot');
    expect(captured!.evidenceLevel).toBe('explicit');
    expect(captured!.activityType).toBe('file_read');
    expect(captured!.toolName).toBe('read_file');
    expect(captured!.durationMs).toBe(120);
    expect(captured!.codeSnippet).toBe('const a = 1;');
  });

  it('ingests Antigravity hook events and extracts tool parameters', () => {
    let captured: RawEventInput | null = null;
    const adapter = new AntigravityHookAdapter('session_123', 'ws_1', 'C:/proj');
    adapter.initialize((evt) => {
      captured = evt;
    });

    adapter.handleHookEvent({
      hookEvent: 'PreToolUse',
      toolName: 'replace_file_content',
      toolArgs: {
        TargetFile: 'src/app.tsx',
        Instruction: 'Add header'
      },
      durationMs: 45,
      conversationId: 'conv_99'
    });

    expect(captured).not.toBeNull();
    expect(captured!.provider).toBe('antigravity');
    expect(captured!.evidenceLevel).toBe('explicit');
    expect(captured!.activityType).toBe('file_write');
    expect(captured!.filePath).toBe('src/app.tsx');
    expect(captured!.correlationId).toBe('conv_99');
  });

  it('ingests authenticated events over loopback HTTP', async () => {
    let captured: RawEventInput | null = null;
    const token = 'secret-test-token-12345';
    const adapter = new GenericHttpAdapter('sess_1', 'ws_1', 'C:/proj', 0, token);
    await adapter.initialize((evt) => {
      captured = evt;
    });

    const port = adapter.getPort();

    // 1. Unauthorized request
    const unauthorized = await makeRequest(`http://127.0.0.1:${port}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer bad-token' },
      body: JSON.stringify({ activityType: 'tool_call', toolName: 'bash' })
    });
    expect(unauthorized.statusCode).toBe(401);

    // 2. Authorized request
    const authorized = await makeRequest(`http://127.0.0.1:${port}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-provider': 'antigravity'
      },
      body: JSON.stringify({
        activityType: 'tool_call',
        toolName: 'run_command',
        filePath: 'scripts/build.sh'
      })
    });

    expect(authorized.statusCode).toBe(200);
    expect(captured).not.toBeNull();
    expect(captured!.provider).toBe('antigravity');
    expect(captured!.toolName).toBe('run_command');

    adapter.dispose();
  });
});

function makeRequest(urlStr: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: options.method,
        headers: options.headers
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c.toString()));
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
