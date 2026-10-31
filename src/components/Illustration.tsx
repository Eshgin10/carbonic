import type { ReactNode } from 'react';
import { PALETTES, stroke, type Tone } from './MaterialIcon';

/**
 * Illustrations in the same style as the material icons (outlined, shaded, lime accent),
 * used for transport modes and shipment sizes in the planner flow.
 */
type P = (typeof PALETTES)[Tone];

function Wheel({ c, x, y, r = 5 }: { c: P; x: number; y: number; r?: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={c.line} />
      <circle cx={x} cy={y} r={r * 0.45} fill={c.shade} />
    </>
  );
}

function Truck({ c }: { c: P }) {
  return (
    <>
      <ellipse cx={32} cy={55} rx={28} ry={2.5} fill={c.deep} opacity={0.35} />
      {/* Trailer */}
      <rect x={3} y={16} width={37} height={27} rx={2.5} fill={c.base} stroke={c.line} {...stroke} />
      <path d="M4 37H39V41.5A1.5 1.5 0 0 1 37.5 43H5.5A1.5 1.5 0 0 1 4 41.5Z" fill={c.shade} />
      <rect x={8} y={30} width={27} height={3.6} rx={1} fill={c.accent} stroke={c.line} strokeWidth={1.2} />
      <path d="M15.5 17.5V29M27.5 17.5V29" stroke={c.shade} strokeWidth={1.6} />
      <path d="M7 20.5H20" stroke={c.glint} strokeWidth={2.4} strokeLinecap="round" />
      <rect x={3} y={16} width={37} height={27} rx={2.5} fill="none" stroke={c.line} {...stroke} />
      {/* Cab */}
      <path d="M41 24H51.5L59 33V43H41Z" fill={c.shade} stroke={c.line} {...stroke} />
      <path d="M44 27H50.3L55 33H44Z" fill={c.deep} stroke={c.line} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M45.5 28.5L48 31.5" stroke={c.glint} strokeWidth={1.4} strokeLinecap="round" />
      <rect x={55.5} y={36} width={3.5} height={2.6} rx={0.8} fill={c.accent} stroke={c.line} strokeWidth={1} />
      {/* Chassis and wheels */}
      <rect x={3} y={43} width={56} height={3.2} rx={1} fill={c.line} />
      <Wheel c={c} x={12} y={48.5} />
      <Wheel c={c} x={23} y={48.5} />
      <Wheel c={c} x={51} y={48.5} />
    </>
  );
}

function Train({ c }: { c: P }) {
  return (
    <>
      {/* Track */}
      <path d="M2 53.5H62" stroke={c.line} strokeWidth={2} strokeLinecap="round" />
      {[6, 14, 22, 30, 38, 46, 54].map((x) => <rect key={x} x={x - 2.5} y={54.5} width={5} height={2.2} rx={0.6} fill={c.deep} />)}
      {/* Wagon */}
      <rect x={2.5} y={25} width={25} height={20} rx={2} fill={c.base} stroke={c.line} {...stroke} />
      <path d="M3.5 40H26.5V43.5A1.5 1.5 0 0 1 25 45H5A1.5 1.5 0 0 1 3.5 43.5Z" fill={c.shade} />
      <path d="M9 26.5V39M15 26.5V39M21 26.5V39" stroke={c.shade} strokeWidth={1.6} />
      <rect x={6} y={33} width={18} height={3.2} rx={1} fill={c.accent} stroke={c.line} strokeWidth={1.1} />
      <rect x={2.5} y={25} width={25} height={20} rx={2} fill="none" stroke={c.line} {...stroke} />
      <path d="M27.5 41.5H32" stroke={c.line} strokeWidth={2} strokeLinecap="round" />
      {/* Locomotive */}
      <rect x={34} y={17} width={15} height={5} rx={1.4} fill={c.deep} stroke={c.line} strokeWidth={1.6} />
      <path d="M32 22H52C57.5 22 61 26 61 31.5V45H32Z" fill={c.shade} stroke={c.line} {...stroke} />
      <path d="M48 25.5H52.5C55 25.5 57 27.5 57.5 31H48Z" fill={c.deep} stroke={c.line} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M50 27.2L52 29.5" stroke={c.glint} strokeWidth={1.3} strokeLinecap="round" />
      <rect x={36} y={26} width={8} height={6} rx={1.2} fill={c.base} stroke={c.line} strokeWidth={1.4} />
      <path d="M32.8 36H60.2V39H32.8Z" fill={c.accent} />
      <path d="M32 36H61M32 39H61" stroke={c.line} strokeWidth={1.1} />
      <path d="M32 22H52C57.5 22 61 26 61 31.5V45H32Z" fill="none" stroke={c.line} {...stroke} />
      <rect x={30} y={45} width={31} height={2.8} rx={1} fill={c.line} />
      <Wheel c={c} x={9} y={49} r={3.6} />
      <Wheel c={c} x={21} y={49} r={3.6} />
      <Wheel c={c} x={38} y={49.5} r={3.8} />
      <Wheel c={c} x={53} y={49.5} r={3.8} />
    </>
  );
}

