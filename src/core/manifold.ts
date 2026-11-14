import Module, { type ManifoldToplevel } from 'manifold-3d';

let wasm: ManifoldToplevel | null = null;
let pending: Promise<ManifoldToplevel> | null = null;

/**
 * Initialise the manifold-3d WASM module (once).
 * In the browser pass `wasmUrl` (Vite `?url` import); in Node it resolves itself.
 */
export function initManifold(wasmUrl?: string): Promise<ManifoldToplevel> {
  if (wasm) return Promise.resolve(wasm);
  if (!pending) {
    pending = Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined).then((m) => {
      m.setup();
      wasm = m;
      return m;
    });
  }
  return pending;
}

export function getManifold(): ManifoldToplevel {
  if (!wasm) throw new Error('manifold-3d not initialised – call initManifold() first');
  return wasm;
}
