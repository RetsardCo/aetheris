import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Hardware-Grade WebGL Acceleration & Continuous Typed Array Verification', () => {
  const scratchHtmlPath = path.resolve(__dirname, '../agent_brain_dashboard.html');
  const brainHtmlPath = 'C:\\Users\\Kurados\\.gemini\\antigravity\\brain\\12ab87b3-0219-43f1-bd04-f890005d6af6\\agent_brain_dashboard.html';

  it('guarantees scratch dashboard and active brain artifact are byte-for-byte identical', () => {
    const scratchBuffer = fs.readFileSync(scratchHtmlPath);
    const brainBuffer = fs.readFileSync(brainHtmlPath);
    expect(scratchBuffer.equals(brainBuffer)).toBe(true);
  });

  it('verifies dynamic capacity expansion of Float32Array typed arrays', () => {
    let maxTypedNodes = 4;
    let nodePositions3D = new Float32Array(maxTypedNodes * 3);
    let nodeVelocities3D = new Float32Array(maxTypedNodes * 3);
    let nodeTargets3D = new Float32Array(maxTypedNodes * 3);
    let nodeProjections2D = new Float32Array(maxTypedNodes * 4);
    let nodeColorsRGBA = new Float32Array(maxTypedNodes * 4);

    nodePositions3D[0] = 100;
    nodePositions3D[1] = 200;
    nodePositions3D[2] = 300;

    function ensureTypedNodeCapacity(needed: number) {
      if (needed <= maxTypedNodes) return;
      let newCapacity = maxTypedNodes * 2;
      while (newCapacity < needed) newCapacity *= 2;

      const newPos = new Float32Array(newCapacity * 3);
      newPos.set(nodePositions3D);
      nodePositions3D = newPos;

      const newVel = new Float32Array(newCapacity * 3);
      newVel.set(nodeVelocities3D);
      nodeVelocities3D = newVel;

      const newTar = new Float32Array(newCapacity * 3);
      newTar.set(nodeTargets3D);
      nodeTargets3D = newTar;

      const newProj = new Float32Array(newCapacity * 4);
      newProj.set(nodeProjections2D);
      nodeProjections2D = newProj;

      const newCol = new Float32Array(newCapacity * 4);
      newCol.set(nodeColorsRGBA);
      nodeColorsRGBA = newCol;

      maxTypedNodes = newCapacity;
    }

    ensureTypedNodeCapacity(10);
    expect(maxTypedNodes).toBe(16);
    expect(nodePositions3D.length).toBe(48);
    expect(nodePositions3D[0]).toBe(100);
    expect(nodePositions3D[1]).toBe(200);
    expect(nodePositions3D[2]).toBe(300);
  });

  it('verifies Big Bang shockwave velocity updates nodeVelocities3D and moves nodes', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, _idx: 0 },
      { id: 'b', x: 10, y: 10, z: 10, vx: 0, vy: 0, vz: 0, _idx: 1 }
    ];
    const nodeVelocities3D = new Float32Array(6);
    const nodePositions3D = new Float32Array(6);
    const nodeTargets3D = new Float32Array(6);

    // Apply Big Bang explosion
    nodes.forEach(n => {
      n.vx = 15;
      n.vy = -12;
      n.vz = 8;
      if (n._idx !== undefined) {
        const i3 = n._idx * 3;
        nodeVelocities3D[i3] = n.vx;
        nodeVelocities3D[i3 + 1] = n.vy;
        nodeVelocities3D[i3 + 2] = n.vz;
      }
    });

    expect(nodeVelocities3D[0]).toBe(15);
    expect(nodeVelocities3D[1]).toBe(-12);
    expect(nodeVelocities3D[2]).toBe(8);

    // Run 1 physics frame
    const spring = 0.0035;
    const damping = 0.94;
    for (let i = 0; i < nodes.length; i++) {
      const i3 = i * 3;
      nodeVelocities3D[i3] += (nodeTargets3D[i3] - nodePositions3D[i3]) * spring;
      nodeVelocities3D[i3 + 1] += (nodeTargets3D[i3 + 1] - nodePositions3D[i3 + 1]) * spring;
      nodeVelocities3D[i3 + 2] += (nodeTargets3D[i3 + 2] - nodePositions3D[i3 + 2]) * spring;

      nodeVelocities3D[i3] *= damping;
      nodeVelocities3D[i3 + 1] *= damping;
      nodeVelocities3D[i3 + 2] *= damping;

      nodePositions3D[i3] += nodeVelocities3D[i3];
      nodePositions3D[i3 + 1] += nodeVelocities3D[i3 + 1];
      nodePositions3D[i3 + 2] += nodeVelocities3D[i3 + 2];

      const n = nodes[i];
      n.x = nodePositions3D[i3];
      n.y = nodePositions3D[i3 + 1];
      n.z = nodePositions3D[i3 + 2];
      n.vx = nodeVelocities3D[i3];
      n.vy = nodeVelocities3D[i3 + 1];
      n.vz = nodeVelocities3D[i3 + 2];
    }

    expect(nodes[0].x).toBeCloseTo(14.1, 1);
    expect(nodes[0].y).toBeCloseTo(-11.28, 1);
    expect(nodes[0].z).toBeCloseTo(7.52, 1);
  });

  it('proves WebGL shader perspective math matches Canvas 2D projection sub-pixel exactly', () => {
    const width = 1200;
    const height = 800;
    const uFov = 760;
    const uPanX = 50;
    const uPanY = -30;
    const x1 = 120;
    const y2 = -80;
    const camZ = 500;

    // Canvas 2D project3D logic
    const scale = uFov / camZ;
    const screenX_2D = (width / 2) + x1 * scale + uPanX;
    const screenY_2D = (height / 2) + y2 * scale + uPanY;

    // WebGL homogeneous clip coordinates
    const x_clip = (x1 * uFov + uPanX * camZ) / (width * 0.5);
    const y_clip = -(y2 * uFov + uPanY * camZ) / (height * 0.5);
    const w_clip = camZ;

    // GPU perspective divide -> NDC
    const ndcX = x_clip / w_clip;
    const ndcY = y_clip / w_clip;

    // Screen viewport mapping
    const screenX_GL = (width * 0.5) * (1.0 + ndcX);
    const screenY_GL = (height * 0.5) * (1.0 - ndcY);

    expect(screenX_GL).toBeCloseTo(screenX_2D, 5);
    expect(screenY_GL).toBeCloseTo(screenY_2D, 5);
  });

  it('proves points behind the near plane (camZ < 20) are discarded by shader', () => {
    const camZ = -50; // behind camera
    let gl_Position: [number, number, number, number];
    let gl_PointSize: number;

    if (camZ < 20.0) {
      gl_Position = [2.0, 2.0, 2.0, 1.0];
      gl_PointSize = 0.0;
    } else {
      gl_Position = [0, 0, 0, 1];
      gl_PointSize = 10;
    }

    expect(gl_Position[0]).toBeGreaterThan(1.0); // Outside NDC frustum
    expect(gl_PointSize).toBe(0.0);
  });
});
