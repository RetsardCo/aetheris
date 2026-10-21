// live_bridge_server.mjs
// Real-time backend bridge for Aetheris (3D Cognitive Observatory)
// Tails live transcripts from Antigravity, extracts AI reasoning and file operations,
// and streams live telemetry to both the Antigravity dashboard artifact and the browser.

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PREFERRED_PORTS = [5175, 5174, 5176, 5177];
const HOST = '127.0.0.1';

// Process-level resilience against transient Windows file lock errors
process.on('uncaughtException', (err) => {
  console.warn(`[Agent Brain Bridge] Handled uncaught exception: ${err?.message || err}`);
});

process.on('unhandledRejection', (reason) => {
  console.warn(`[Agent Brain Bridge] Handled unhandled rejection:`, reason);
});

// Brain directories
const BRAIN_ROOT = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
const KNOWN_CONVERSATIONS = [
  '12ab87b3-0219-43f1-bd04-f890005d6af6',
  '5806cf9f-1883-4766-9dcd-a9e41efb3e97',
  'fea86683-facd-4b9d-8f71-103a84d2c33d'
];

console.log(`[Agent Brain Bridge] Initializing...`);
console.log(`[Agent Brain Bridge] Brain Root: ${BRAIN_ROOT}`);

// In-Memory State
const state = {
  activeConversation: KNOWN_CONVERSATIONS[0],
  conversations: new Map(), // cid -> { id, projectName, latestThought, latestDuration, thoughts: [], recentEvents: [], stepCount, lastUpdate }
  events: [],
  nodes: new Map(),
  edges: [],
  thoughts: [],
  latestThought: 'Observing workspace activity and listening to Antigravity live transcript telemetry...',
  stats: {
    totalFiles: 0,
    totalFolders: 0,
    totalConnections: 0,
    touchedCount: 0,
    readCount: 0,
    writeCount: 0,
    toolCallCount: 0,
    thoughtsCount: 0,
    topFolders: []
  },
  lastUpdate: Date.now()
};

// Global error guards to prevent unexpected termination from broken socket pipes
process.on('uncaughtException', (err) => {
  console.warn(`[Agent Brain Bridge] Handled uncaught exception: ${err?.message}`);
});
process.on('unhandledRejection', (reason) => {
  console.warn(`[Agent Brain Bridge] Handled unhandled rejection: ${reason}`);
});

// Connected SSE clients
const sseClients = new Set();

