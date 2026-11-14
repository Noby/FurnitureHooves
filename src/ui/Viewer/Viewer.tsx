import { Canvas } from '@react-three/fiber';
import { useMemo, useState, type ReactNode } from 'react';
import type { BootMesh } from '../../core/generateBoot';
import type { BootParams } from '../../core/params';
import { useI18n } from '../../i18n';
import { Scene } from './Scene';

interface Props {
  mesh: BootMesh | null;
  meshParams: BootParams | null;
  busy: boolean;
  error: string | null;
  invalid: boolean;
  fileName: string;
  /** print tip (falls back to the generic one) */
  tip?: string;
  dark: boolean;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

function Toggle({
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
        'min-h-[36px] rounded-md border px-3 font-mono text-[12px] transition-colors',
        pressed
          ? 'border-[1.5px] border-accent bg-accent-soft font-medium text-accent-soft-text'
          : 'border-line-input bg-surface text-ink-2 hover:border-ink-2',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function Viewer({ mesh, meshParams, busy, error, invalid, fileName, dark, tip }: Props) {
  const { t } = useI18n();
  const [showGhost, setShowGhost] = useState(true);
  const [section, setSection] = useState(false);
  const [showDims, setShowDims] = useState(true);
  const [centerCount, setCenterCount] = useState(0);
  const webgl = useMemo(hasWebGL, []);

  const fitKey = useMemo(() => {
    if (!mesh) return `${centerCount}`;
    const s = mesh.bbox.max.map((v, i) => Math.round(v - mesh.bbox.min[i])).join('x');
    return `${s}|${centerCount}`;
  }, [mesh, centerCount]);

  return (
    <section
      className="card flex min-h-0 flex-col overflow-hidden lg:flex-1"
      aria-label={t('viewer.title')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="truncate font-mono text-[12px] text-ink-2">
          {fileName} <span className="text-muted">· ISO</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Toggle pressed={showGhost} onClick={() => setShowGhost((v) => !v)}>
            {t('viewer.ghost')}
          </Toggle>
          <Toggle pressed={section} onClick={() => setSection((v) => !v)}>
            {t('viewer.section')}
          </Toggle>
          <Toggle pressed={showDims} onClick={() => setShowDims((v) => !v)}>
            {t('viewer.dims')}
          </Toggle>
          <button
            type="button"
            aria-label={t('viewer.center')}
            title={t('viewer.center')}
            onClick={() => setCenterCount((c) => c + 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line-input bg-surface text-ink-2 hover:border-ink-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
              <circle cx="8" cy="8" r="2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="viewer-grid relative h-[340px] sm:h-[420px] lg:h-auto lg:min-h-[460px] lg:flex-1">
        {!webgl ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-ink-2">
            {t('viewer.webgl')}
          </p>
        ) : mesh && meshParams ? (
          <Canvas
            className="!absolute inset-0"
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, localClippingEnabled: true } as never}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
            }}
            camera={{ position: [-90, -120, 95], up: [0, 0, 1], fov: 35, near: 0.5, far: 5000 }}
          >
            <Scene
              mesh={mesh}
              params={meshParams}
              showGhost={showGhost}
              section={section}
              showDims={showDims}
              fitKey={fitKey}
              dark={dark}
            />
          </Canvas>
        ) : (
          <p className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-muted">
            {invalid ? t('viewer.invalidNoModel') : error ? t('viewer.error') : t('viewer.loading')}
          </p>
        )}

        {busy && mesh && (
          <span
            role="status"
            className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] text-ink-2"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            {t('viewer.computing')}
          </span>
        )}
        {mesh && (invalid || error) && (
          <p
            role="status"
            className="absolute left-3 right-3 top-3 max-w-md rounded-md border border-danger bg-danger-soft px-3 py-2 text-[12px] text-danger"
          >
            {invalid ? t('viewer.invalid') : `${t('viewer.error')}: ${error}`}
          </p>
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 right-3 text-[12px] leading-snug text-muted">
          <span className="label-caps mr-2 text-accent-text">Tip</span>
          {tip ?? t('viewer.tip')}
        </p>
      </div>
    </section>
  );
}
