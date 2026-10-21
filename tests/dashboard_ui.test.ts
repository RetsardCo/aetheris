import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Agent Brain 3D Dashboard & UI Verification', () => {
  const scratchHtmlPath = path.resolve(__dirname, '../agent_brain_dashboard.html');
  const brainHtmlPath = 'C:\\Users\\Kurados\\.gemini\\antigravity\\brain\\12ab87b3-0219-43f1-bd04-f890005d6af6\\agent_brain_dashboard.html';

  it('scratch dashboard HTML exists and is populated', () => {
    expect(fs.existsSync(scratchHtmlPath)).toBe(true);
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content.length).toBeGreaterThan(10000);
  });

  it('brain artifact dashboard HTML exists and matches scratch version', () => {
    expect(fs.existsSync(brainHtmlPath)).toBe(true);
    const scratchContent = fs.readFileSync(scratchHtmlPath, 'utf-8');
    const brainContent = fs.readFileSync(brainHtmlPath, 'utf-8');
    expect(brainContent).toBe(scratchContent);
  });

  it('removes scanline and blurry CRT effect filters completely', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).not.toContain('class="scanline"');
    expect(content).not.toContain('.scanline {');
  });

  it('implements 3D orbital projection engine and 360-degree camera controls', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('project3D');
    expect(content).toContain('camera.yaw');
    expect(content).toContain('camera.pitch');
    expect(content).toContain('autoOrbit');
    expect(content).toContain('360° ORBIT');
    expect(content).toContain('Isometric 3D');
  });

  it('implements 3D cluster hull meshes and luminous connections web', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('clusterHull');
    expect(content).toContain('chkClusterHulls');
    expect(content).toContain('chkConnections');
    expect(content).toContain('energyPackets');
    expect(content).toContain('comets3D');
  });

  it('implements live AI thinking reasoning stream and inspector HUD', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('latestThoughtContent');
    expect(content).toContain('thoughtModal');
    expect(content).toContain('nodeInspectorModal');
    expect(content).toContain('btnBigBang');
    expect(content).toContain('btnPulseCore');
  });

  it('implements syntax-highlighted code trace cards matching reference design', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('code-syntax');
    expect(content).toContain('syn-keyword');
    expect(content).toContain('syn-fn');
    expect(content).toContain('syn-string');
    expect(content).toContain('formatSyntaxHighlight');
    expect(content).toContain('traceCardsContainer');
  });

  it('implements smart labeling with text backdrops to eliminate unreadable label clumps', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('shouldShowLabel');
    expect(content).toContain('roundRect');
    expect(content).toContain('chkLabels');
    expect(content).toContain('isHovered');
    expect(content).toContain('badgeWidth');
  });

  it('implements wide 3D cluster constellations and polyhedral cages', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('cageVerts');
    expect(content).toContain('cageEdges');
    expect(content).toContain('ringPts');
    expect(content).toContain('clusterCentroids');
    expect(content).toContain('CORE ENGINE');
    expect(content).toContain('WEBVIEW UI');
    expect(content).toContain('ADAPTERS');
  });

  it('implements Antigravity thought panel at the bottom ("sa baba") with duration badge and expandable drawer', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('cognitionDock');
    expect(content).toContain('thoughtDurationBadge');
    expect(content).toContain('thoughtDurationText');
    expect(content).toContain('thoughtChevron');
    expect(content).toContain('cognitionDrawer');
    expect(content).toContain('Thought for 25s');
    expect(content).toContain('toggleCognitionDock');
    expect(content).toContain('renderThoughtMarkdown');
  });

  it('implements semi-transparent luminous 3D nodes so nodes behind them are visible', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('hexToRgba');
    expect(content).toContain('baseAlpha');
    expect(content).toContain('coreGrad');
    expect(content).toContain('haloGrad');
    expect(content).toContain('Frosted Glass Effect');
  });

  it('implements multi-project layered panels with smooth animated switching transitions', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('projectTabBar');
    expect(content).toContain('projectTabsContainer');
    expect(content).toContain('projectPanelsWrapper');
    expect(content).toContain('switchProjectTab');
    expect(content).toContain('project-pane');
    expect(content).toContain('slide-left');
    expect(content).toContain('projectState');
    expect(content).toContain('renderProjectPanels');
  });

  it('guarantees distinct non-overlapping layout containers for project tabs and thought badge in cognition dock', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('projectTabsContainer');
    expect(content).toContain('thoughtBadgeBar');
    // Ensure projectTabBar is constrained with flex-shrink: 0 and horizontal scrolling
    expect(content).toMatch(/#projectTabBar[\s\S]*?overflow-x:\s*auto/);
    expect(content).toMatch(/#projectTabBar[\s\S]*?flex-shrink:\s*0/);
    // Ensure thoughtBadgeBar flexes dynamically with min-width: 0 to prevent overlapping siblings
    expect(content).toMatch(/#thoughtBadgeBar[\s\S]*?flex:\s*1\s+1/);
    expect(content).toMatch(/#thoughtBadgeBar[\s\S]*?min-width:\s*0/);
    // Ensure latestThoughtContent truncates gracefully
    expect(content).toMatch(/#latestThoughtContent[\s\S]*?text-overflow:\s*ellipsis/);
  });

  it('unblocks the center 3D canvas viewport by removing center-blocking floating panels', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('viewportCanvas');
    // Ensure traceLog is docked and not floating in the canvas center overlay
    expect(content).not.toContain('<div class="self-center pointer-events-auto w-[640px]');
  });

  it('bridge server supports multi-project tracking, thought durations, and API endpoints', () => {
    const bridgePath = path.resolve(__dirname, '../live_bridge_server.mjs');
    expect(fs.existsSync(bridgePath)).toBe(true);
    const bridgeContent = fs.readFileSync(bridgePath, 'utf-8');
    expect(bridgeContent).toContain('conversations: new Map()');
    expect(bridgeContent).toContain('durationSeconds');
    expect(bridgeContent).toContain('getProjectNameForConversation');
    expect(bridgeContent).toContain('getOrCreateConversation');
    expect(bridgeContent).toContain('/api/conversations');
    expect(bridgeContent).toContain('conversation_update');
    expect(bridgeContent).toContain('extractMentionedFiles');
    expect(bridgeContent).toContain('conv.turns');
  });

  it('implements automatic node highlighting with ambient energy aura during AI thought reasoning', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('highlightThoughtNodes');
    expect(content).toContain('hasThoughtAura');
    expect(content).toContain('n._thoughtAura');
    expect(content).toContain('auraRad');
    expect(content).toContain('auraGrad');
  });

  it('implements synchronized cause-and-effect timeline turns pairing thoughts with subsequent file actions', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('turns-timeline');
    expect(content).toContain('turn-card');
    expect(content).toContain('PRODUCED ACTIONS');
    expect(content).toContain('action-node-pill');
    expect(content).toContain('COGNITION TIMELINE');
  });

  it('implements collapsible sidebars to give 100% unobstructed central 3D viewport width', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('btnToggleLeftSidebar');
    expect(content).toContain('btnToggleRightSidebar');
    expect(content).toContain('leftSidebar');
    expect(content).toContain('rightTraceStack');
  });

  it('implements live typing stream animation with streaming cursor indicator', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('streamingThoughtText');
    expect(content).toContain('cursor-stream');
    expect(content).toContain('cursor-blink');
  });

  it('renders 3D canvas across entire viewport background with Apple-style frosted glass floating overlay panels', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-auto');
    expect(content).toContain('apple-glass');
    expect(content).toContain('backdrop-filter: blur(20px) saturate(180%)');
    expect(content).toContain('flex-1 min-h-0 overflow-y-auto');
  });

  it('implements continuous 3D camera node follow and dynamic target LookAt tracking', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('trackingNode');
    expect(content).toContain('lookAtX');
    expect(content).toContain('lookAtY');
    expect(content).toContain('lookAtZ');
    expect(content).toContain('targetLookAtX');
    expect(content).toContain('trackingBanner');
    expect(content).toContain('btnClearTracking');
    expect(content).toContain('showTrackingUI');
    expect(content).toContain('hideTrackingUI');
    expect(content).toContain('FOLLOWING NODE:');
  });

  it('fixes wild spinning bug with shortest-path angular delta wrapping and velocity clamping', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('deltaYaw');
    expect(content).toContain('(camera.targetYaw - camera.yaw) % (Math.PI * 2)');
    expect(content).toContain('deltaYaw > Math.PI');
    expect(content).toContain('deltaYaw < -Math.PI');
    expect(content).toContain('maxAngularStep');
    expect(content).toContain('camera.targetYaw = camera.yaw');
  });

  it('docks Live Agent Trace terminal neatly at bottom-left side with active filter controls and collapse toggle', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('liveAgentTraceDock');
    expect(content).toContain('traceLog');
    expect(content).toContain('trace-filter');
    expect(content).toContain('btnToggleTraceDock');
    expect(content).toContain('LIVE AGENT TRACE');
    expect(content).toContain('activeTraceFilter');
    expect(content).toContain('btnToggleTraceDock.addEventListener');
  });

  it('applies explicit CSS layout styles preventing panel cutoffs and ensuring clean scrolling', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('#leftSidebar {');
    expect(content).toContain('#liveAgentTraceDock {');
    expect(content).toContain('#rightTraceStack {');
    expect(content).toContain('height: calc(100vh - 124px);');
  });

  it('removes central coreLabel watermark completely from dashboard', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).not.toContain('id="coreLabel"');
    expect(content).not.toContain('AETHERIS CORE');
    expect(content).not.toContain('SYNAPSE ACTIVE // 360° ORBIT');
  });

  it('implements reversed natural camera drag rotation controls', () => {
    const content = fs.readFileSync(scratchHtmlPath, 'utf-8');
    expect(content).toContain('camera.yaw -= dx * 0.007');
    expect(content).toContain('camera.pitch + dy * 0.007');
  });

  it('provides turnkey automated installation and launch scripts for Windows, macOS, and Linux', () => {
    const rootDir = path.resolve(__dirname, '..');
    const scripts = [
      'setup.bat',
      'setup.ps1',
      'setup.sh',
      'start.bat',
      'start.ps1',
      'start.sh',
      'scripts/setup.mjs'
    ];

    for (const relPath of scripts) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath), `Expected ${relPath} to exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content.length).toBeGreaterThan(50);
    }

    // Verify setup scripts contain Node >= 18 check, directory resolution, and vsix packaging
    const setupBat = fs.readFileSync(path.join(rootDir, 'setup.bat'), 'utf-8');
    expect(setupBat).toContain('NODE_MAJOR');
    expect(setupBat).toContain('%~dp0');
    expect(setupBat).toContain('npm run package');
    expect(setupBat).toContain('--install-extension');

    const setupPs1 = fs.readFileSync(path.join(rootDir, 'setup.ps1'), 'utf-8');
    expect(setupPs1).toContain('$nodeMajor');
    expect(setupPs1).toContain('$PSScriptRoot');
    expect(setupPs1).toContain('npm run package');
    expect(setupPs1).toContain('--install-extension');

    const setupSh = fs.readFileSync(path.join(rootDir, 'setup.sh'), 'utf-8');
    expect(setupSh).toContain('NODE_MAJOR');
    expect(setupSh).toContain('dirname');
    expect(setupSh).toContain('npm run package');
    expect(setupSh).toContain('--install-extension');
    expect(setupSh).not.toContain('\r\n');

    const setupMjs = fs.readFileSync(path.join(rootDir, 'scripts/setup.mjs'), 'utf-8');
    expect(setupMjs).toContain('process.versions.node');
    expect(setupMjs).toContain('npm run package');

    // Verify start scripts invoke live_bridge_server with --open
    const startBat = fs.readFileSync(path.join(rootDir, 'start.bat'), 'utf-8');
    expect(startBat).toContain('live_bridge_server.mjs --open');
    expect(startBat).toContain('%~dp0');

    const startPs1 = fs.readFileSync(path.join(rootDir, 'start.ps1'), 'utf-8');
    expect(startPs1).toContain('live_bridge_server.mjs --open');
    expect(startPs1).toContain('$PSScriptRoot');

    const startSh = fs.readFileSync(path.join(rootDir, 'start.sh'), 'utf-8');
    expect(startSh).toContain('live_bridge_server.mjs --open');
    expect(startSh).toContain('dirname');
    expect(startSh).not.toContain('\r\n');
  });

  it('configures setup and start scripts in package.json', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts.setup).toBeDefined();
    expect(pkg.scripts.start).toBeDefined();
    expect(pkg.scripts.setup).toContain('setup.mjs');
    expect(pkg.scripts.start).toContain('live_bridge_server.mjs');
  });

  it('contains zero emojis and comprehensive cross-platform deployment instructions in README.md', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    const content = fs.readFileSync(readmePath, 'utf-8');
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(content.match(emojiRegex)).toBeNull();
    expect(content).toContain('Quick Start and Automated PC Deployment');
    expect(content).toContain('setup.bat');
    expect(content).toContain('setup.ps1');
    expect(content).toContain('setup.sh');
    expect(content).toContain('start.bat');
    expect(content).toContain('npm run setup');
    expect(content).toContain('npm start');
  });

  it('implements high-impact 60-144 FPS rendering optimizations in dashboard and constellation graph', () => {
    const dashboardContent = fs.readFileSync(scratchHtmlPath, 'utf-8');
    // Pre-rendered offscreen sprite atlas cache
    expect(dashboardContent).toContain('getHaloSprite');
    expect(dashboardContent).toContain('getCoreSprite');
    expect(dashboardContent).toContain('getSingularitySprite');
    expect(dashboardContent).toContain('getThoughtAuraSprite');
    expect(dashboardContent).toContain('haloSpriteCache');
    expect(dashboardContent).toContain('coreSpriteCache');

    // Quality modes and clamped DPR
    expect(dashboardContent).toContain('QualitySettings');
    expect(dashboardContent).toContain('btnPerfHigh');
    expect(dashboardContent).toContain('btnPerfBalanced');
    expect(dashboardContent).toContain('btnPerfPerformance');
    expect(dashboardContent).toContain('turbo');
    expect(dashboardContent).toContain('Math.min(window.devicePixelRatio');

    // Batched edge draws and frustum culling
    expect(dashboardContent).toContain('edgeBuckets');
    expect(dashboardContent).toContain('highEdges');
    expect(dashboardContent).toContain('culled');
    expect(dashboardContent).toContain('smoothedFps');

    // Level of Detail (LOD) & Distance Culling
    expect(dashboardContent).toContain('cfg.lodDist');
    expect(dashboardContent).toContain('isDistantNode');
    expect(dashboardContent).toContain('isDistantCluster');

    // Zero-allocation projection buffer reuse & star batching
    expect(dashboardContent).toContain('scratchProj');
    expect(dashboardContent).toContain('coreProjBuffer');
    expect(dashboardContent).toContain('starBuckets');
    expect(dashboardContent).toContain('nodeDepthComparator');
    expect(dashboardContent).toContain('project3D(px, py, pz, out)');

    // VS Code ConstellationGraph optimizations
    const graphComponentPath = path.resolve(__dirname, '../src/webview/components/ConstellationGraph.tsx');
    expect(fs.existsSync(graphComponentPath)).toBe(true);
    const graphContent = fs.readFileSync(graphComponentPath, 'utf-8');
    expect(graphContent).toContain('Math.min(window.devicePixelRatio || 1, 2)');
    expect(graphContent).toContain('cachedScanGrad');
    expect(graphContent).toContain('fpsDisplay');
    expect(graphContent).toContain('minX');
    expect(graphContent).toContain('maxX');
    expect(graphContent).toContain('getGlowSprite');
    expect(graphContent).toContain('glowSpriteCache');
    expect(graphContent).toContain('starBucketsRef');
    expect(graphContent).toContain('computeClusterCentroids');
    expect(graphContent).toContain('projectedOctaRef');
    expect(graphContent).toContain('CRYSTAL_EDGES');
  });
});


