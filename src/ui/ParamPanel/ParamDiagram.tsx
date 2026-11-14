/**
 * Small schematic explaining what a parameter means.
 * Section view (side cut) for boot params, plan view (top) for leg/corner params.
 */
const PLAN_KEYS: string[] = ['legDepth', 'legCornerRadius', 'outerCornerRadius'];

const HL = 'var(--accent)';
const BODY = 'var(--accent-soft)';
const STROKE = 'var(--text-2)';
const GHOST = 'var(--ghost)';

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g stroke={HL} strokeWidth={1.4}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} markerStart="url(#fh-a)" markerEnd="url(#fh-a)" />
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker
        id="fh-a"
        viewBox="0 0 6 6"
        refX="3"
        refY="3"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L6,3 L0,6 z" fill={HL} />
      </marker>
    </defs>
  );
}

function SectionView({ k }: { k: string }) {
  const side = k === 'screwSideHeight';
  const screwKey = k.startsWith('screw') && !side;
  return (
    <>
      {/* leg ghost */}
      <rect
        x={23}
        y={2}
        width={74}
        height={54}
        fill={GHOST}
        fillOpacity={0.18}
        stroke={GHOST}
        strokeDasharray="3 2"
      />
      {/* boot section */}
      <path
        d="M13,72 L107,72 L110,69 L110,16 L100,16 L98,18 L98,56 L22,56 L22,18 L20,16 L10,16 L10,69 Z"
        fill={BODY}
        stroke={STROKE}
        strokeWidth={1}
      />
      {/* screw hole + countersink */}
      <path
        d="M52,72 L57,67 L57,56 L63,56 L63,67 L68,72 Z"
        fill="var(--surface)"
        stroke={STROKE}
        strokeWidth={0.8}
      />
      {side && (
        <>
          <rect
            x={8}
            y={33}
            width={15}
            height={6}
            fill="var(--surface)"
            stroke={STROKE}
            strokeWidth={0.8}
          />
          <Arrow x1={30} y1={56} x2={30} y2={36} />
        </>
      )}
      {k === 'lift' && (
        <>
          <rect x={22} y={56} width={76} height={16} fill={HL} fillOpacity={0.25} />
          <Arrow x1={116} y1={56} x2={116} y2={72} />
        </>
      )}
      {k === 'wallThickness' && (
        <rect x={10} y={16} width={12} height={40} fill={HL} fillOpacity={0.45} />
      )}
      {k === 'sleeveHeight' && <Arrow x1={4} y1={16} x2={4} y2={56} />}
      {k === 'tolerance' && <rect x={22} y={18} width={1.6} height={38} fill={HL} />}
      {(k === 'legWidth' || k === 'legShape') && <Arrow x1={23} y1={9} x2={97} y2={9} />}
      {k === 'bottomChamfer' && (
        <circle cx={11} cy={71} r={5} fill="none" stroke={HL} strokeWidth={1.4} />
      )}
      {k === 'topOuterChamfer' && (
        <circle cx={109} cy={17} r={5} fill="none" stroke={HL} strokeWidth={1.4} />
      )}
      {k === 'topChamfer' && (
        <circle cx={21} cy={17} r={5} fill="none" stroke={HL} strokeWidth={1.4} />
      )}
      {screwKey && (
        <>
          <circle cx={60} cy={65} r={11} fill="none" stroke={HL} strokeWidth={1.4} />
          {k === 'screwHoleDiameter' && <Arrow x1={57} y1={61} x2={63} y2={61} />}
          {k === 'screwHeadDiameter' && <Arrow x1={52} y1={76} x2={68} y2={76} />}
        </>
      )}
    </>
  );
}

function PlanView({ k }: { k: string }) {
  return (
    <>
      <rect
        x={20}
        y={6}
        width={80}
        height={68}
        rx={k === 'outerCornerRadius' ? 12 : 4}
        fill={BODY}
        stroke={STROKE}
      />
      <rect
        x={30}
        y={16}
        width={60}
        height={48}
        rx={k === 'legCornerRadius' ? 10 : 0}
        fill={GHOST}
        fillOpacity={0.25}
        stroke={GHOST}
        strokeDasharray="3 2"
      />
      {k === 'legDepth' && <Arrow x1={108} y1={16} x2={108} y2={64} />}
      {k === 'legCornerRadius' && (
        <circle cx={34} cy={20} r={8} fill="none" stroke={HL} strokeWidth={1.4} />
      )}
      {k === 'outerCornerRadius' && (
        <circle cx={25} cy={11} r={8} fill="none" stroke={HL} strokeWidth={1.4} />
      )}
    </>
  );
}

export function ParamDiagram({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 120 80" width={168} height={112} aria-hidden="true" className="block">
      <Defs />
      {PLAN_KEYS.includes(k) ? <PlanView k={k} /> : <SectionView k={k} />}
    </svg>
  );
}
