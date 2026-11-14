import { strFromU8, unzipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, PILLAR_SKIN, PILLAR_VOID_DIAMETER } from '../src/core/defaults';
import { meshTo3mf } from '../src/core/export/3mf';
import { buildBootManifold, generateBoot, pillarPositions } from '../src/core/generateBoot';
import { DEFAULT_LOAD, loadAdvice, sanitizeLoad } from '../src/core/load';
import { getManifold, initManifold } from '../src/core/manifold';
import type { BootParams } from '../src/core/params';
import { outerProfile, profileSize } from '../src/core/profile';
import { validateParams } from '../src/core/validate';
import { isManifold, signedVolume } from './helpers';

beforeAll(async () => {
  await initManifold();
});

const P = (over: Partial<BootParams> = {}): BootParams => ({ ...DEFAULT_PARAMS, ...over });

/** Triangles facing down steeper than 45° above the plate (internal voids excluded by caller). */
function steepDownFaces(p: BootParams, ignore: (x: number, y: number, z: number) => boolean) {
  const mesh = generateBoot(p);
  const pos = mesh.positions;
  let bad = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => mesh.indices[t + k] * 3);
    const cx = (pos[a] + pos[b] + pos[c]) / 3;
    const cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3;
    const cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    if (cz < 0.01 || ignore(cx, cy, cz)) continue;
    const u = [0, 1, 2].map((k) => pos[b + k] - pos[a + k]);
    const v = [0, 1, 2].map((k) => pos[c + k] - pos[a + k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    if (len / 2 < 0.01) continue;
    if (n[2] / len < -0.72) bad++;
  }
  return bad;
}

describe('wider base (baseFlare)', () => {
  for (const [name, over] of Object.entries({
    square: { lift: 20, baseFlare: 8 },
    round: { legShape: 'round', legWidth: 35, lift: 25, baseFlare: 10 },
    tapered: { legTaper: 5, lift: 16, baseFlare: 6 },
    withScrew: { lift: 12, baseFlare: 5, screwEnabled: true },
  } as Record<string, Partial<BootParams>>)) {
    it(`${name}: wider footprint, 45° into the wall below the floor, manifold, no supports`, () => {
      const p = P(over);
      expect(validateParams(p).errors).toEqual([]);
      const mesh = generateBoot(p);
      expect(isManifold(mesh)).toBe(true);
      const outer = profileSize(outerProfile(p));
      const m = getManifold();
      const solid = buildBootManifold(p, m);
      // on the plate: grown by the flare
      const bottom = solid.slice(p.bottomChamfer + 0.05);
      expect(bottom.bounds().max[1]).toBeCloseTo(outer.y / 2 + p.baseFlare, 2);
      bottom.delete();
      // half way up the 45° slope
      const mid = solid.slice(p.lift - p.baseFlare / 2);
      expect(mid.bounds().max[1]).toBeCloseTo(outer.y / 2 + p.baseFlare / 2, 2);
      mid.delete();
      // just above the cavity floor: original wall
      const above = solid.slice(p.lift + 0.05);
      expect(above.bounds().max[1]).toBeLessThan(outer.y / 2 + 0.05 + 0.01);
      above.delete();
      solid.delete();
      expect(steepDownFaces(p, () => false)).toBe(0);
    });
  }

  it('flare must end below the cavity floor', () => {
    const errs = validateParams(P({ lift: 8, baseFlare: 8 })).errors.map((e) => e.key);
    expect(errs).toContain('baseFlare');
    expect(validateParams(P({ lift: 8, baseFlare: 6.9 })).ok).toBe(true);
  });
});

