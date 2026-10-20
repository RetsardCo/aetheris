import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GraphEdge, GraphNode, ActivityType, Provider } from '../../types/events';

interface ConstellationGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  searchQuery: string;
  showAllLabels: boolean;
  attentionOnly: boolean;
  selectedFolder: string | null;
  onSelectNode: (node: GraphNode) => void;
  onOpenFile: (filePath: string) => void;
  onTriggerReplay: () => void;
}

interface NodeSimulationPoint {
  id: string;
  name: string;
  folder: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
  pulseRadius: number;
  node: GraphNode;
}

interface CometParticle {
  angle: number;
  speed: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  tail: Array<{ x: number; y: number; alpha: number }>;
}

export const ConstellationGraph: React.FC<ConstellationGraphProps> = ({
  nodes,
  edges,
  searchQuery,
  showAllLabels,
  attentionOnly,
  selectedFolder,
  onSelectNode,
  onOpenFile,
  onTriggerReplay
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Transform state: pan & zoom
  const transformRef = useRef({ x: 0, y: 0, scale: 1.0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<NodeSimulationPoint | null>(null);

  // Crystal rotation angle
  const crystalAngleRef = useRef(0);

  // Comet particle
  const cometRef = useRef<CometParticle>({
    angle: 0,
    speed: 0.015,
    radiusX: 280,
    radiusY: 180,
    rotation: -0.3,
    tail: []
  });

  // Filtered nodes
  const displayNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (attentionOnly) {
        const isTouched = (n.readCount + n.writeCount + n.createCount + n.deleteCount) > 0;
        if (!isTouched) return false;
      }
      if (selectedFolder && selectedFolder !== 'all') {
        if (n.folder !== selectedFolder) return false;
      }
      return true;
    });
  }, [nodes, attentionOnly, selectedFolder]);

  // Simulation points
  const pointsRef = useRef<Map<string, NodeSimulationPoint>>(new Map());

  // Background stars
  const starsRef = useRef<Array<{ x: number; y: number; r: number; alpha: number }>>([]);

  useEffect(() => {
    // Generate background ambient stars
    const stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.2
      });
    }
    starsRef.current = stars;
  }, []);

  // Sync simulation points with display nodes
  useEffect(() => {
    const currentPoints = pointsRef.current;
    const newMap = new Map<string, NodeSimulationPoint>();

    // Folder clusters
    const folderAngles = new Map<string, number>();
    let folderIdx = 0;

    displayNodes.forEach((node) => {
      if (!folderAngles.has(node.folder)) {
        folderAngles.set(node.folder, (folderIdx * 2 * Math.PI) / 8);
        folderIdx++;
      }
    });

    displayNodes.forEach((node) => {
      const existing = currentPoints.get(node.id);
      const isTouched = (node.readCount + node.writeCount + node.createCount + node.deleteCount) > 0;

      let color = '#475569';
      let glowColor = 'rgba(71, 85, 105, 0.4)';
      let radius = 3.5;

      if (node.lastActivityType === 'file_write') {
        color = '#f59e0b';
        glowColor = 'rgba(245, 158, 11, 0.8)';
        radius = 5.5;
      } else if (node.lastActivityType === 'file_read') {
        color = '#38bdf8';
        glowColor = 'rgba(56, 189, 248, 0.8)';
        radius = 5.0;
      } else if (node.lastActivityType === 'file_create') {
        color = '#10b981';
        glowColor = 'rgba(16, 185, 129, 0.8)';
        radius = 5.5;
      } else if (node.lastActivityType === 'file_delete') {
        color = '#ef4444';
        glowColor = 'rgba(239, 68, 68, 0.8)';
        radius = 5.0;
      } else if (isTouched) {
        color = '#f97316';
        glowColor = 'rgba(249, 115, 22, 0.6)';
        radius = 4.5;
      }

      if (existing) {
        existing.node = node;
        existing.color = color;
        existing.glowColor = glowColor;
        existing.radius = radius;
        newMap.set(node.id, existing);
      } else {
        // Place around folder cluster
        const fAngle = folderAngles.get(node.folder) || 0;
        const dist = 140 + Math.random() * 220;
        const spread = (Math.random() - 0.5) * 1.2;
        const angle = fAngle + spread;

        newMap.set(node.id, {
          id: node.id,
          name: node.name,
          folder: node.folder,
          x: Math.cos(angle) * dist + (Math.random() - 0.5) * 40,
          y: Math.sin(angle) * dist + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
          radius,
          color,
          glowColor,
          pulseRadius: isTouched ? 12 : 0,
          node
        });
      }
    });

    pointsRef.current = newMap;
  }, [displayNodes]);

  // Main Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initial center offset
    const rect = canvas.getBoundingClientRect();
    if (transformRef.current.x === 0 && transformRef.current.y === 0) {
      transformRef.current.x = rect.width / 2;
      transformRef.current.y = rect.height / 2;
    }

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const { x: panX, y: panY, scale } = transformRef.current;

      ctx.clearRect(0, 0, width, height);

      // Save context for transform
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(scale, scale);

      // 1. Draw ambient space background stars
      for (const star of starsRef.current) {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw Center Crystal (3D Wireframe Octahedron & Horizontal Scanline)
      crystalAngleRef.current += 0.008;
      const cAngle = crystalAngleRef.current;
      const crystalSize = 55;

      // Draw horizontal horizon scanline
      const scanGrad = ctx.createLinearGradient(-350, 0, 350, 0);
      scanGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      scanGrad.addColorStop(0.3, 'rgba(6, 182, 212, 0.2)');
      scanGrad.addColorStop(0.5, 'rgba(20, 184, 166, 0.8)');
      scanGrad.addColorStop(0.7, 'rgba(6, 182, 212, 0.2)');
      scanGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.strokeStyle = scanGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-350, 0);
      ctx.lineTo(350, 0);
      ctx.stroke();

      // Octahedron 3D projection
      const vertices = [
        { x: 0, y: -crystalSize * 1.3, z: 0 }, // top
        { x: 0, y: crystalSize * 1.3, z: 0 },  // bottom
        { x: -crystalSize, y: 0, z: -crystalSize },
        { x: crystalSize, y: 0, z: -crystalSize },
        { x: crystalSize, y: 0, z: crystalSize },
        { x: -crystalSize, y: 0, z: crystalSize }
      ];

      // Rotate around Y and slight X tilt
      const projected = vertices.map((v) => {
        const radY = cAngle;
        const radX = 0.25;
        // Rotate Y
        const x1 = v.x * Math.cos(radY) + v.z * Math.sin(radY);
        const z1 = -v.x * Math.sin(radY) + v.z * Math.cos(radY);
        // Rotate X
        const y2 = v.y * Math.cos(radX) - z1 * Math.sin(radX);
        const z2 = v.y * Math.sin(radX) + z1 * Math.cos(radX);
        return { x: x1, y: y2, z: z2 };
      });

      // Octahedron faces / edges
      const crystalEdges = [
        [0, 2], [0, 3], [0, 4], [0, 5],
        [1, 2], [1, 3], [1, 4], [1, 5],
        [2, 3], [3, 4], [4, 5], [5, 2]
      ];

      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.9)';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1.5;

      for (const [i1, i2] of crystalEdges) {
        ctx.beginPath();
        ctx.moveTo(projected[i1].x, projected[i1].y);
        ctx.lineTo(projected[i2].x, projected[i2].y);
        ctx.stroke();
      }

      // Draw crystal vertex points
      ctx.fillStyle = '#ffffff';
      for (const p of projected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Draw Dependency Edges
      const points = pointsRef.current;
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const p1 = points.get(edge.source);
        const p2 = points.get(edge.target);
        if (p1 && p2) {
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // 4. Draw Constellation Nodes
      const queryLower = searchQuery.toLowerCase().trim();

      points.forEach((p) => {
        const isMatch = queryLower ? p.id.toLowerCase().includes(queryLower) : false;
        const isHovered = hoveredNodeRef.current?.id === p.id;

        // Draw glow aura
        ctx.save();
        if (isMatch || isHovered) {
          ctx.shadowBlur = 24;
          ctx.shadowColor = '#38bdf8';
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.shadowBlur = p.radius > 4 ? 14 : 0;
          ctx.shadowColor = p.glowColor;
          ctx.fillStyle = p.color;
        }

        // Draw concentric pulse ring if active
        if (p.pulseRadius > 0) {
          ctx.strokeStyle = p.glowColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Main node dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHovered ? p.radius + 2 : p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Node Label
        const shouldShowLabel = showAllLabels || isMatch || isHovered || p.radius > 5;
        if (shouldShowLabel && scale > 0.4) {
          ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = isMatch ? '#38bdf8' : isHovered ? '#ffffff' : '#94a3b8';
          ctx.fillText(p.name, p.x + p.radius + 5, p.y + 3);
        }
      });

      // 5. Draw Orbiting Comet Trail
      const comet = cometRef.current;
      comet.angle += comet.speed;
      const curX = Math.cos(comet.angle) * comet.radiusX;
      const curY = Math.sin(comet.angle) * comet.radiusY;

      // Rotate comet coordinate
      const rotX = curX * Math.cos(comet.rotation) - curY * Math.sin(comet.rotation);
      const rotY = curX * Math.sin(comet.rotation) + curY * Math.cos(comet.rotation);

      // Add to tail
      comet.tail.unshift({ x: rotX, y: rotY, alpha: 1.0 });
      if (comet.tail.length > 25) {
        comet.tail.pop();
      }

      // Draw tail curve
      ctx.save();
      for (let i = 0; i < comet.tail.length; i++) {
        const pt = comet.tail[i];
        const alpha = (1 - i / comet.tail.length) * 0.6;
        const rad = Math.max(1, (1 - i / comet.tail.length) * 3);
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw comet head
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#38bdf8';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(rotX, rotY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore(); // Restore pan/zoom

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [edges, searchQuery, showAllLabels]);

  // Mouse Interactions: Pan, Zoom, Hover, Click
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      transformRef.current.x = e.clientX - dragStartRef.current.x;
      transformRef.current.y = e.clientY - dragStartRef.current.y;
      return;
    }

    // Hover hit test
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x: panX, y: panY, scale } = transformRef.current;
    const worldX = (mouseX - panX) / scale;
    const worldY = (mouseY - panY) / scale;

    let found: NodeSimulationPoint | null = null;
    pointsRef.current.forEach((p) => {
      const dist = Math.hypot(p.x - worldX, p.y - worldY);
      if (dist <= Math.max(p.radius + 4, 8)) {
        found = p;
      }
    });

    hoveredNodeRef.current = found;
    if (canvas) {
      canvas.style.cursor = found ? 'pointer' : 'grab';
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNodeRef.current) {
      const target = hoveredNodeRef.current;
      onSelectNode(target.node);
      onOpenFile(target.node.id);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const currentScale = transformRef.current.scale;
    const newScale = Math.min(Math.max(currentScale * zoomFactor, 0.2), 5.0);

    // Zoom towards mouse position
    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (newScale / currentScale);
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (newScale / currentScale);
    transformRef.current.scale = newScale;
  };

  const handleBigBang = () => {
    // Blast nodes outward and settle
    pointsRef.current.forEach((p) => {
      const angle = Math.atan2(p.y, p.x);
      const dist = Math.hypot(p.x, p.y) * 1.5 + 100;
      p.x = Math.cos(angle) * dist;
      p.y = Math.sin(angle) * dist;
    });
  };

  const handleResetView = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      transformRef.current = {
        x: canvas.clientWidth / 2,
        y: canvas.clientHeight / 2,
        scale: 1.0
      };
    }
  };

  return (
    <div className="graph-viewport">
      <canvas
        ref={canvasRef}
        className="canvas-element"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Floating Bottom Action Bar */}
      <div className="bottom-controls-bar">
        <button className="control-pill-btn" onClick={onTriggerReplay} title="Replay recorded session events">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Replay
        </button>
        <button className="control-pill-btn" onClick={handleBigBang} title="Cosmic expansion animation">
          big bang
        </button>
        <button className="control-pill-btn" onClick={handleResetView} title="Reset camera center">
          Reset View
        </button>
      </div>
    </div>
  );
};
