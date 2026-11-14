import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/core/defaults';
import type { BootParams } from '../src/core/params';
import { PRESETS, applyPreset, matchesPreset } from '../src/core/presets';
import { decodeParams, encodeParams, sanitizeParams } from '../src/core/urlCodec';
import { validateParams } from '../src/core/validate';

const P = (over: Partial<BootParams> = {}): BootParams => ({ ...DEFAULT_PARAMS, ...over });
const errorKeys = (p: BootParams) => validateParams(p).errors.map((e) => `${e.key}:${e.code}`);
const warnKeys = (p: BootParams) => validateParams(p).warnings.map((e) => `${e.key}:${e.code}`);

describe('validateParams', () => {
  it('defaults are valid with no warnings', () => {
    const r = validateParams(DEFAULT_PARAMS);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('presets change only the leg – screw and boot settings are kept', () => {
    const custom = P({ screwEnabled: true, screwPosition: 'side', lift: 12, wallThickness: 2.4 });
    for (const preset of PRESETS) {
      const next = applyPreset(preset, custom);
      expect(next.screwEnabled).toBe(true);
      expect(next.screwPosition).toBe('side');
      expect(next.lift).toBe(12);
      expect(next.wallThickness).toBe(2.4);
      expect(matchesPreset(preset, next)).toBe(true);
    }
    // the cone preset sets a taper, a straight preset resets it
    const cone = applyPreset(
      PRESETS.find((p) => p.id === 'cone35')!,
      custom,
    );
    expect(cone.legTaper).toBe(3);
    expect(
      applyPreset(
        PRESETS.find((p) => p.id === 'sq40')!,
        cone,
      ).legTaper,
    ).toBe(0);
  });

  it('all presets are valid', () => {
    for (const preset of PRESETS) expect(validateParams(applyPreset(preset)).ok).toBe(true);
  });

  it('range errors', () => {
    expect(errorKeys(P({ legWidth: 5 }))).toContain('legWidth:err.min');
    expect(errorKeys(P({ lift: 500 }))).toContain('lift:err.max');
    expect(errorKeys(P({ wallThickness: 0.5 }))).toContain('wallThickness:err.min');
    expect(errorKeys(P({ tolerance: Number.NaN }))).toContain('tolerance:err.invalid');
  });

  it('screw head must be larger than the hole', () => {
    expect(
      errorKeys(P({ screwEnabled: true, screwHeadDiameter: 3, screwHoleDiameter: 3 })),
    ).toContain('screwHeadDiameter:err.headVsHole');
    // irrelevant without head or without screw
    expect(
      validateParams(P({ screwEnabled: true, screwHead: 'none', screwHeadDiameter: 2 })).ok,
    ).toBe(true);
    expect(validateParams(P({ screwEnabled: false, screwHeadDiameter: 2 })).ok).toBe(true);
  });

  it('recess must leave at least 1 mm of floor', () => {
    expect(errorKeys(P({ screwEnabled: true, lift: 2, screwHeadDiameter: 6 }))).toContain(
      'screwHeadDiameter:err.recessDepth',
    );
  });

  it('screw must fit inside the inner area', () => {
    expect(
      errorKeys(
        P({
          screwEnabled: true,
          legWidth: 10,
          legDepth: 10,
          screwHoleDiameter: 6,
          screwHeadDiameter: 12,
        }),
      ),
    ).toContain('screwHeadDiameter:err.screwFit');
  });

  it('outer corner radius cannot thin the wall below 0.8 mm', () => {
    expect(errorKeys(P({ outerCornerRadius: 15 }))).toContain('outerCornerRadius:err.cornerWall');
    expect(errorKeys(P({ outerCornerRadius: 40 }))).toContain('outerCornerRadius:err.max');
    // a rounded leg allows a larger outer radius
    expect(validateParams(P({ legCornerRadius: 10, outerCornerRadius: 13 })).ok).toBe(true);
  });

  it('leg corner radius limited by leg size', () => {
    expect(errorKeys(P({ legWidth: 20, legDepth: 20, legCornerRadius: 11 }))).toContain(
      'legCornerRadius:err.max',
    );
  });

  it('chamfers limited', () => {
    expect(errorKeys(P({ bottomChamfer: 3, wallThickness: 2.4 }))).toContain(
      'bottomChamfer:err.belowWall',
    );
    expect(errorKeys(P({ topChamfer: 2, wallThickness: 2 }))).toContain('topChamfer:err.max');
  });

  it('top chamfers together must leave 0.8 mm on the rim', () => {
    expect(validateParams(P({ topOuterChamfer: 1.8 })).ok).toBe(true); // 0.4 + 1.8 = 2.2 = 3 − 0.8
    expect(errorKeys(P({ topOuterChamfer: 2 }))).toContain('topOuterChamfer:err.topRim');
    expect(errorKeys(P({ topChamfer: 0, topOuterChamfer: 3, wallThickness: 4 }))).toEqual([]);
  });

  it('soft warnings', () => {
    expect(warnKeys(P({ wallThickness: 0.8, topChamfer: 0, bottomChamfer: 0.4 }))).toContain(
      'wallThickness:warn.thinWall',
    );
    expect(warnKeys(P({ tolerance: 0 }))).toContain('tolerance:warn.zeroTolerance');
    expect(warnKeys(P({ lift: 40 }))).toContain('lift:warn.largeLift');
    expect(validateParams(P({ tolerance: 0 })).ok).toBe(true);
  });
});

describe('url codec', () => {
  it('round-trips parameters', () => {
    const p = P({
      legShape: 'round',
      legWidth: 35.5,
      screwEnabled: false,
      screwHead: 'none',
    });
    const q = encodeParams(p);
    expect({ ...DEFAULT_PARAMS, ...decodeParams(q.toString()) }).toEqual(p);
  });

  it('defaults produce a short link', () => {
    expect(encodeParams(DEFAULT_PARAMS).toString()).toBe('w=50&d=50&lift=8');
  });

  it('ignores garbage', () => {
    expect(decodeParams('w=abc&shape=hexagon&lift=12')).toEqual({ lift: 12 });
    expect(sanitizeParams({ legWidth: '50', lift: 9, foo: 1, legShape: 'x' })).toEqual({ lift: 9 });
  });
});
