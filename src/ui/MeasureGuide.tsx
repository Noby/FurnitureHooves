import { useI18n } from '../i18n';

export function MeasureGuide({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const steps = [1, 2, 3, 4, 5];
  return (
    <article className="mx-auto max-w-3xl">
      <div className="card px-5 py-5 sm:px-8 sm:py-7">
        <h1 className="text-[22px] font-bold text-ink">{t('measure.title')}</h1>
        <p className="mt-2 text-ink-2">{t('measure.intro')}</p>
        <svg viewBox="0 0 320 120" className="mt-5 w-full max-w-md" aria-hidden="true">
          <rect
            x="110"
            y="6"
            width="100"
            height="96"
            fill="var(--ghost)"
            fillOpacity="0.18"
            stroke="var(--ghost)"
            strokeDasharray="4 3"
          />
          <line x1="20" y1="110" x2="300" y2="110" stroke="var(--text-muted)" />
          <rect
            x="96"
            y="58"
            width="16"
            height="16"
            fill="var(--accent-soft)"
            stroke="var(--accent)"
          />
          <rect
            x="208"
            y="58"
            width="16"
            height="16"
            fill="var(--accent-soft)"
            stroke="var(--accent)"
          />
          <rect
            x="88"
            y="62"
            width="144"
            height="8"
            fill="none"
            stroke="var(--text-2)"
            strokeWidth="1.5"
          />
          <text
            x="160"
            y="52"
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="11"
            fill="var(--accent-text)"
          >
            W
          </text>
          <line x1="110" y1="56" x2="210" y2="56" stroke="var(--accent)" />
          <text
            x="246"
            y="94"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="10"
            fill="var(--text-muted)"
          >
            10–20 mm
          </text>
          <line
            x1="240"
            y1="66"
            x2="240"
            y2="110"
            stroke="var(--text-muted)"
            strokeDasharray="2 2"
          />
        </svg>
        <ol className="mt-6 flex flex-col gap-5">
          {steps.map((i) => (
            <li key={i} className="flex gap-4">
              <span className="font-mono text-[13px] font-semibold text-accent-text">0{i}</span>
              <div>
                <h2 className="font-semibold text-ink">{t(`measure.s${i}t`)}</h2>
                <p className="mt-1 leading-relaxed text-ink-2">{t(`measure.s${i}`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn-primary mt-7" onClick={onBack}>
          {t('measure.back')}
        </button>
      </div>
    </article>
  );
}
