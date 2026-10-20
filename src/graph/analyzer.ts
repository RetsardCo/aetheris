import * as fs from 'fs';
import * as path from 'path';
import { GraphEdge, GraphNode, WorkspaceStats } from '../types/events';

const FOLDER_COLORS = [
  '#f97316', // Orange
  '#6366f1', // Indigo/Blue
  '#eab308', // Amber/Yellow
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#10b981', // Emerald/Green
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f43f5e'  // Rose
];

export class DependencyAnalyzer {
  private workspaceRoot: string;
  private excludedPatterns: string[];

  constructor(workspaceRoot: string, excludedPatterns: string[] = []) {
    this.workspaceRoot = workspaceRoot;
    this.excludedPatterns = excludedPatterns;
  }

  public isExcluded(filePath: string): boolean {
    const norm = filePath.replace(/\\/g, '/').toLowerCase();
    const defaultExcludes = ['/node_modules/', '/.git/', '/dist/', '/out/', '/build/', '/.vscode/'];
    for (const d of defaultExcludes) {
      if (norm.includes(d) || norm.endsWith(d.slice(0, -1))) {
        return true;
      }
    }
    for (const pat of this.excludedPatterns) {
      const clean = pat.replace(/\*\*/g, '').replace(/\*/g, '').toLowerCase();
      if (clean && norm.includes(clean)) {
        return true;
      }
    }
    return false;
  }

  public analyze(): { nodes: GraphNode[]; edges: GraphEdge[]; stats: WorkspaceStats } {
    if (!this.workspaceRoot || !fs.existsSync(this.workspaceRoot)) {
      return {
        nodes: [],
        edges: [],
        stats: {
          totalFiles: 0,
          totalFolders: 0,
          totalConnections: 0,
          touchedCount: 0,
          readCount: 0,
          writeCount: 0,
          toolCallCount: 0,
          topFolders: []
        }
      };
    }

    const allFiles: string[] = [];
    const allFolders: Set<string> = new Set();
    const folderCounts: Map<string, number> = new Map();

    const walk = (dir: string, depth = 0) => {
      if (depth > 8) return; // Prevent infinite recursion
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(this.workspaceRoot, fullPath).replace(/\\/g, '/');

        if (this.isExcluded(relPath)) continue;

        if (entry.isDirectory()) {
          allFolders.add(relPath);
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          allFiles.push(relPath);

          // Track folder counts
          const folderName = path.dirname(relPath) === '.' ? 'root files' : path.dirname(relPath).split('/')[0];
          folderCounts.set(folderName, (folderCounts.get(folderName) || 0) + 1);
        }
      }
    };

    walk(this.workspaceRoot);

    // Build Nodes
    const nodes: GraphNode[] = allFiles.map((relPath) => {
      const ext = path.extname(relPath).toLowerCase();
      const folder = path.dirname(relPath) === '.' ? 'root files' : path.dirname(relPath).split('/')[0];
      return {
        id: relPath,
        name: path.basename(relPath),
        type: 'file',
        extension: ext,
        folder,
        readCount: 0,
        writeCount: 0,
        createCount: 0,
        deleteCount: 0
      };
    });

    // Parse Static Dependency Edges
    const edges = this.extractStaticEdges(allFiles);

    // Calculate Top Folders
    const sortedFolders = Array.from(folderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([folder, count], idx) => ({
        path: folder,
        count,
        color: FOLDER_COLORS[idx % FOLDER_COLORS.length]
      }));

    const stats: WorkspaceStats = {
      totalFiles: allFiles.length,
      totalFolders: allFolders.size,
      totalConnections: edges.length,
      touchedCount: 0,
      readCount: 0,
      writeCount: 0,
      toolCallCount: 0,
      topFolders: sortedFolders
    };

    return { nodes, edges, stats };
  }

  private extractStaticEdges(allFiles: string[]): GraphEdge[] {
    const fileSet = new Set(allFiles);
    const edges: GraphEdge[] = [];
    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|from\s+(['"][^'"]+['"])\s+import)/g;

    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'].includes(ext)) {
        continue;
      }

      const fullPath = path.join(this.workspaceRoot, file);
      let content = '';
      try {
        // Read up to 64KB for safety
        const fd = fs.openSync(fullPath, 'r');
        const buffer = Buffer.alloc(64 * 1024);
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
        content = buffer.toString('utf8', 0, bytesRead);
      } catch {
        continue;
      }

      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const specifier = match[1] || match[2] || match[3]?.replace(/['"]/g, '');
        if (!specifier || !specifier.startsWith('.')) continue; // Only local relative imports

        const currentDir = path.dirname(file);
        const resolvedBase = path.normalize(path.join(currentDir, specifier)).replace(/\\/g, '/');

        // Check extensions
        const candidates = [
          resolvedBase,
          `${resolvedBase}.ts`,
          `${resolvedBase}.tsx`,
          `${resolvedBase}.js`,
          `${resolvedBase}.jsx`,
          `${resolvedBase}.mjs`,
          `${resolvedBase}/index.ts`,
          `${resolvedBase}/index.js`,
          `${resolvedBase}.py`
        ];

        for (const cand of candidates) {
          if (fileSet.has(cand) && cand !== file) {
            edges.push({
              id: `edge_${file}_to_${cand}`,
              source: file,
              target: cand,
              type: 'import',
              confidence: 1.0,
              provenance: 'static_import_parser'
            });
            break;
          }
        }
      }
    }

    return edges;
  }
}
