import { useEffect, useId, useRef, useState } from 'react';
import type { ParamKey } from '../../core/params';
import { ParamDiagram } from './ParamDiagram';

interface Props {
  k: ParamKey;
  label: string;
  text: string;
}

/** "i" button with a popover containing a schematic + explanation. */
export function InfoTip({ k, label, text }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line-input font-mono text-[10px] text-muted hover:border-accent hover:text-accent-text"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-7 z-30 w-[220px] rounded-lg border border-line bg-surface p-3 text-[12px] leading-snug text-ink-2 shadow-[0_4px_16px_rgba(17,24,39,0.08)]"
        >
          <ParamDiagram k={k} />
          <span className="mt-2 block">{text}</span>
        </span>
      )}
    </span>
  );
}