function broadcastSSE(type, payload) {
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    if (!client.writable || client.destroyed || client.writableEnded) {
      sseClients.delete(client);
      continue;
    }
    try {
      client.write(message, (err) => {
        if (err) {
          sseClients.delete(client);
        }
      });
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Path cleaning and normalization
function cleanString(str) {
  if (typeof str !== 'string') return '';
  let s = str.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function normalizeFilePath(str) {
  if (typeof str !== 'string') return '';
  const s = cleanString(str);
  return s.replace(/\\\\/g, '/').replace(/\\/g, '/').trim();
}

function getClusterForPath(filePath) {
  const p = filePath.toLowerCase();
  if (p.includes('scratch/ai-activity-visualizer') || p.includes('ai-activity-visualizer')) {
    if (p.includes('adapters')) return 'adapters';
    if (p.includes('webview')) return 'webview';
    if (p.includes('pipeline') || p.includes('storage') || p.includes('graph')) return 'core-engine';
    return 'ai-activity-visualizer';
  }
  if (p.includes('.system_generated/logs') || p.includes('transcript')) return 'brain-logs';
  if (p.includes('agent_brain_dashboard')) return 'dashboard-ui';
  if (p.includes('.gemini') || p.includes('antigravity')) return 'antigravity-system';
  if (p.includes('powershell') || p.includes('cmd') || p.includes('node')) return 'terminal-exec';
  return 'workspace';
}

function getShortPath(filePath) {
  const norm = normalizeFilePath(filePath);
  const parts = norm.split('/');
  if (parts.length > 3) {
    return parts.slice(-3).join('/');
  }
  return norm || 'unknown';
}

function getClusterColor(cluster) {
  switch (cluster) {
    case 'core-engine': return '#38bdf8'; // cyan
    case 'webview': return '#818cf8'; // indigo
    case 'adapters': return '#f59e0b'; // amber
    case 'brain-logs': return '#10b981'; // emerald
    case 'dashboard-ui': return '#06b6d4'; // bright cyan
    case 'terminal-exec': return '#c084fc'; // purple
    case 'ai-activity-visualizer': return '#38bdf8';
    default: return '#38bdf8';
  }
}

let lastTouchedNodeId = null;

function recordNode(rawPath, activityType, snippet = '') {
  const norm = normalizeFilePath(rawPath);
  if (!norm || norm.length < 2) return null;

  const cluster = getClusterForPath(norm);
  const shortName = getShortPath(norm);
  const id = norm;

  let node = state.nodes.get(id);
  const now = Date.now();

  let color = '#38bdf8'; // read
  if (activityType === 'file_write') color = '#f59e0b';
  else if (activityType === 'file_create') color = '#10b981';
  else if (activityType === 'terminal_command') color = '#a855f7';
  else if (activityType === 'search') color = '#14b8a6';

  if (!node) {
    // 3D spatial coordinate around cluster center in spherical orbital space
    const clusterAngles = {
      'core-engine': { cx: -320, cy: -80, cz: 140, rad: 160 },
      'webview': { cx: 320, cy: -110, cz: -110, rad: 150 },
      'adapters': { cx: -310, cy: 150, cz: -140, rad: 150 },
      'brain-logs': { cx: 140, cy: 230, cz: 150, rad: 140 },
      'dashboard-ui': { cx: 0, cy: -280, cz: 140, rad: 140 },
      'ai-activity-visualizer': { cx: 290, cy: 150, cz: 110, rad: 150 },
      'terminal-exec': { cx: -130, cy: 260, cz: -120, rad: 140 },
      'workspace': { cx: 230, cy: 50, cz: -230, rad: 150 },
      'antigravity-system': { cx: -150, cy: -230, cz: -150, rad: 130 }
    };
    const cInfo = clusterAngles[cluster] || { cx: 0, cy: 0, cz: 0, rad: 160 };
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI;
    const dist = Math.pow(Math.random(), 0.7) * cInfo.rad;
    const targetX = cInfo.cx + Math.cos(theta) * Math.cos(phi) * dist;
    const targetY = cInfo.cy + Math.sin(phi) * dist;
    const targetZ = (cInfo.cz || 0) + Math.sin(theta) * Math.cos(phi) * dist;

    node = {
      id,
      name: path.basename(norm) || shortName,
      fullPath: norm,
      shortPath: shortName,
      cluster,
      activity: activityType,
      color,
      size: 5,
      touchCount: 1,
      lastTouched: now,
      snippet: snippet || '',
      x: targetX,
      y: targetY,
      z: targetZ,
      targetX,
      targetY,
      targetZ,
      vx: 0,
      vy: 0,
      vz: 0,
      pulse: Math.PI * 2
    };
    state.nodes.set(id, node);

    // Intra-cluster constellation mesh: connect to up to 2 distinct peers in the cluster
    const clusterPeers = Array.from(state.nodes.values()).filter(n => n.cluster === cluster && n.id !== id);
    if (clusterPeers.length > 0) {
      const sampleCount = Math.min(2, clusterPeers.length);
      for (let s = 0; s < sampleCount; s++) {
        const peer = clusterPeers[(Math.floor(Math.random() * clusterPeers.length) + s) % clusterPeers.length];
        if (!state.edges.some(e => (e.source === peer.id && e.target === id) || (e.source === id && e.target === peer.id))) {
          state.edges.push({
            source: peer.id,
            target: id,
            weight: 1,
            cluster: cluster,
            lastActivity: now
          });
          if (state.edges.length > 600) state.edges.shift();
        }
      }
    }
  } else {
    node.touchCount++;
    node.lastTouched = now;
    node.activity = activityType;
    node.color = color;
    node.size = Math.min(14, node.size + 0.6);
    node.pulse = Math.PI * 2;
    if (snippet) node.snippet = snippet;
  }

  // Create sequence or dependency edge
  if (lastTouchedNodeId && lastTouchedNodeId !== id) {
    const existingEdge = state.edges.find(e => 
      (e.source === lastTouchedNodeId && e.target === id) ||
      (e.source === id && e.target === lastTouchedNodeId)
    );
    if (!existingEdge) {
      state.edges.push({
        source: lastTouchedNodeId,
        target: id,
        weight: 1,
        lastActivity: now
      });
      if (state.edges.length > 400) {
        state.edges.shift();
      }
    } else {
      existingEdge.weight++;
      existingEdge.lastActivity = now;
    }
  }

  lastTouchedNodeId = id;
  updateStats();
  return node;
}

function updateStats() {
  const folderCounts = new Map();
  let readC = 0;
  let writeC = 0;
  let toolC = 0;

  for (const n of state.nodes.values()) {
    folderCounts.set(n.cluster, (folderCounts.get(n.cluster) || 0) + n.touchCount);
  }

  for (const e of state.events) {
    if (e.activityType === 'file_read') readC++;
    else if (e.activityType === 'file_write' || e.activityType === 'file_create') writeC++;
    if (e.type === 'tool_call') toolC++;
  }

  const topFolders = Array.from(folderCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      color: getClusterColor(name)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  state.stats = {
    totalFiles: state.nodes.size,
    totalFolders: folderCounts.size || 1,
    totalConnections: state.edges.length,
    touchedCount: state.nodes.size,
    readCount: readC,
    writeCount: writeC,
    toolCallCount: toolC || state.events.length,
    thoughtsCount: state.thoughts.length,
    topFolders
  };
  state.lastUpdate = Date.now();
}

// Extract conversation ID from file path
function extractConversationId(filePath) {
  if (!filePath) return state.activeConversation;
  const match = filePath.match(/brain[\\\/]([a-f0-9\-]+)[\\\/]/i);
  return match ? match[1] : state.activeConversation;
}

// File mentions extractor for automatic 3D node highlighting
function extractMentionedFiles(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = new Set();
  const fileRegex = /\b([a-zA-Z0-9_\-\.\/]+\.(?:ts|tsx|js|mjs|json|html|css|py|md|sql))\b/gi;
  let m;
  while ((m = fileRegex.exec(text)) !== null) {
    const fn = m[1].replace(/^[\\\/]/, '');
    if (fn.length > 2 && !fn.startsWith('http') && !fn.startsWith('www')) {
      matches.add(fn);
    }
  }
  return Array.from(matches);
}

// Project and conversation metadata resolver
function getProjectNameForConversation(cid, filePath = '') {
  if (filePath) {
    const norm = normalizeFilePath(filePath);
    if (norm.includes('scratch/ai-activity-visualizer') || norm.includes('ai-activity-visualizer')) {
      return 'ai-activity-visualizer';
    }
    const match = norm.match(/scratch[\/\\]([^\/\\]+)/i);
    if (match && match[1]) return match[1];
  }
  if (cid === '12ab87b3-0219-43f1-bd04-f890005d6af6') return 'ai-activity-visualizer';
  if (cid === '4ea31682-5004-4e83-a153-44a97783f09e') return 'activity-visualizer (worker)';
  if (cid === '315e6657-5c35-48e2-b218-10a640022b78') return 'activity-coordinator';
  if (cid === '5806cf9f-1883-4766-9dcd-a9e41efb3e97') return 'antigravity-core';
  return `project-${cid.slice(0, 8)}`;
}

function getOrCreateConversation(cid, sourceFile = '') {
  let conv = state.conversations.get(cid);
  if (!conv) {
    conv = {
      id: cid,
      projectName: getProjectNameForConversation(cid, sourceFile),
      latestThought: '',
      latestDuration: 25,
      thoughts: [],
      turns: [],
      recentEvents: [],
      stepCount: 0,
      lastStepTime: 0,
      lastUpdate: Date.now()
    };
    state.conversations.set(cid, conv);
  } else if (sourceFile && conv.projectName.startsWith('project-')) {
    const betterName = getProjectNameForConversation(cid, sourceFile);
    if (!betterName.startsWith('project-')) conv.projectName = betterName;
  }
  return conv;
}

// Parse a JSONL line into events
function processLogLine(lineStr, sourceFile = '') {
  if (!lineStr || !lineStr.trim()) return;
  try {
    const data = JSON.parse(lineStr);
    const step = data.step_index ?? state.events.length;
    const time = data.created_at ? new Date(data.created_at).getTime() : Date.now();
    const sourceConv = extractConversationId(sourceFile);
    const conv = getOrCreateConversation(sourceConv, sourceFile);

    if (sourceConv && sourceConv !== state.activeConversation) {
      state.activeConversation = sourceConv;
    }

    // 1. Thinking Stream with accurate duration and file mentions
    if (data.thinking && typeof data.thinking === 'string' && data.thinking.trim()) {
      const thoughtText = data.thinking.trim();
      const wordCount = thoughtText.split(/\s+/).length;
      let durationSeconds = data.duration_s || (data.duration_ms ? Math.round(data.duration_ms / 1000) : 0);
      if (!durationSeconds && conv.lastStepTime && time > conv.lastStepTime) {
        const diff = Math.round((time - conv.lastStepTime) / 1000);
        if (diff >= 3 && diff <= 120) durationSeconds = diff;
      }
      if (!durationSeconds) {
        durationSeconds = Math.max(6, Math.min(65, Math.round(wordCount / 9)));
      }
      conv.lastStepTime = time;

      const mentionedFiles = extractMentionedFiles(thoughtText);

      const thoughtItem = {
        id: `th_${step}_${Date.now()}`,
        step,
        text: thoughtText,
        preview: thoughtText.slice(0, 160) + (thoughtText.length > 160 ? '...' : ''),
        durationSeconds,
        mentionedFiles,
        conversationId: sourceConv,
        projectName: conv.projectName,
        timestamp: time
      };

      state.thoughts.push(thoughtItem);
      if (state.thoughts.length > 50) state.thoughts.shift();
      state.latestThought = thoughtText;

      conv.thoughts.push(thoughtItem);
      if (conv.thoughts.length > 40) conv.thoughts.shift();
      conv.latestThought = thoughtText;
      conv.latestDuration = durationSeconds;
      conv.stepCount = Math.max(conv.stepCount, step);
      conv.lastUpdate = time;

      // Initialize a new cause-and-effect turn unit pairing this thought with subsequent actions
      if (!conv.turns) conv.turns = [];
      const turnObj = {
        id: `turn_${step}_${Date.now()}`,
        step,
        thought: thoughtItem,
        actions: [],
        timestamp: time
      };
      conv.turns.push(turnObj);
      if (conv.turns.length > 25) conv.turns.shift();

      const evt = {
        id: `evt_think_${step}_${Date.now()}`,
        type: 'ai_thinking',
        activityType: 'agent_thinking',
        provider: 'antigravity',
        conversationId: sourceConv,
        projectName: conv.projectName,
        step,
        thinking: thoughtText,
        preview: thoughtItem.preview,
        durationSeconds,
        mentionedFiles,
        timestamp: time,
        summary: `Cognitive reasoning turn #${step} (${durationSeconds}s)`
      };
      state.events.push(evt);
      if (state.events.length > 500) state.events.shift();
      updateStats();
      broadcastSSE('thinking', evt);
      broadcastSSE('conversation_update', {
        id: sourceConv,
        projectName: conv.projectName,
        latestThought: thoughtText,
        latestDuration: durationSeconds,
        step,
        thoughtItem,
        turn: turnObj
      });
    }

    // 2. Tool Calls Stream
    if (data.tool_calls && Array.isArray(data.tool_calls)) {
      for (let i = 0; i < data.tool_calls.length; i++) {
        const tc = data.tool_calls[i];
        const name = tc.name || 'unknown_tool';
        const args = tc.args || {};

        let actType = 'tool_call';
        let targetPath = null;
        let command = null;
        let snippet = null;

        const rawPath = args.AbsolutePath || args.TargetFile || args.Path || args.path || args.DirectoryPath || args.SearchPath || args.Cwd;
        if (rawPath) targetPath = normalizeFilePath(rawPath);

        const rawCmd = args.CommandLine || args.command;
        if (rawCmd) command = cleanString(rawCmd);

        if (name === 'view_file' || name === 'read_file' || name === 'grep_search') {
          actType = 'file_read';
        } else if (name === 'replace_file_content' || name === 'edit_file') {
          actType = 'file_write';
          snippet = cleanString(args.Description || args.Instruction || args.ReplacementContent || '');
        } else if (name === 'write_to_file' || name === 'write_file') {
          actType = 'file_create';
          snippet = cleanString(args.Description || (args.CodeContent ? args.CodeContent.slice(0, 160) : ''));
        } else if (name === 'run_command') {
          actType = 'terminal_command';
          snippet = command ? command.slice(0, 120) : '';
        } else if (name === 'list_dir' || name === 'find_by_name') {
          actType = 'search';
        } else if (name === 'invoke_subagent' || name === 'send_message') {
          actType = 'agent_lifecycle';
        }

        // Auto-extract real code snippet from disk if not populated
        if (!snippet && targetPath) {
          try {
            if (fs.existsSync(targetPath)) {
              const fileStat = fs.statSync(targetPath);
              if (fileStat.isFile() && fileStat.size < 600000) {
                const content = fs.readFileSync(targetPath, 'utf-8');
                const nonBlank = content.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
                if (nonBlank.length > 0) {
                  snippet = nonBlank.join('\n');
                }
              }
            }
          } catch {}
        }

        let touchedNode = null;
        if (targetPath) {
          touchedNode = recordNode(targetPath, actType, snippet);
        } else if (command) {
          touchedNode = recordNode(`cmd://${command.split(' ')[0]}`, actType, command);
        }

        const toolEvent = {
          id: `evt_tool_${step}_${i}_${Date.now()}`,
          type: 'tool_call',
          toolName: name,
          activityType: actType,
          provider: 'antigravity',
          conversationId: sourceConv,
          filePath: targetPath,
          command,
          snippet,
          step,
          timestamp: time,
          node: touchedNode ? { id: touchedNode.id, name: touchedNode.name, color: touchedNode.color } : null,
          summary: targetPath ? `${name} (${path.basename(targetPath)})` : (command ? `run (${command.slice(0, 35)}...)` : name)
        };

        state.events.push(toolEvent);
        if (state.events.length > 500) state.events.shift();
        conv.recentEvents.push(toolEvent);
        if (conv.recentEvents.length > 30) conv.recentEvents.shift();
        conv.lastUpdate = time;

        // Dynamically discover project name from target file path or working directory
        if (targetPath && conv.projectName.startsWith('project-')) {
          const better = getProjectNameForConversation(sourceConv, targetPath);
          if (!better.startsWith('project-')) {
            conv.projectName = better;
          }
        }

        // Pair action directly with the current turn's thought block for timeline cause-and-effect synchronization
        if (conv.turns && conv.turns.length > 0) {
          const currentTurn = conv.turns[conv.turns.length - 1];
          currentTurn.actions.push(toolEvent);
          if (currentTurn.actions.length > 20) currentTurn.actions.shift();
        }

        updateStats();
        broadcastSSE('tool', toolEvent);
      }
    }

    // 3. User Message Content
    if (data.content && typeof data.content === 'string' && data.content.trim()) {
      if (data.source === 'USER_EXPLICIT' || data.type === 'USER_INPUT') {
        const text = data.content.slice(0, 200).replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '').trim();
        const userEvt = {
          id: `evt_user_${step}_${Date.now()}`,
          type: 'user_input',
          activityType: 'user_dialogue',
          provider: 'antigravity',
          conversationId: sourceConv,
          text,
          step,
          timestamp: time,
          summary: `User Query: "${text.slice(0, 50)}..."`
        };
        state.events.push(userEvt);
        broadcastSSE('user', userEvt);
      }
    }
  } catch (err) {
    // Malformed JSON lines ignored gracefully
  }
}

// Active File Tailing System
const trackedFiles = new Map(); // path -> { offset: number, buffer: string, isReading: boolean }

function tailFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    let entry = trackedFiles.get(filePath);
    if (!entry) {
      entry = { offset: 0, buffer: '', isReading: false };
      trackedFiles.set(filePath, entry);
    }

    if (entry.isReading) return;

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      return;
    }

    // Reset offset if file was truncated or recreated
    if (stats.size < entry.offset) {
      entry.offset = 0;
      entry.buffer = '';
    }

    if (stats.size <= entry.offset) return;

    entry.isReading = true;
    const startOffset = entry.offset;
    entry.offset = stats.size; // Move offset forward immediately

    const stream = fs.createReadStream(filePath, { start: startOffset });

    // CRITICAL: Attach error listener immediately to prevent unhandled stream errors on Windows
    stream.on('error', (err) => {
      console.warn(`[Agent Brain Bridge] Read stream notice on ${path.basename(filePath)}: ${err?.message || err}`);
      entry.isReading = false;
    });

    stream.on('data', (chunk) => {
      try {
        entry.buffer += chunk.toString();
        const lines = entry.buffer.split('\n');
        entry.buffer = lines.pop() || '';
        for (const l of lines) {
          if (l.trim()) {
            processLogLine(l, filePath);
          }
        }
      } catch (parseErr) {
        console.warn(`[Agent Brain Bridge] Error processing stream chunk: ${parseErr?.message}`);
      }
    });

    stream.on('end', () => {
      entry.isReading = false;
      // If new bytes arrived while reading, tail again safely
      try {
        if (fs.existsSync(filePath)) {
          const newStats = fs.statSync(filePath);
          if (newStats.size > entry.offset) {
            setImmediate(() => tailFile(filePath));
          }
        }
      } catch {}
    });
  } catch (err) {
    const entry = trackedFiles.get(filePath);
    if (entry) entry.isReading = false;
    console.warn(`[Agent Brain Bridge] Notice in tailFile for ${path.basename(filePath)}: ${err?.message}`);
  }
}

