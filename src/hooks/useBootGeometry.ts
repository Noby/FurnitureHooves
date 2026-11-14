import { useEffect, useRef, useState } from 'react';
import type { BootMesh } from '../core/generateBoot';
import type { BootParams } from '../core/params';
import type { GeometryRequest, GeometryResponse } from '../worker/geometry.worker';

export interface GeometryState {
  /** last successfully generated mesh (kept while params are invalid) */
  mesh: BootMesh | null;
  /** params the mesh was generated from */
  meshParams: BootParams | null;
  busy: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 150;

/** Generates the boot in a Web Worker, debounced; ignores stale responses. */
export function useBootGeometry(params: BootParams, valid: boolean): GeometryState {
  const workerRef = useRef<Worker | null>(null);
  const latestId = useRef(0);
  const pendingParams = useRef(new Map<number, BootParams>());
  const [state, setState] = useState<GeometryState>({
    mesh: null,
    meshParams: null,
    busy: true,
    error: null,
  });

  useEffect(() => {
    const worker = new Worker(new URL('../worker/geometry.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    const pending = pendingParams.current;
    worker.onmessage = (e: MessageEvent<GeometryResponse>) => {
      const res = e.data;
      const p = pending.get(res.id);
      pending.delete(res.id);
      if (res.id !== latestId.current) return; // stale
      if (res.ok) {
        setState({ mesh: res.mesh, meshParams: p ?? null, busy: false, error: null });
      } else {
        setState((s) => ({ ...s, busy: false, error: res.error }));
      }
    };
    worker.onerror = (e) => setState((s) => ({ ...s, busy: false, error: e.message }));
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!valid) {
      setState((s) => ({ ...s, busy: false }));
      return;
    }
    setState((s) => ({ ...s, busy: true }));
    const timer = setTimeout(() => {
      const id = ++latestId.current;
      pendingParams.current.set(id, params);
      const req: GeometryRequest = { id, params };
      workerRef.current?.postMessage(req);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [params, valid]);

  return state;
}
