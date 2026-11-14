import type { BootMesh } from '../generateBoot';

type MeshData = Pick<BootMesh, 'positions' | 'indices'>;

/** Binary STL (little endian). */
export function meshToStl(mesh: MeshData, header = 'Furniture Hooves'): ArrayBuffer {
  const { positions: p, indices: idx } = mesh;
  const triCount = idx.length / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < Math.min(80, header.length); i++) bytes[i] = header.charCodeAt(i) & 0x7f;
  view.setUint32(80, triCount, true);
  let o = 84;
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3] * 3;
    const b = idx[t * 3 + 1] * 3;
    const c = idx[t * 3 + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a];
    const vy = p[c + 1] - p[a + 1];
    const vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    view.setFloat32(o, nx / len, true);
    view.setFloat32(o + 4, ny / len, true);
    view.setFloat32(o + 8, nz / len, true);
    o += 12;
    for (const v of [a, b, c]) {
      view.setFloat32(o, p[v], true);
      view.setFloat32(o + 4, p[v + 1], true);
      view.setFloat32(o + 8, p[v + 2], true);
      o += 12;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

/** Parse a binary STL back into triangle soup (used by tests). */
export function parseStl(buf: ArrayBuffer): { triangles: number; positions: Float32Array } {
  const view = new DataView(buf);
  const triangles = view.getUint32(80, true);
  if (buf.byteLength !== 84 + triangles * 50) throw new Error('Invalid binary STL size');
  const positions = new Float32Array(triangles * 9);
  let o = 84;
  for (let t = 0; t < triangles; t++) {
    o += 12;
    for (let k = 0; k < 9; k++) {
      positions[t * 9 + k] = view.getFloat32(o, true);
      o += 4;
    }
    o += 2;
  }
  return { triangles, positions };
}
