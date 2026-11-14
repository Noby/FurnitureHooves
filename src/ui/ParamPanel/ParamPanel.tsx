import { useState, type ReactNode } from 'react';
import { DEFAULT_PARAMS } from '../../core/defaults';
import {
  SCREW_HEADS,
  SCREW_POSITIONS,
  type BootParams,
  type NumericKey,
  type ParamKey,
  type ScrewPosition,
} from '../../core/params';
import { PRESETS, applyPreset, matchesPreset } from '../../core/presets';
import { outerProfile, profileSize } from '../../core/profile';
import type { ValidationResult } from '../../core/validate';
import { useI18n } from '../../i18n';
import { NumberField } from './NumberField';

interface Props {
  params: BootParams;
  onChange: (p: BootParams) => void;
  validation: ValidationResult;
  squareLock: boolean;
  onSquareLock: (v: boolean) => void;
}

function Card({
  title,
  index,
  children,
  aside,
}: {
  title: string;
  index?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="card px-4 py-3">
      <header className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <div className="flex items-center gap-2">
          {aside}
          {index && <span className="font-mono text-[11px] text-muted">{index}</span>}
        </div>
      </header>
      {children}
    </section>
  );
}

function ScrewPosIcon({ pos }: { pos: ScrewPosition }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 5v13h16V5M5.5 5v10.5h11V5" />
      {pos === 'bottom' ? (
        <path d="M11 21v-7M9 21h4" strokeWidth="1.8" />
      ) : (
        <path d="M1 10h7M1 8v4" strokeWidth="1.8" />
      )}
    </svg>
  );
}

/** Default angle when switching a leg to tapered [°]. */
const DEFAULT_TAPER = 3;

function ProfileIcon({ tapered }: { tapered: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      {tapered ? <path d="M4 3h14l-3 16H7z" /> : <path d="M6 3h10v16H6z" />}
    </svg>
  );
}

type ShapeChoice = 'square' | 'rectangle' | 'round';

function ShapeIcon({ shape }: { shape: ShapeChoice }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      {shape === 'square' && <rect x="4" y="4" width="14" height="14" rx="1" />}
      {shape === 'rectangle' && <rect x="2" y="6" width="18" height="10" rx="1" />}
      {shape === 'round' && <circle cx="11" cy="11" r="7.5" />}
    </svg>
  );
}

function SegButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border px-2 text-[13px] transition-colors',
        pressed
          ? 'border-[1.5px] border-accent bg-accent-soft font-medium text-accent-soft-text'
          : 'border-line-input bg-surface text-ink-2 hover:border-ink-2',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function ParamPanel({ params, onChange, validation, squareLock, onSquareLock }: Props) {
  const { t } = useI18n();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const err = (k: ParamKey) => validation.errors.find((e) => e.key === k);
  const warn = (k: ParamKey) => validation.warnings.find((e) => e.key === k);

  const set = (patch: Partial<BootParams>) => onChange({ ...params, ...patch });
  const setNum = (k: NumericKey) => (v: number) => {
    if (squareLock && params.legShape === 'rectangle' && k === 'legWidth') {
      set({ legWidth: v, legDepth: v });
    } else {
      set({ [k]: v } as Partial<BootParams>);
    }
  };

  const field = (k: NumericKey, extra: Partial<Parameters<typeof NumberField>[0]> = {}) => (
    <NumberField
      key={k}
      k={k}
      value={params[k]}
      onChange={setNum(k)}
      error={err(k)}
      warning={warn(k)}
      {...extra}
    />
  );

  const shape: ShapeChoice =
    params.legShape === 'round' ? 'round' : squareLock ? 'square' : 'rectangle';
  const chooseShape = (s: ShapeChoice) => {
    if (s === 'round') {
      set({ legShape: 'round' });
    } else {
      onSquareLock(s === 'square');
      set({
        legShape: 'rectangle',
        legDepth: s === 'square' ? params.legWidth : params.legDepth,
      });
    }
  };

  const activePreset = PRESETS.find((pr) => matchesPreset(pr, params))?.id ?? '';

  const isRect = params.legShape === 'rectangle';
  const advancedHasError = (
    ['outerCornerRadius', 'bottomChamfer', 'topChamfer', 'topOuterChamfer'] as const
  ).some((k) => err(k));
  const showAdvanced = advancedOpen || advancedHasError;
  const outer = profileSize(outerProfile(params));
  const maxOuterR = Math.max(0, Math.min(outer.x, outer.y) / 2);
  const maxLegR = Math.max(0, Math.min(params.legWidth, params.legDepth) / 2);

  return (
    <div className="flex flex-col gap-3">
      <Card title={t('section.preset')}>
        <div className="flex flex-col gap-2 pb-1 pt-1">
          <label htmlFor="preset" className="sr-only">
            {t('section.preset')}
          </label>
          <select
            id="preset"
            value={activePreset}
            onChange={(e) => {
              const pr = PRESETS.find((p) => p.id === e.target.value);
              if (pr) {
                const next = applyPreset(pr, params);
                onSquareLock(next.legShape === 'rectangle' && next.legWidth === next.legDepth);
                onChange(next);
              }
            }}
            className="input h-11 w-full"
          >
            {activePreset === '' && <option value="">{t('preset.custom')}</option>}
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.labelKey)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost -mx-2 justify-start self-start px-2 text-[13px]"
            onClick={() => {
              onSquareLock(true);
              onChange({ ...DEFAULT_PARAMS });
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
              <path d="M2 2.5v3h3" />
            </svg>
            {t('btn.reset')}
          </button>
        </div>
      </Card>

      <Card title={t('section.leg')} index="01">
        <div className="pb-1 pt-1">
          <span className="label-caps" id="shape-label">
            {t('shape.label')}
          </span>
          <div className="mt-1.5 flex gap-2" role="group" aria-labelledby="shape-label">
            {(['square', 'rectangle', 'round'] as const).map((s) => (
              <SegButton key={s} pressed={shape === s} onClick={() => chooseShape(s)}>
                <ShapeIcon shape={s} />
                <span>{t(`shape.${s}`)}</span>
              </SegButton>
            ))}
          </div>
        </div>
        {field('legWidth', {
          slider: true,
          labelKey: (isRect ? 'legWidth' : 'legDiameter') + (params.legTaper > 0 ? 'Bottom' : ''),
        })}
        {isRect &&
          field('legDepth', {
            slider: true,
            disabled: squareLock,
            labelKey: params.legTaper > 0 ? 'legDepthBottom' : 'legDepth',
          })}
        {isRect && field('legCornerRadius', { sliderMax: maxLegR })}
        <div className="py-2">
          <span className="label-caps" id="profile-label">
            {t('profile.label')}
          </span>
          <div className="mt-1.5 flex gap-2" role="group" aria-labelledby="profile-label">
            <SegButton pressed={params.legTaper === 0} onClick={() => set({ legTaper: 0 })}>
              <ProfileIcon tapered={false} />
              <span>{t('profile.straight')}</span>
            </SegButton>
            <SegButton
              pressed={params.legTaper > 0}
              onClick={() => params.legTaper === 0 && set({ legTaper: DEFAULT_TAPER })}
            >
              <ProfileIcon tapered />
              <span>{t(isRect ? 'profile.pyramid' : 'profile.cone')}</span>
            </SegButton>
          </div>
        </div>
        {params.legTaper > 0 &&
          field('legTaper', {
            slider: true,
            unit: '°',
            labelKey: isRect ? 'legTaperPyramid' : 'legTaperCone',
            hintKey: 'hint.legTaper',
          })}
      </Card>

      <Card title={t('section.boot')} index="02">
        {field('lift', { slider: true })}
        {field('wallThickness', { slider: true, hintKey: 'hint.wallThickness' })}
        {field('sleeveHeight', { slider: true })}
        {field('tolerance', { slider: true, hintKey: 'hint.tolerance' })}
      </Card>

      <Card
        title={t('section.screw')}
        index="03"
        aside={
          <label className="relative inline-flex min-h-[44px] cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={params.screwEnabled}
              onChange={(e) => set({ screwEnabled: e.target.checked })}
              aria-label={t('field.screwEnabled')}
            />
            <span className="h-6 w-10 rounded-full border border-line-input bg-bg transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]" />
            <span className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-surface shadow-sm ring-1 ring-line-input transition-transform peer-checked:translate-x-4 peer-checked:ring-0" />
          </label>
        }
      >
        {params.screwEnabled ? (
          <>
            <div className="py-2">
              <span className="label-caps" id="pos-label">
                {t('field.screwPosition')}
              </span>
              <div className="mt-1.5 flex gap-2" role="group" aria-labelledby="pos-label">
                {SCREW_POSITIONS.map((pos) => (
                  <SegButton
                    key={pos}
                    pressed={params.screwPosition === pos}
                    onClick={() => set({ screwPosition: pos })}
                  >
                    <ScrewPosIcon pos={pos} />
                    <span>{t(`pos.${pos}`)}</span>
                  </SegButton>
                ))}
              </div>
              {warn('screwPosition') ? (
                <p className="mt-1.5 rounded-md border border-warn bg-warn-soft px-2 py-1.5 text-[12px] leading-snug text-warn">
                  {t(warn('screwPosition')!.code, warn('screwPosition')!.vars)}
                </p>
              ) : (
                <p className="mt-1 text-[12px] leading-snug text-muted">
                  {t(`hint.pos.${params.screwPosition}`)}
                </p>
              )}
            </div>
            {params.screwPosition === 'side' &&
              field('screwSideHeight', { slider: true, sliderMax: params.sleeveHeight })}
            {field('screwHoleDiameter')}
            <div className="py-2">
              <span className="label-caps" id="head-label">
                {t('field.screwHead')}
              </span>
              <div className="mt-1.5 flex gap-2" role="group" aria-labelledby="head-label">
                {SCREW_HEADS.map((h) => (
                  <SegButton
                    key={h}
                    pressed={params.screwHead === h}
                    onClick={() => set({ screwHead: h })}
                  >
                    <span className="text-[12px]">{t(`head.${h}`)}</span>
                  </SegButton>
                ))}
              </div>
            </div>
            {params.screwHead !== 'none' && field('screwHeadDiameter')}
          </>
        ) : (
          <p className="pb-2 text-[13px] text-muted">{t('help.screwEnabled')}</p>
        )}
      </Card>

      <section className="card px-4 py-1">
        <button
          type="button"
          aria-expanded={showAdvanced}
          aria-controls="advanced-body"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex min-h-[44px] w-full items-center justify-between text-left"
        >
          <span className="text-[15px] font-semibold text-ink">{t('section.advanced')}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            className={`text-muted transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        {showAdvanced && (
          <div id="advanced-body" className="pb-2">
            {isRect &&
              field('outerCornerRadius', { sliderMax: Math.min(maxOuterR, 20), slider: true })}
            {field('bottomChamfer', { slider: true })}
            {field('topChamfer', { slider: true })}
            {field('topOuterChamfer', { slider: true })}
          </div>
        )}
      </section>
    </div>
  );
}