describe('reinforcement pillars', () => {
  it('hidden voids under the leg, closed top and bottom, manifold', () => {
    const p = P({ lift: 12, reinforce: true });
    const pos = pillarPositions(p);
    expect(pos.length).toBeGreaterThan(20);
    const plain = generateBoot(P({ lift: 12 }));
    const mesh = generateBoot(p);
    expect(isManifold(mesh)).toBe(true);
    expect(signedVolume(mesh)).toBeCloseTo(mesh.volume, 0);
    // removed volume = n · octagon area (8 segments: 2√2·r²) · h
    const r = PILLAR_VOID_DIAMETER / 2;
    const h = p.lift - 2 * PILLAR_SKIN;
    expect(plain.volume - mesh.volume).toBeCloseTo(pos.length * 2 * Math.SQRT2 * r * r * h, 0);
    // outside identical
    expect(mesh.bbox).toEqual(plain.bbox);
    const m = getManifold();
    const solid = buildBootManifold(p, m);
    const solidPlain = buildBootManifold(P({ lift: 12 }), m);
    for (const z of [PILLAR_SKIN / 2, p.lift - PILLAR_SKIN / 2]) {
      // solid skin: no voids reach the bottom or the cavity floor
      const a = solid.slice(z);
      const b = solidPlain.slice(z);
      expect(a.area()).toBeCloseTo(b.area(), 1);
      a.delete();
      b.delete();
    }
    const midA = solid.slice(p.lift / 2);
    const midB = solidPlain.slice(p.lift / 2);
    expect(midB.area() - midA.area()).toBeGreaterThan(pos.length * Math.PI * r * r * 0.8);
    midA.delete();
    midB.delete();
    solid.delete();
    solidPlain.delete();
  });

  it('keep clear of the bottom screw, scale spacing for big legs, need enough lift', () => {
    const withScrew = pillarPositions(P({ reinforce: true, screwEnabled: true }));
    expect(withScrew.every(([x, y]) => Math.hypot(x, y) >= 3 + 1.5 - 1e-9)).toBe(true);
    expect(
      pillarPositions(P({ reinforce: true, legWidth: 200, legDepth: 200 })).length,
    ).toBeLessThanOrEqual(400);
    expect(pillarPositions(P({ reinforce: true, lift: 3 }))).toEqual([]);
    expect(validateParams(P({ reinforce: true, lift: 3 })).warnings.map((w) => w.code)).toContain(
      'warn.pillarsLift',
    );
    expect(isManifold(generateBoot(P({ reinforce: true, legShape: 'round', legWidth: 40 })))).toBe(
      true,
    );
  });
});

describe('load advisor', () => {
  it('defaults: light load on a 50×50 leg', () => {
    const a = loadAdvice(DEFAULT_LOAD, DEFAULT_PARAMS);
    expect(a.perLegKg).toBe(15);
    expect(a.forceN).toBeCloseTo(15 * 9.81 * 2, 6);
    expect(a.legPressure).toBeCloseTo(a.forceN / 2500, 6);
    expect(a.tier).toBe('light');
    expect(a.print.infill).toBe(20);
    expect(a.recommendReinforce).toBe(false);
    expect(a.warnings).toEqual([]);
  });

  it('heavy load → denser print, PETG and pillars; pillars allow moderate infill', () => {
    const load = { weightKg: 400, legs: 4, furnitureHeight: 900 };
    const a = loadAdvice(load, DEFAULT_PARAMS); // 100 kg/leg → ~0.78 MPa
    expect(a.tier).toBe('heavy');
    expect(a.print.material).toBe('PETG');
    expect(a.recommendReinforce).toBe(true);
    expect(a.print.infill).toBe(50);
    expect(loadAdvice(load, P({ reinforce: true })).print.infill).toBe(35);
    // small leg, same load → extreme
    expect(loadAdvice(load, P({ legWidth: 20, legDepth: 20 })).tier).toBe('extreme');
  });

  it('tall furniture and a high lift → stability warnings and a wider base', () => {
    const tall = loadAdvice({ weightKg: 80, legs: 4, furnitureHeight: 1800 }, P({ lift: 25 }));
    const codes = tall.warnings.map((w) => w.code);
    expect(codes).toContain('load.warn.tallHighLift');
    expect(codes).toContain('load.warn.slender');
    expect(tall.recommendFlare).toBeGreaterThan(0);
    expect(tall.recommendReinforce).toBe(true);
    // recommended flare is always valid
    expect(validateParams(P({ lift: 25, baseFlare: tall.recommendFlare })).ok).toBe(true);
    // a wider base lowers the floor pressure
    expect(loadAdvice(DEFAULT_LOAD, P({ lift: 25, baseFlare: 10 })).floorPressure).toBeLessThan(
      loadAdvice(DEFAULT_LOAD, P({ lift: 25 })).floorPressure,
    );
  });

  it('sanitizes stored input', () => {
    expect(sanitizeLoad({ weightKg: 'x', legs: 99, furnitureHeight: 2000 })).toEqual({
      weightKg: DEFAULT_LOAD.weightKg,
      legs: 12,
      furnitureHeight: 2000,
    });
  });
});

describe('3MF with slicer settings', () => {
  it('contains a PrusaSlicer object config with infill and perimeters', () => {
    const mesh = generateBoot(DEFAULT_PARAMS);
    const zip = unzipSync(
      meshTo3mf(mesh, 'boot_50x50', { infill: 35, perimeters: 4, solidLayers: 5 }),
    );
    const cfg = strFromU8(zip['Metadata/Slic3r_PE_model.config']);
    expect(cfg).toContain('key="fill_density" value="35%"');
    expect(cfg).toContain('key="perimeters" value="4"');
    expect(cfg).toContain('key="top_solid_layers" value="5"');
    expect(cfg).toContain(`lastid="${mesh.indices.length / 3 - 1}"`);
    expect(zip['3D/3dmodel.model']).toBeDefined();
    // without settings no config file
    expect(unzipSync(meshTo3mf(mesh))['Metadata/Slic3r_PE_model.config']).toBeUndefined();
  });
});
