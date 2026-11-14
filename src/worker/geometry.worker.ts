/// <reference lib="webworker" />
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { generateBoot, type BootMesh } from '../core/generateBoot';
import { initManifold } from '../core/manifold';
import type { BootParams } from '../core/params';

export interface GeometryRequest {
  id: number;
  params: BootParams;
}

export type GeometryResponse =
  { id: number; ok: true; mesh: BootMesh; ms: number } | { id: number; ok: false; error: string };

const ready = initManifold(wasmUrl);
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (e: MessageEvent<GeometryRequest>) => {
  const { id, params } = e.data;
  try {
    await ready;
    const t0 = performance.now();
    const mesh = generateBoot(params);
    const msg: GeometryResponse = { id, ok: true, mesh, ms: performance.now() - t0 };
    scope.postMessage(msg, [mesh.positions.buffer, mesh.indices.buffer]);
  } catch (err) {
    const msg: GeometryResponse = { id, ok: false, error: String(err) };
    scope.postMessage(msg);
  }
};