// Find candidate transcript paths without thrashing disk
function findActiveTranscriptPaths() {
  const candidates = [];

  // Check known conversations first
  for (const cid of KNOWN_CONVERSATIONS) {
    const p = path.join(BRAIN_ROOT, cid, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(p)) {
      candidates.push({ path: p, cid, mtime: fs.statSync(p).mtimeMs });
    }
  }

  // Scan recent directories in BRAIN_ROOT
  if (fs.existsSync(BRAIN_ROOT)) {
    try {
      const subdirs = fs.readdirSync(BRAIN_ROOT);
      const now = Date.now();
      for (const sub of subdirs) {
        if (KNOWN_CONVERSATIONS.includes(sub)) continue;
        const p = path.join(BRAIN_ROOT, sub, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(p)) {
          const s = fs.statSync(p);
          // Within last 48 hours
          if (now - s.mtimeMs < 48 * 60 * 60 * 1000) {
            candidates.push({ path: p, cid: sub, mtime: s.mtimeMs });
          }
        }
      }
    } catch {}
  }

  // Sort by mtime descending (most recent first)
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates;
}

// Initial Scan
function loadInitialTranscripts() {
  const candidates = findActiveTranscriptPaths();
  if (candidates.length === 0) {
    console.warn(`[Agent Brain Bridge] No active transcripts found in ${BRAIN_ROOT}`);
    return;
  }

  // Set the most active conversation
  state.activeConversation = candidates[0].cid;
  console.log(`[Agent Brain Bridge] Primary active conversation: ${state.activeConversation}`);

  // Ingest candidates (up to 3 most recent)
  const toIngest = candidates.slice(0, 3).reverse();
  for (const c of toIngest) {
    try {
      console.log(`[Agent Brain Bridge] Ingesting history from: ${c.cid} (${path.basename(c.path)})`);
      const content = fs.readFileSync(c.path, 'utf-8');
      const lines = content.split('\n');
      for (const l of lines) {
        processLogLine(l, c.path);
      }
      trackedFiles.set(c.path, { offset: fs.statSync(c.path).size, buffer: '', isReading: false });
    } catch (err) {
      console.error(`[Agent Brain Bridge] Error loading initial transcript ${c.path}:`, err.message);
    }
  }

  console.log(`[Agent Brain Bridge] Initial state loaded: ${state.nodes.size} nodes, ${state.edges.length} edges, ${state.thoughts.length} thoughts, ${state.events.length} events.`);
}

