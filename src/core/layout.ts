import type { BootMesh } from './generateBoot';

/** Gap between copies on the build plate [mm]. */
export const COPY_GAP = 5;

/**
 * Arrange `count` copies of a mesh in a near-square grid on the build plate,
 * centred on the origin. Copies never touch, so the result stays manifold
 * (several separate shells).
 */
export function arrangeCopies(mesh: BootMesh, count: number, gap = COPY_GAP): BootMesh {
  const n = Math.max(1, Math.floor(count));
  if (n === 1) return mesh;
  const sx = mesh.bbox.max[0] - mesh.bbox.min[0] + gap;
  const sy = mesh.bbox.max[1] - mesh.bbox.min[1] + gap;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const nv = mesh.positions.length / 3;
  const positions = new Float32Array(mesh.positions.length * n);
  const indices = new Uint32Array(mesh.indices.length * n);
  for (let k = 0; k < n; k++) {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const dx = (col - (cols - 1) / 2) * sx;
    const dy = ((rows - 1) / 2 - row) * sy;
    for (let i = 0; i < nv; i++) {
      positions[(k * nv + i) * 3] = mesh.positions[i * 3] + dx;
      positions[(k * nv + i) * 3 + 1] = mesh.positions[i * 3 + 1] + dy;
      positions[(k * nv + i) * 3 + 2] = mesh.positions[i * 3 + 2];
    }
    for (let j = 0; j < mesh.indices.length; j++) {
      indices[k * mesh.indices.length + j] = mesh.indices[j] + k * nv;
    }
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], positions[i + a]);
      max[a] = Math.max(max[a], positions[i + a]);
    }
  }
  return {
    positions,
    indices,
    volume: mesh.volume * n,
    surfaceArea: mesh.surfaceArea * n,
    bbox: { min, max },
  };
}
