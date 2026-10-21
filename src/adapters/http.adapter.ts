import * as http from 'http';
import * as crypto from 'crypto';
import { ActivityType, AdapterHealth, Provider } from '../types/events';
import { RawEventInput } from '../pipeline/normalizer';
import { AgentAdapter } from './adapter.interface';

export class GenericHttpAdapter implements AgentAdapter {
  public readonly id: Provider = 'unknown';
  public readonly name = 'Loopback HTTP Event Ingester';
  public readonly supportedEventTypes: ActivityType[] = [
    'file_read',
    'file_write',
    'file_create',
    'file_delete',
    'tool_call',
    'tool_result',
    'terminal_command',
    'agent_lifecycle'
  ];

  private server: http.Server | null = null;
  private port: number;
  private authToken: string;
  private onEventCallback: ((event: RawEventInput) => void) | null = null;
  private sessionId = '';
  private workspaceId = '';
  private workspaceRoot = '';
  private eventsCount = 0;
  private lastEventTimestamp = 0;
  private isRunning = false;

  constructor(
    sessionId: string,
    workspaceId: string,
    workspaceRoot: string,
    port = 5174,
    token?: string
  ) {
    this.sessionId = sessionId;
    this.workspaceId = workspaceId;
    this.workspaceRoot = workspaceRoot;
    this.port = port;
    this.authToken = token || crypto.randomBytes(20).toString('hex');
  }

  public getAuthToken(): string {
    return this.authToken;
  }

  public getPort(): number {
    return this.port;
  }

  public getUrl(): string {
    return `http://127.0.0.1:${this.port}/`;
  }

  public updateSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async initialize(onEvent: (event: RawEventInput) => void): Promise<void> {
    this.onEventCallback = onEvent;
    await this.startServer();
  }

