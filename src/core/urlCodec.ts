import { DEFAULT_PARAMS } from './defaults';
import { LEG_SHAPES, SCREW_HEADS, SCREW_POSITIONS, type BootParams, type ParamKey } from './params';

const ENUMS: Partial<Record<ParamKey, readonly string[]>> = {
  legShape: LEG_SHAPES,
  screwHead: SCREW_HEADS,
  screwPosition: SCREW_POSITIONS,
};

/** Short query keys for shareable links, e.g. ?w=50&d=50&lift=8 */
export const URL_KEYS: Record<ParamKey, string> = {
  legShape: 'shape',
  legWidth: 'w',
  legDepth: 'd',
  legCornerRadius: 'lr',
  legTaper: 'taper',
  tolerance: 'tol',
  lift: 'lift',
  wallThickness: 'wall',
  sleeveHeight: 'sleeve',
  outerCornerRadius: 'or',
  bottomChamfer: 'bc',
  topChamfer: 'tc',
  topOuterChamfer: 'toc',
  baseFlare: 'flare',
  reinforce: 'rib',
  screwEnabled: 'screw',
  screwPosition: 'pos',
  screwHoleDiameter: 'sd',
  screwHead: 'head',
  screwHeadDiameter: 'hd',
  screwSideHeight: 'sh',
};

/** Serialise only values that differ from defaults (plus w/d/lift for readability). */
export function encodeParams(p: BootParams): URLSearchParams {
  const q = new URLSearchParams();
  for (const key of Object.keys(URL_KEYS) as ParamKey[]) {
    const v = p[key];
    const always = key === 'legWidth' || key === 'legDepth' || key === 'lift';
    if (!always && v === DEFAULT_PARAMS[key]) continue;
    q.set(URL_KEYS[key], typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return q;
}

/** Parse query → partial params. Unknown / malformed values are ignored. */
export function decodeParams(search: string | URLSearchParams): Partial<BootParams> {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const out: Partial<Record<ParamKey, unknown>> = {};
  for (const key of Object.keys(URL_KEYS) as ParamKey[]) {
    const raw = q.get(URL_KEYS[key]);
    if (raw === null) continue;
    const def = DEFAULT_PARAMS[key];
    if (typeof def === 'number') {
      const n = Number(raw.replace(',', '.'));
      if (Number.isFinite(n)) out[key] = n;
    } else if (typeof def === 'boolean') {
      out[key] = raw === '1' || raw === 'true';
    } else if (ENUMS[key]?.includes(raw)) {
      out[key] = raw;
    }
  }
  return out as Partial<BootParams>;
}

/** Merge partial (untrusted) params over defaults, keeping only known keys with matching types. */
export function sanitizeParams(input: unknown): Partial<BootParams> {
  if (!input || typeof input !== 'object') return {};
  const out: Partial<Record<ParamKey, unknown>> = {};
  for (const key of Object.keys(DEFAULT_PARAMS) as ParamKey[]) {
    const v = (input as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (typeof v !== typeof DEFAULT_PARAMS[key]) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    const allowed = ENUMS[key];
    if (allowed && !allowed.includes(v as string)) continue;
    out[key] = v;
  }
  return out as Partial<BootParams>;
}