function Ferry({ c }: { c: P }) {
  return (
    <>
      {/* Funnel and bridge */}
      <path d="M41 11H48L47 21H42Z" fill={c.deep} stroke={c.line} {...stroke} />
      <path d="M41.6 14.5H47.6" stroke={c.accent} strokeWidth={2.4} />
      <rect x={33} y={21} width={21} height={13} rx={2} fill={c.shade} stroke={c.line} {...stroke} />
      <rect x={35.5} y={24.5} width={16} height={4} rx={1} fill={c.deep} stroke={c.line} strokeWidth={1.3} />
      <path d="M37.5 26.5H40M43 26.5H45.5" stroke={c.glint} strokeWidth={1.3} strokeLinecap="round" />
      {/* Cargo: a trailer on deck */}
      <rect x={9} y={24} width={20} height={10} rx={1.6} fill={c.base} stroke={c.line} {...stroke} />
      <rect x={11.5} y={28} width={15} height={2.4} rx={0.8} fill={c.accent} stroke={c.line} strokeWidth={1} />
      {/* Hull */}
      <path d="M4 34H60L54 47H11Z" fill={c.base} stroke={c.line} {...stroke} />
      <path d="M6.2 38H58.2L56.8 41.2H7.7Z" fill={c.accent} stroke={c.line} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M9.5 44.5H55" stroke={c.shade} strokeWidth={2.6} strokeLinecap="round" />
      {[46, 50].map((x) => <circle key={x} cx={x} cy={36} r={0.9} fill={c.line} />)}
      {/* Water */}
      <path d="M1 51C5 48.5 9 48.5 13 51S21 53.5 25 51 33 48.5 37 51 45 53.5 49 51 57 48.5 63 51" fill="none" stroke={c.line} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M8 56.5C12 54.5 16 54.5 20 56.5S28 58.5 32 56.5 40 54.5 44 56.5" fill="none" stroke={c.deep} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}

/** One wrapped film bale, front-right perspective. */
function Bale({ c, x, y, w = 18, h = 13 }: { c: P; x: number; y: number; w?: number; h?: number }) {
  const d = 5;
  return (
    <g>
      <path d={`M${x} ${y}L${x + d} ${y - d}H${x + w + d}L${x + w} ${y}Z`} fill={c.shade} stroke={c.line} {...stroke} />
      <path d={`M${x + w} ${y}L${x + w + d} ${y - d}V${y + h - d}L${x + w} ${y + h}Z`} fill={c.deep} stroke={c.line} {...stroke} />
      <rect x={x} y={y} width={w} height={h} fill={c.base} stroke={c.line} {...stroke} />
      <path d={`M${x + w * 0.33} ${y}V${y + h}M${x + w * 0.67} ${y}V${y + h}`} stroke={c.line} strokeWidth={1.2} opacity={0.55} />
      <path d={`M${x + 2.5} ${y + 3}l3 2.5M${x + w - 5} ${y + h - 4}l2.5 1.6`} stroke={c.deep} strokeWidth={1.1} strokeLinecap="round" />
      <path d={`M${x + 2} ${y + h - 3}H${x + w * 0.3}`} stroke={c.accent} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Bales({ c }: { c: P }) {
  return (
    <>
      <ellipse cx={30} cy={53} rx={24} ry={2.5} fill={c.deep} opacity={0.35} />
      <Bale c={c} x={8} y={37} />
      <Bale c={c} x={29} y={37} />
      <Bale c={c} x={18} y={22} />
    </>
  );
}

function Convoy({ c }: { c: P }) {
  return (
    <>
      <g transform="translate(-4 -8) scale(0.72)" opacity={0.9}><Truck c={c} /></g>
      <g transform="translate(14 14) scale(0.78)"><Truck c={c} /></g>
    </>
  );
}

function Pile({ c }: { c: P }) {
  return (
    <>
      <ellipse cx={32} cy={56} rx={29} ry={2.5} fill={c.deep} opacity={0.35} />
      <Bale c={c} x={2} y={42} w={16} h={11} />
      <Bale c={c} x={21} y={42} w={16} h={11} />
      <Bale c={c} x={40} y={42} w={16} h={11} />
      <Bale c={c} x={11} y={28} w={16} h={11} />
      <Bale c={c} x={30} y={28} w={16} h={11} />
      <Bale c={c} x={20} y={14} w={16} h={11} />
    </>
  );
}

/** Spreadsheet with an upload badge (file import). */
function Sheet({ c }: { c: P }) {
  return (
    <>
      <ellipse cx={32} cy={59} rx={22} ry={2.4} fill={c.deep} opacity={0.35} />
      <path d="M12 5H38L49 16V54A2.5 2.5 0 0 1 46.5 56.5H14.5A2.5 2.5 0 0 1 12 54Z" fill={c.base} stroke={c.line} {...stroke} />
      <path d="M38 5V14.5A1.5 1.5 0 0 0 39.5 16H49" fill={c.shade} stroke={c.line} {...stroke} />
      <path d="M17 10H31" stroke={c.glint} strokeWidth={2.4} strokeLinecap="round" />
      <rect x={17.5} y={22} width={26} height={26} rx={1.5} fill={c.shade} stroke={c.line} strokeWidth={1.4} />
      <rect x={17.5} y={22} width={26} height={6.5} rx={1.5} fill={c.accent} stroke={c.line} strokeWidth={1.4} />
      <path d="M17.5 35H43.5M17.5 41.5H43.5M26.5 22V48" stroke={c.line} strokeWidth={1.2} />
      <circle cx={47} cy={47} r={10.5} fill={c.accent} stroke={c.line} {...stroke} />
      <path d="M47 52.5V41.5M42.5 46L47 41.5L51.5 46" fill="none" stroke={c.line} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Start dot, dashed route and destination pin (manual search). */
function Route({ c }: { c: P }) {
  return (
    <>
      <ellipse cx={32} cy={58} rx={26} ry={2.4} fill={c.deep} opacity={0.35} />
      <path d="M6 50L20 44L32 50L46 44L58 50V56L46 50L32 56L20 50L6 56Z" fill={c.shade} stroke={c.line} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M13 43C18 30 30 40 36 30S44 22 46 24" fill="none" stroke={c.line} strokeWidth={2} strokeLinecap="round" strokeDasharray="0.1 4.5" />
      <circle cx={13} cy={43} r={4.5} fill={c.line} />
      <circle cx={13} cy={43} r={1.9} fill={c.accent} />
      <path d="M46 5A10 10 0 0 1 56 15C56 23 46 32 46 32S36 23 36 15A10 10 0 0 1 46 5Z" fill={c.accent} stroke={c.line} {...stroke} />
      <circle cx={46} cy={15} r={3.8} fill={c.base} stroke={c.line} strokeWidth={1.6} />
      <path d="M40 10.5A7 7 0 0 1 43 8" stroke={c.glint} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}

const DRAW = { truck: Truck, train: Train, ferry: Ferry, bales: Bales, convoy: Convoy, pile: Pile, sheet: Sheet, route: Route };
export type IllustrationName = keyof typeof DRAW;

export function Illustration({ name, tone = 'light', size = 72 }: { name: IllustrationName; tone?: Tone; size?: number }) {
  const Draw = DRAW[name];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <Draw c={PALETTES[tone]} />
    </svg>
  );
}

/** Rounded gradient tile that frames an illustration; lime when selected. */
export function IconTile({ selected, size = 104, radius = 28, children }: { selected: boolean; size?: number; radius?: number; children: ReactNode }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center transition-colors duration-300 ${selected ? 'bg-[radial-gradient(120%_120%_at_30%_20%,#F4FFC2_0%,#DCFF00_55%,#B8D600_100%)]' : 'bg-[radial-gradient(120%_120%_at_30%_20%,#FFFFFF_0%,#EEF1EF_70%)] ring-1 ring-line'}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {children}
    </div>
  );
}