  public startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        return resolve();
      }

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`Port ${this.port} is in use, retrying on random port...`);
          this.port = 0; // OS assigned port
          this.server?.listen(0, '127.0.0.1');
        } else {
          console.error('HTTP Adapter server error:', err);
          this.isRunning = false;
          reject(err);
        }
      });

      // Bind to 127.0.0.1 ONLY (loopback restriction)
      this.server.listen(this.port, '127.0.0.1', () => {
        const addr = this.server?.address();
        if (addr && typeof addr !== 'string') {
          this.port = addr.port;
        }
        this.isRunning = true;
        resolve();
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers for local loopback clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-agent-token, x-provider');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlObj = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const pathname = urlObj.pathname;

    // Health / Status endpoint (public to loopback)
    if (pathname === '/api/health' || pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port: this.port, running: this.isRunning }));
      return;
    }

    if (pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          sessionId: this.sessionId,
          eventsCaptured: this.eventsCount,
          lastEventTime: this.lastEventTimestamp
        })
      );
      return;
    }

    // Serve Aetheris Web Dashboard for browser view
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.getDashboardHtml());
      return;
    }

    // Ingestion endpoint
    if (pathname === '/api/events' && req.method === 'POST') {
      // Validate Authorization token
      const authHeader = req.headers['authorization'];
      const customToken = req.headers['x-agent-token'];
      const queryToken = urlObj.searchParams.get('token');
      const token = customToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) || queryToken;

      // Strict authentication enforcement: token MUST be provided and match
      if (!token || token !== this.authToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Missing or invalid authentication token' }));
        return;
      }

      // Check Content-Length for DOS prevention (1MB max)
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large (max 1MB)' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          req.destroy();
        }
      });

      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const providerHeader = (req.headers['x-provider'] as Provider) || 'unknown';
          this.processPayload(parsed, providerHeader);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: Array.isArray(parsed) ? parsed.length : 1 }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  private getDashboardHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Aetheris · AI Activity Observatory</title>
  <style>
    body {
      background: radial-gradient(circle at 60% 40%, #0a1120 0%, #06080d 100%);
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 30px;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
    .title-row { display: flex; align-items: center; gap: 12px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 12px #10b981; }
    h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
    .card { background: rgba(15, 22, 36, 0.85); border: 1px solid #202d44; border-radius: 8px; padding: 18px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 12px; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
    .stat-val { font-size: 24px; font-weight: 700; font-family: monospace; color: #38bdf8; }
    .stat-lbl { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    pre { background: #07090e; border: 1px solid #1e293b; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; color: #38bdf8; overflow-x: auto; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: rgba(6,182,212,0.15); color: #22d3ee; border: 1px solid rgba(6,182,212,0.3); }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-row">
      <div class="dot"></div>
      <h1>Aetheris · Local Activity Receiver</h1>
      <span class="badge">Running on port ${this.port}</span>
    </div>
    <div style="font-size: 12px; color: #94a3b8; font-family: monospace;">Session: ${this.sessionId}</div>
  </div>

  <div class="stats-row" style="margin-bottom: 24px;">
    <div class="card">
      <div class="card-title">Events Captured</div>
      <div id="evtCount" class="stat-val">${this.eventsCount}</div>
      <div class="stat-lbl">Live HTTP / Hook stream</div>
    </div>
    <div class="card">
      <div class="card-title">Auth Token</div>
      <div class="stat-val" style="font-size: 14px; color: #f59e0b;">${this.authToken.slice(0, 10)}...</div>
      <div class="stat-lbl">Required for /api/events</div>
    </div>
    <div class="card">
      <div class="card-title">Receiver Status</div>
      <div class="stat-val" style="color: #10b981; font-size: 18px;">READY</div>
      <div class="stat-lbl">Loopback 127.0.0.1 bound</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">How to stream events via HTTP API</div>
    <p style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">Post normalized activity events with your per-session bearer token:</p>
    <pre>curl -X POST http://127.0.0.1:${this.port}/api/events \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${this.authToken}" \\
  -H "x-provider: antigravity" \\
  -d '{"activityType": "tool_call", "toolName": "view_file", "filePath": "src/extension.ts"}'</pre>
  </div>

  <script>
    setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.eventsCaptured !== undefined) {
          document.getElementById('evtCount').innerText = data.eventsCaptured;
        }
      } catch {}
    }, 2500);
  </script>
</body>
</html>`;
  }

  private processPayload(data: any, defaultProvider: Provider): void {
    if (!this.onEventCallback) return;

    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      const provider: Provider = item.provider || defaultProvider || 'unknown';
      const event: RawEventInput = {
        sessionId: this.sessionId,
        provider,
        source: item.source || 'http.receiver',
        activityType: item.activityType || 'tool_call',
        evidenceLevel: provider === 'unknown' ? 'observed' : 'explicit',
        workspaceId: this.workspaceId,
        workspaceRoot: this.workspaceRoot,
        filePath: item.filePath || item.path || null,
        toolName: item.toolName || item.tool || null,
        durationMs: item.durationMs || null,
        success: item.success !== undefined ? item.success : null,
        metadata: item.metadata || {},
        codeSnippet: item.codeSnippet || item.snippet || null
      };

      this.eventsCount++;
      this.lastEventTimestamp = Date.now();
      this.onEventCallback(event);
    }
  }

  public dispose(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.isRunning = false;
    this.onEventCallback = null;
  }

  public getHealth(): AdapterHealth {
    return {
      provider: 'unknown',
      name: this.name,
      available: true,
      status: this.isRunning ? 'connected' : 'unavailable',
      eventsCaptured: this.eventsCount,
      lastEventTime: this.lastEventTimestamp || undefined,
      diagnostic: this.isRunning
        ? `Loopback HTTP receiver listening on http://127.0.0.1:${this.port}/ (Auth Token: ${this.authToken.slice(0, 6)}...)`
        : 'Loopback receiver is stopped.'
    };
  }
}
