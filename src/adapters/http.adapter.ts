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

    const url = req.url || '/';

    // Health / Status endpoint (public to loopback)
    if (url === '/api/health' || url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port: this.port, running: this.isRunning }));
      return;
    }

    if (url === '/api/status') {
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

    // Ingestion endpoint
    if (url === '/api/events' && req.method === 'POST') {
      // Validate Authorization token
      const authHeader = req.headers['authorization'];
      const customToken = req.headers['x-agent-token'];
      const token = customToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

      // Allow loopback if token matches or during local testing if header omitted
      if (token && token !== this.authToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid token' }));
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
          res.end(JSON.stringify({ success: true }));
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
