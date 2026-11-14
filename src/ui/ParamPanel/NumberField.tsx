import { useId, useState } from 'react';
import { RANGES, type NumericKey } from '../../core/params';
import type { Issue } from '../../core/validate';
import { useI18n } from '../../i18n';
import { InfoTip } from './InfoTip';

interface Props {
  k: NumericKey;
  value: number;
  onChange: (v: number) => void;
  /** i18n key override for label/help (e.g. legDiameter) */
  labelKey?: string;
  slider?: boolean;
  /** dynamic slider max (e.g. corner radius limited by size) */
  sliderMax?: number;
  disabled?: boolean;
  error?: Issue;
  warning?: Issue;
  hintKey?: string;
  /** unit shown in the input, default mm */
  unit?: string;
}

export function NumberField({
  k,
  value,
  onChange,
  labelKey,
  slider,
  sliderMax,
  disabled,
  error,
  warning,
  hintKey,
  unit = 'mm',
}: Props) {
  const { t, fmt } = useI18n();
  const id = useId();
  const msgId = `${id}-msg`;
  const [text, setText] = useState<string | null>(null);
  const range = RANGES[k];
  const name = labelKey ?? k;
  const label = t(`field.${name}`);
  const display = text ?? (Number.isFinite(value) ? fmt(value, 2) : '');
  const max = sliderMax ?? range.max;

  const commit = (raw: string) => {
    setText(raw);
    const trimmed = raw.trim().replace(',', '.');
    const n = trimmed === '' ? Number.NaN : Number(trimmed);
    onChange(n);
  };

  const nudge = (dir: 1 | -1) => {
    const base = Number.isFinite(value) ? value : range.min;
    const next = Math.round((base + dir * range.step) * 1000) / 1000;
    setText(null);
    onChange(Math.min(range.max, Math.max(range.min, next)));
  };

  const issue = error ?? warning;
  const tone = error ? 'error' : warning ? 'warning' : null;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-1.5 text-ink-2">
          <span className="truncate">{label}</span>
        </label>
        <InfoTip k={k} label={`${label} – info`} text={t(`help.${name}`)} />
        <div
          className={[
            'flex h-9 w-[112px] shrink-0 items-center rounded-md border bg-surface',
            tone === 'error'
              ? 'border-[1.5px] border-danger'
              : tone === 'warning'
                ? 'border-[1.5px] border-warn'
                : 'border-line-input focus-within:border-[1.5px] focus-within:border-accent',
          ].join(' ')}
        >
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            value={display}
            aria-invalid={!!error}
            aria-describedby={issue || hintKey ? msgId : undefined}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => setText(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                nudge(1);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                nudge(-1);
              }
            }}
            className="w-full min-w-0 bg-transparent px-2 text-right font-mono text-[13px] text-ink outline-none disabled:opacity-50"
          />
          <span className="pr-2 font-mono text-[11px] text-muted">{unit}</span>
        </div>
      </div>
      {slider && (
        <input
          type="range"
          aria-label={label}
          min={range.min}
          max={max}
          step={range.step}
          disabled={disabled}
          value={Number.isFinite(value) ? Math.min(max, Math.max(range.min, value)) : range.min}
          onChange={(e) => {
            setText(null);
            onChange(Number(e.target.value));
          }}
          className="mt-2 h-5 w-full"
        />
      )}
      {(issue || hintKey) && (
        <p
          id={msgId}
          role={error ? 'alert' : undefined}
          className={[
            'mt-1 text-[12px] leading-snug',
            tone === 'error' ? 'text-danger' : tone === 'warning' ? 'text-warn' : 'text-muted',
          ].join(' ')}
        >
          {issue ? t(issue.code, issue.vars) : t(hintKey!)}
        </p>
      )}
    </div>
  );
}
