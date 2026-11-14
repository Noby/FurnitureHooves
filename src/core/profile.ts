import type { BootParams } from './params';

/** 2D cross-section profile, centred on the origin. Units: mm. */
export type Profile =
  | { kind: 'rect'; width: number; depth: number; radius: number }
  | { kind: 'circle'; diameter: number };

export type Vec2 = [number, number];

/** Circular segments for a full circle of the given radius (min 32, multiple of 4). */
export function circleSegments(radius: number): number {
  const byLength = Math.ceil((2 * Math.PI * radius) / 0.5);
  const n = Math.min(360, Math.max(32, byLength));
  return Math.ceil(n / 4) * 4;
}

export function rect(width: number, depth: number, radius = 0): Profile {
  const r = Math.max(0, Math.min(radius, width / 2, depth / 2));
  return { kind: 'rect', width, depth, radius: r };
}

export function circle(diameter: number): Profile {
  return { kind: 'circle', diameter };
}

/**
 * Offset a (convex) profile by `delta` (positive = outwards).
 * Rounded corners grow/shrink with the offset; when growing a sharp corner
 * the radius becomes `delta` (true offset), unless `keepSharp` is set.
 */
export function offsetProfile(p: Profile, delta: number, keepSharp = false): Profile {
  if (p.kind === 'circle') return circle(Math.max(0, p.diameter + 2 * delta));
  const width = Math.max(0, p.width + 2 * delta);
  const depth = Math.max(0, p.depth + 2 * delta);
  let radius = p.radius + delta;
  if (keepSharp && p.radius === 0) radius = 0;
  return rect(width, depth, Math.max(0, radius));
}

export function profileSize(p: Profile): { x: number; y: number } {
  return p.kind === 'circle' ? { x: p.diameter, y: p.diameter } : { x: p.width, y: p.depth };
}

/** Polygon points (counter-clockwise) approximating the profile. */
export function profilePoints(p: Profile): Vec2[] {
  if (p.kind === 'circle') {
    const r = p.diameter / 2;
    const n = circleSegments(r);
    const pts: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return pts;
  }
  const hx = p.width / 2;
  const hy = p.depth / 2;
  const r = p.radius;
  if (r <= 1e-6) {
    return [
      [hx, -hy],
      [hx, hy],
      [-hx, hy],
      [-hx, -hy],
    ];
  }
  const quarter = circleSegments(r) / 4;
  const corners: [number, number, number][] = [
    [hx - r, -hy + r, -Math.PI / 2],
    [hx - r, hy - r, 0],
    [-hx + r, hy - r, Math.PI / 2],
    [-hx + r, -hy + r, Math.PI],
  ];
  const pts: Vec2[] = [];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= quarter; i++) {
      const a = a0 + (Math.PI / 2) * (i / quarter);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  // drop duplicates where straight edges collapse (radius == half size)
  return pts.filter((pt, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    return Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) > 1e-6;
  });
}

/**
 * Grow a profile by `delta` on every side keeping its corner radius
 * (used for tapered legs – a tapered leg keeps its edge radius).
 */
export function growProfile(p: Profile, delta: number): Profile {
  if (p.kind === 'circle') return circle(p.diameter + 2 * delta);
  return rect(p.width + 2 * delta, p.depth + 2 * delta, p.radius);
}

/**
 * Horizontal widening per side of a tapered leg at height `z` of the boot.
 * The leg size is measured at its bottom, which sits on the cavity floor (z = lift).
 */
export function taperOffset(params: BootParams, z: number): number {
  return Math.max(0, z - params.lift) * Math.tan((params.legTaper * Math.PI) / 180);
}

/** Leg profile exactly as the user entered it. */
export function legProfile(params: BootParams): Profile {
  if (params.legShape === 'round') return circle(params.legWidth);
  return rect(params.legWidth, params.legDepth, params.legCornerRadius);
}

/** Inner cavity profile = leg + tolerance/2 on every side. Sharp leg corners stay sharp. */
export function innerProfile(params: BootParams): Profile {
  return offsetProfile(legProfile(params), params.tolerance / 2, true);
}

/** Outer profile = inner + wall on every side, with its own outer corner radius. */
export function outerProfile(params: BootParams): Profile {
  const inner = innerProfile(params);
  if (inner.kind === 'circle') return offsetProfile(inner, params.wallThickness);
  const o = offsetProfile(inner, params.wallThickness);
  return rect(
    o.kind === 'rect' ? o.width : 0,
    o.kind === 'rect' ? o.depth : 0,
    params.outerCornerRadius,
  );
}

/**
 * Minimal wall thickness in the corner region of a rectangle boot,
 * caused by a large outer corner radius. Returns wallThickness for round legs.
 */
export function minCornerWall(params: BootParams): number {
  const inner = innerProfile(params);
  const t = params.wallThickness;
  if (inner.kind === 'circle') return t;
  const ri = inner.radius;
  const outer = outerProfile(params);
  const ro = outer.kind === 'rect' ? outer.radius : 0;
  if (ro <= t + ri) return t;
  // distance between arc centres along the diagonal
  const centreGap = Math.SQRT2 * (ro - t - ri);
  return ro - ri - centreGap;
}
