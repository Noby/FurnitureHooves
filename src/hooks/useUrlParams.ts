import { useEffect, useState } from 'react';
import { DEFAULT_PARAMS } from '../core/defaults';
import type { BootParams } from '../core/params';
import { decodeParams, encodeParams, sanitizeParams } from '../core/urlCodec';
import { validateParams } from '../core/validate';

const STORAGE_KEY = 'furniture-hooves:params:v1';

export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage – ignore */
  }
}

/** Priority: URL query → localStorage → defaults. */
function initialParams(): BootParams {
  const fromUrl = decodeParams(window.location.search);
  if (Object.keys(fromUrl).length > 0) return { ...DEFAULT_PARAMS, ...fromUrl };
  const stored = storageGet(STORAGE_KEY);
  if (stored) {
    try {
      const restored = { ...DEFAULT_PARAMS, ...sanitizeParams(JSON.parse(stored)) };
      // never start from a broken saved state – there would be no model to show
      if (validateParams(restored).ok) return restored;
    } catch {
      /* corrupted – ignore */
    }
  }
  return { ...DEFAULT_PARAMS };
}

/** Params state synced (debounced) to the URL query and localStorage. */
export function useUrlParams(): [BootParams, (p: BootParams) => void] {
  const [params, setParams] = useState<BootParams>(initialParams);

  useEffect(() => {
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.search = encodeParams(params).toString();
      window.history.replaceState(window.history.state, '', url);
      storageSet(STORAGE_KEY, JSON.stringify(params));
    }, 300);
    return () => clearTimeout(timer);
  }, [params]);

  return [params, setParams];
}

/** Shareable link for the given params. */
export function shareUrl(params: BootParams): string {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = encodeParams(params).toString();
  return url.toString();
}
