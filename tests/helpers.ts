import type { BootMesh } from '../src/core/generateBoot';

/**
 * Checks a mesh is a closed 2-manifold: after merging coincident vertices every
 * directed edge appears exactly once and its reverse exists exactly once.
 */
export function isManifold(mesh: Pick<BootMesh, 'positions' | 'indices'>): boolean {
  const key = (i: number) => {
    const p = mesh.positions;
    return `${p[i * 3].toFixed(4)},${p[i * 3 + 1].toFixed(4)},${p[i * 3 + 2].toFixed(4)}`;
  };
  const ids = new Map<string, number>();
  const remap = new Uint32Array(mesh.positions.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const k = key(i);
    if (!ids.has(k)) ids.set(k, ids.size);
    remap[i] = ids.get(k)!;
  }
  const edges = new Map<string, number>();
  const idx = mesh.indices;
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = remap[idx[t + e]];
      const b = remap[idx[t + ((e + 1) % 3)]];
      if (a === b) return false;
      const k = `${a}>${b}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const [k, count] of edges) {
    if (count !== 1) return false;
    const [a, b] = k.split('>');
    if (edges.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}

/** Signed volume of a closed triangle mesh (divergence theorem). */
export function signedVolume(mesh: Pick<BootMesh, 'positions' | 'indices'>): number {
  const p = mesh.positions;
  const idx = mesh.indices;
  let v = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    v +=
      (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
        p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
        p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) /
      6;
  }
  return v;
}