function setupWatchers() {
  const candidates = findActiveTranscriptPaths();
  for (const c of candidates.slice(0, 6)) {
    if (!trackedFiles.has(c.path)) {
      const size = fs.existsSync(c.path) ? fs.statSync(c.path).size : 0;
      trackedFiles.set(c.path, { offset: size, buffer: '', isReading: false });
    }
    fs.watchFile(c.path, { interval: 200 }, () => {
      tailFile(c.path);
    });
  }

  // Low-frequency periodic discovery (every 8 seconds, check for new transcripts)
  setInterval(() => {
    try {
      const freshCandidates = findActiveTranscriptPaths();
      for (const fc of freshCandidates.slice(0, 6)) {
        if (!trackedFiles.has(fc.path)) {
          console.log(`[Agent Brain Bridge] Discovered active conversation transcript: ${fc.cid}`);
          trackedFiles.set(fc.path, { offset: 0, buffer: '', isReading: false });
          tailFile(fc.path);
          fs.watchFile(fc.path, { interval: 200 }, () => tailFile(fc.path));
        }
      }
    } catch {}
  }, 8000);
}

// Locate dashboard HTML file from multiple candidate locations
function findDashboardHtml() {
  const candidatePaths = [
    path.join(__dirname, 'agent_brain_dashboard.html'),
    path.join(BRAIN_ROOT, '12ab87b3-0219-43f1-bd04-f890005d6af6', 'agent_brain_dashboard.html'),
    path.join(BRAIN_ROOT, 'fea86683-facd-4b9d-8f71-103a84d2c33d', 'agent_brain_dashboard.html'),
    path.join(BRAIN_ROOT, state.activeConversation, 'agent_brain_dashboard.html'),
    path.join(BRAIN_ROOT, '5806cf9f-1883-4766-9dcd-a9e41efb3e97', 'agent_brain_dashboard.html')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Generate Full State Snapshot for API clients
function getFullStateSnapshot(currentPort = 5175) {
  return {
    activeConversation: state.activeConversation,
    conversations: Array.from(state.conversations.values()).map(c => ({
      id: c.id,
      projectName: c.projectName,
      latestThought: c.latestThought,
      latestDuration: c.latestDuration || 25,
      thoughts: c.thoughts.slice(-30),
      turns: c.turns ? c.turns.slice(-20) : [],
      stepCount: c.stepCount,
      lastUpdate: c.lastUpdate,
      recentEvents: c.recentEvents ? c.recentEvents.slice(-10) : []
    })),
    stats: state.stats,
    nodes: Array.from(state.nodes.values()),
    edges: state.edges,
    thoughts: state.thoughts.slice(-30),
    latestThought: state.latestThought,
    recentEvents: state.events.slice(-50),
    lastUpdate: state.lastUpdate,
    serverUptime: process.uptime(),
    activeClients: sseClients.size,
    bridgePort: currentPort,
    mode: 'antigravity_live_bridge'
  };
}

let activePort = 5175;

// Create HTTP and SSE Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-agent-token, x-provider');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url || '/', `http://${HOST}:${activePort}`);
  const pathname = urlObj.pathname;

  // 1. Root: Serves Agent Brain Sci-Fi Dashboard
  if (pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
    const htmlPath = findDashboardHtml();
    if (htmlPath) {
      try {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(html)
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(html);
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading dashboard HTML: ' + err.message);
        return;
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`<h1>Agent Brain Dashboard file not found</h1><p>Looked in scratch and brain directories.</p>`);
      return;
    }
  }

  // 2. Health & Status (mode='antigravity_live_bridge' identifies this server)
  if (pathname === '/api/health' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      mode: 'antigravity_live_bridge',
      port: activePort,
      activeConversation: state.activeConversation,
      uptime: process.uptime()
    }));
    return;
  }

  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      mode: 'antigravity_live_bridge',
      conversationId: state.activeConversation,
      eventsCaptured: state.events.length,
      nodesCount: state.nodes.size,
      edgesCount: state.edges.length,
      thoughtsCount: state.thoughts.length,
      activeClients: sseClients.size,
      lastUpdate: state.lastUpdate,
      bridgePort: activePort
    }));
    return;
  }

  // 3. Full State Snapshot
  if (pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getFullStateSnapshot(activePort)));
    return;
  }

  // 4. Server-Sent Events (SSE) Live Stream
  if (pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': connected\n\n');
    res.write(`event: initial_state\ndata: ${JSON.stringify(getFullStateSnapshot(activePort))}\n\n`);

    sseClients.add(res);
    console.log(`[Agent Brain Bridge] SSE Client connected. Active clients: ${sseClients.size}`);

    const cleanupClient = () => {
      if (sseClients.has(res)) {
        sseClients.delete(res);
        console.log(`[Agent Brain Bridge] SSE Client disconnected. Active clients: ${sseClients.size}`);
      }
    };

    req.on('close', cleanupClient);
    req.on('error', cleanupClient);
    res.on('close', cleanupClient);
    res.on('error', cleanupClient);
    return;
  }

  // 5. POST /api/events for VS Code or manual ingestion
  if (pathname === '/api/events' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const items = Array.isArray(payload) ? payload : [payload];
        for (const item of items) {
          const actType = item.activityType || 'tool_call';
          const p = item.filePath || item.path;
          let node = null;
          if (p) node = recordNode(p, actType, item.codeSnippet);

          const evt = {
            id: `evt_ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'external_event',
            activityType: actType,
            provider: item.provider || 'vscode',
            filePath: p,
            command: item.command,
            snippet: item.codeSnippet,
            timestamp: Date.now(),
            node: node ? { id: node.id, name: node.name, color: node.color } : null,
            summary: item.summary || (p ? `Touch ${path.basename(p)}` : actType)
          };
          state.events.push(evt);
          broadcastSSE('tool', evt);
        }
        updateStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: items.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
      }
    });
    return;
  }

  // 6. Test / Diagnostic Pulse endpoint
  if (pathname === '/api/pulse' && req.method === 'POST') {
    const pulseEvt = {
      id: `evt_pulse_${Date.now()}`,
      type: 'pulse',
      activityType: 'test_pulse',
      provider: 'antigravity',
      timestamp: Date.now(),
      summary: 'Diagnostic Neural Pulse'
    };
    broadcastSSE('pulse', pulseEvt);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 7. Conversations List & Switch endpoints
  if (pathname === '/api/conversations' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Array.from(state.conversations.values())));
    return;
  }

  if (pathname === '/api/active-conversation' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.id && state.conversations.has(payload.id)) {
          state.activeConversation = payload.id;
          broadcastSSE('conversation_switch', { activeConversation: payload.id });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, activeConversation: state.activeConversation }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

// Start Server with dynamic fallback
loadInitialTranscripts();
setupWatchers();

function tryListen(portIndex) {
  if (portIndex >= PREFERRED_PORTS.length) {
    console.error(`[Agent Brain Bridge] Could not bind to any preferred ports: ${PREFERRED_PORTS.join(', ')}`);
    process.exit(1);
  }

  const port = PREFERRED_PORTS[portIndex];

  const onListening = () => {
    server.removeListener('error', onError);
    activePort = port;
    console.log(`\n======================================================`);
    console.log(`🚀 AETHERIS LIVE BRIDGE ACTIVE`);
    console.log(`📡 Loopback Server: http://${HOST}:${activePort}/`);
    console.log(`⚡ Live SSE Stream: http://${HOST}:${activePort}/api/stream`);
    console.log(`📊 State Snapshot: http://${HOST}:${activePort}/api/state`);
    console.log(`🟢 Active Conversation: ${state.activeConversation}`);
    console.log(`======================================================\n`);

    if (process.argv.includes('--open')) {
      const url = `http://${HOST}:${activePort}/`;
      import('child_process').then(({ exec }) => {
        const cmd = process.platform === 'win32'
          ? `start "" "${url}"`
          : process.platform === 'darwin'
          ? `open "${url}"`
          : `xdg-open "${url}"`;
        exec(cmd, (err) => {
          if (err) console.warn(`[Agent Brain Bridge] Could not open browser automatically: ${err.message}`);
        });
      }).catch(() => {});
    }
  };

  const onError = (err) => {
    server.removeListener('listening', onListening);
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Agent Brain Bridge] Port ${port} is currently in use, trying next port...`);
      tryListen(portIndex + 1);
    } else {
      console.error(`[Agent Brain Bridge] Server error:`, err);
    }
  };

  server.once('listening', onListening);
  server.once('error', onError);
  server.listen(port, HOST);
}

tryListen(0);

// Heartbeat ping every 10 seconds
setInterval(() => {
  broadcastSSE('ping', { time: Date.now() });
}, 10000);
